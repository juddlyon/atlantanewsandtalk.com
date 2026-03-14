#!/usr/bin/env node

/**
 * Local article fetcher — pulls RSS feeds from Atlanta ITP news sources,
 * extracts images, and writes raw articles to src/data/raw-articles.json
 * for summarization by Claude Code.
 *
 * Usage: node scripts/fetch-articles.mjs
 */

import RSSParser from 'rss-parser';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const parser = new RSSParser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

// Sources ordered by SE BeltLine relevance
const SOURCES = [
  // Tier 1 — hyperlocal ITP / SE BeltLine
  { name: 'Decaturish', url: 'https://decaturish.com/feed/', tier: 1 },
  { name: 'Urbanize Atlanta', url: 'https://atlanta.urbanize.city/feed', tier: 1 },
  { name: 'What Now Atlanta', url: 'https://whatnowatlanta.com/feed/', tier: 1 },

  // Tier 1.5 — Patch hyperlocal neighborhoods
  { name: 'Patch - East Atlanta', url: 'https://patch.com/georgia/east-atlanta/rss', tier: 1 },
  { name: 'Patch - Decatur', url: 'https://patch.com/georgia/decatur/rss', tier: 1 },
  { name: 'Patch - Grant Park', url: 'https://patch.com/georgia/grantpark-eav/rss', tier: 1 },
  { name: 'Patch - Midtown', url: 'https://patch.com/georgia/midtown/rss', tier: 1 },
  { name: 'Patch - Buckhead', url: 'https://patch.com/georgia/buckhead/rss', tier: 2 },
  { name: 'Patch - Brookhaven', url: 'https://patch.com/georgia/brookhaven/rss', tier: 2 },

  // Tier 2 — Atlanta-wide but good ITP coverage
  { name: 'SaportaReport', url: 'https://saportareport.com/feed/', tier: 2 },
  { name: 'Atlanta Civic Circle', url: 'https://atlantaciviccircle.org/feed/', tier: 2 },
  { name: 'Rough Draft Atlanta', url: 'https://roughdraftatlanta.com/feed/', tier: 2 },

  // Tier 2.5 — neighborhood blogs and community sites
  { name: 'East Atlanta Patch Blog', url: 'https://eastatlantavillage.com/feed/', tier: 2 },
  { name: 'Grant Park Conservancy', url: 'https://grantparkconservancy.org/feed/', tier: 2 },
  { name: 'Midtown Alliance', url: 'https://www.midtownatl.com/feed', tier: 2 },

  // Tier 3 — broader Atlanta
  { name: 'Axios Atlanta', url: 'https://www.axios.com/local/atlanta/feed', tier: 3 },
  { name: 'Atlanta Magazine', url: 'https://www.atlantamagazine.com/feed/', tier: 3 },
  { name: 'Tomorrow\'s News Today', url: 'https://tomorrowsnewstoday.com/feed/', tier: 2 },
];

function extractImageFromItem(item) {
  // media:content
  if (item.mediaContent?.$ ?.url) return item.mediaContent.$.url;

  // media:thumbnail
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;

  // enclosure
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
    return item.enclosure.url;
  }

  // content:encoded — first <img>
  if (item.contentEncoded) {
    const $ = cheerio.load(item.contentEncoded);
    const src = $('img').first().attr('src');
    if (src) return src;
  }

  // content — first <img>
  if (item.content) {
    const $ = cheerio.load(item.content);
    const src = $('img').first().attr('src');
    if (src) return src;
  }

  return null;
}

async function fetchOgImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AtlantaNewsAndTalk/1.0' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);
    return $('meta[property="og:image"]').attr('content') || null;
  } catch {
    return null;
  }
}

async function fetchFeed(source) {
  try {
    console.log(`  Fetching ${source.name}...`);
    const feed = await parser.parseURL(source.url);
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000; // 48 hours for more coverage

    const items = feed.items
      .filter((item) => {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : 0;
        return pubDate > twoDaysAgo;
      })
      .slice(0, 15)
      .map((item) => {
        // Extract text content, strip HTML
        let textContent = '';
        if (item.contentEncoded) {
          const $ = cheerio.load(item.contentEncoded);
          textContent = $.text().trim().slice(0, 1500);
        } else if (item.contentSnippet) {
          textContent = item.contentSnippet.slice(0, 1500);
        } else if (item.content) {
          const $ = cheerio.load(item.content);
          textContent = $.text().trim().slice(0, 1500);
        }

        return {
          title: item.title || '',
          link: item.link || '',
          pubDate: item.pubDate || '',
          content: textContent,
          source: source.name,
          tier: source.tier,
          imageUrl: extractImageFromItem(item),
        };
      });

    console.log(`    → ${items.length} articles (last 48h)`);
    return items;
  } catch (err) {
    console.error(`    ✗ Failed: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('Atlanta News & Talk — Fetching articles\n');
  console.log(`Sources: ${SOURCES.length}`);
  console.log('');

  // Fetch all feeds
  const results = await Promise.all(SOURCES.map(fetchFeed));
  let articles = results.flat();

  console.log(`\nTotal articles: ${articles.length}`);

  // Try to get og:image for articles without images (first 8)
  const needImages = articles.filter((a) => !a.imageUrl).slice(0, 8);
  if (needImages.length > 0) {
    console.log(`\nFetching og:images for ${needImages.length} articles...`);
    const ogResults = await Promise.allSettled(
      needImages.map((a) => fetchOgImage(a.link))
    );
    ogResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        needImages[i].imageUrl = result.value;
      }
    });
  }

  const withImages = articles.filter((a) => a.imageUrl).length;
  console.log(`Articles with images: ${withImages}/${articles.length}`);

  // Write raw articles
  const outPath = path.join(ROOT, 'src', 'data', 'raw-articles.json');
  fs.writeFileSync(outPath, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    articleCount: articles.length,
    articles,
  }, null, 2));

  console.log(`\nWritten to: ${outPath}`);
  console.log('\nNext step: Run Claude Code to summarize these into a digest.');
  console.log('  → node scripts/summarize.mjs');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
