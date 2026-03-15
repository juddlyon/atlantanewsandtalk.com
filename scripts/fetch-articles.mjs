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
  // Tier 1 — hyperlocal ITP
  { name: 'Decaturish', url: 'https://www.decaturish.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc', tier: 1 },
  { name: 'Urbanize Atlanta', url: 'https://urbanize.city/atlanta/rss.xml', tier: 1 },
  { name: 'Atlanta Civic Circle', url: 'https://atlantaciviccircle.org/feed/', tier: 1 },

  // Tier 2 — Atlanta-wide with good ITP coverage
  { name: 'SaportaReport', url: 'https://saportareport.com/feed/', tier: 2 },
  { name: 'Rough Draft Atlanta', url: 'https://roughdraftatlanta.com/feed/', tier: 2 },
  { name: 'Atlanta Magazine', url: 'https://www.atlantamagazine.com/rss', tier: 2 },
  { name: 'The Atlanta Voice', url: 'https://www.theatlantavoice.com/feed/', tier: 2 },
  { name: 'Georgia Recorder', url: 'https://georgiarecorder.com/feed/', tier: 2 },
  { name: 'Global Atlanta', url: 'https://globalatlanta.com/feed/', tier: 2 },
  { name: 'Capital B Atlanta', url: 'https://atlanta.capitalbnews.org/feed/', tier: 2 },
  { name: 'Eater Atlanta', url: 'https://atlanta.eater.com/rss/index.xml', tier: 2 },
  { name: 'What Now Atlanta', url: 'https://whatnow.com/atlanta/feed/', tier: 2 },
  { name: 'Hypepotamus', url: 'https://hypepotamus.com/feed/', tier: 2 },

  // Tier 3 — TV/radio news (broader but high volume, good images)
  { name: '11Alive', url: 'https://www.11alive.com/feeds/syndication/rss/news', tier: 3 },
  { name: 'WSB-TV', url: 'https://www.wsbtv.com/arc/outboundfeeds/rss/?outputType=xml', tier: 3 },
  { name: 'GPB News', url: 'https://www.gpb.org/news/rss.xml', tier: 3 },
  { name: 'Fox 5 Atlanta', url: 'https://www.fox5atlanta.com/rss.xml', tier: 3 },

  // Tier 3 — Google News proxies (sources without direct RSS)
  { name: 'WABE', url: 'https://news.google.com/rss/search?q=site:wabe.org+when:2d&hl=en-US&gl=US&ceid=US:en', tier: 3 },
  { name: 'AJC', url: 'https://news.google.com/rss/search?q=site:ajc.com+atlanta+when:2d&hl=en-US&gl=US&ceid=US:en', tier: 3 },
  { name: 'Axios Atlanta', url: 'https://news.google.com/rss/search?q=site:axios.com/local/atlanta+when:2d&hl=en-US&gl=US&ceid=US:en', tier: 3 },
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
    const timeout = setTimeout(() => controller.abort(), 3000);
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
    // Timeout each feed fetch at 15 seconds
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AtlantaNewsAndTalk/1.0' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Status code ${res.status}`);
    const xml = await res.text();
    const feed = await parser.parseString(xml);
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

  // Try to get og:image for articles without images (max 3, don't slow things down)
  const needImages = articles.filter((a) => !a.imageUrl).slice(0, 3);
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
