import Anthropic from '@anthropic-ai/sdk';
import RSSParser from 'rss-parser';
import fs from 'fs';
import path from 'path';

const parser = new RSSParser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

const SOURCES = [
  { name: 'Decaturish', url: 'https://decaturish.com/feed/', neighborhood: 'Decatur' },
  { name: 'SaportaReport', url: 'https://saportareport.com/feed/', neighborhood: 'Atlanta' },
  { name: 'Urbanize Atlanta', url: 'https://atlanta.urbanize.city/feed', neighborhood: 'Atlanta' },
  { name: 'Atlanta Civic Circle', url: 'https://atlantaciviccircle.org/feed/', neighborhood: 'Atlanta' },
  { name: 'Axios Atlanta', url: 'https://www.axios.com/local/atlanta/feed', neighborhood: 'Atlanta' },
  { name: 'What Now Atlanta', url: 'https://whatnowatlanta.com/feed/', neighborhood: 'Atlanta' },
  { name: 'Atlanta INtown Paper', url: 'https://www.intownpaper.com/feed/', neighborhood: 'Intown' },
  { name: 'Rough Draft Atlanta', url: 'https://roughdraftatlanta.com/feed/', neighborhood: 'Atlanta' },
];

const ITP_NEIGHBORHOODS = [
  'Midtown', 'Buckhead', 'Downtown', 'East Atlanta', 'East Atlanta Village',
  'Grant Park', 'Inman Park', 'Virginia-Highland', 'Old Fourth Ward', 'Decatur',
  'Kirkwood', 'Little Five Points', 'Edgewood', 'Reynoldstown', 'Cabbagetown',
  'Summerhill', 'West End', 'Westside', 'Poncey-Highland', 'Candler Park',
  'Morningside', 'Druid Hills', 'Ansley Park', 'Piedmont Heights', 'Ormewood Park',
  'Chosewood Park', 'Capitol View', 'Adair Park', 'Oakland City', 'Mechanicsville',
  'Peoplestown', 'Lakewood Heights', 'Sylvan Hills', 'Pittsburgh', 'West Midtown',
  'Castleberry Hill', 'Sweet Auburn', 'Home Park', 'Atlantic Station', 'Collier Hills',
  'Bolton', 'Grove Park',
];

/**
 * Extract image URL from an RSS item by checking multiple possible fields
 */
function extractImageFromItem(item) {
  // 1. media:content
  if (item.mediaContent) {
    const url = item.mediaContent.$ && item.mediaContent.$.url;
    if (url) return url;
  }

  // 2. media:thumbnail
  if (item.mediaThumbnail) {
    const url = item.mediaThumbnail.$ && item.mediaThumbnail.$.url;
    if (url) return url;
  }

  // 3. enclosure
  if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image/')) {
    return item.enclosure.url;
  }

  // 4. content:encoded — look for first <img> tag
  if (item.contentEncoded) {
    const match = item.contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match && match[1]) return match[1];
  }

  // 5. content — look for first <img> tag
  if (item.content) {
    const match = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match && match[1]) return match[1];
  }

  return null;
}

/**
 * Fetch og:image from an article URL as a fallback
 */
async function fetchOgImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AtlantaNewsAndTalk/1.0' },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    return ogMatch ? ogMatch[1] : null;
  } catch {
    return null;
  }
}

async function fetchFeed(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return feed.items
      .filter((item) => {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : 0;
        return pubDate > oneDayAgo;
      })
      .slice(0, 10)
      .map((item) => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.pubDate || '',
        snippet: (item.contentSnippet || item.content || '').slice(0, 800),
        contentEncoded: (item.contentEncoded || '').slice(0, 1500),
        source: source.name,
        neighborhood: source.neighborhood,
        imageUrl: extractImageFromItem(item),
      }));
  } catch (err) {
    console.error(`Failed to fetch ${source.name}: ${err.message}`);
    return [];
  }
}

async function enrichArticlesWithImages(articles) {
  // For the first 5 articles without images, try fetching og:image
  const articlesNeedingImages = articles
    .map((a, i) => ({ article: a, index: i }))
    .filter(({ article }) => !article.imageUrl)
    .slice(0, 5);

  const ogResults = await Promise.allSettled(
    articlesNeedingImages.map(({ article }) => fetchOgImage(article.link))
  );

  ogResults.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      articlesNeedingImages[i].article.imageUrl = result.value;
    }
  });

  return articles;
}

async function summarizeWithClaude(articles) {
  const client = new Anthropic();

  const articleText = articles
    .map(
      (a, i) =>
        `${i + 1}. [${a.source}] "${a.title}"\n   ${a.snippet}\n   Link: ${a.link}\n   Image: ${a.imageUrl || 'none'}\n   Published: ${a.pubDate}`
    )
    .join('\n\n');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are a hyperlocal Atlanta news editor focused on Inside The Perimeter (ITP) neighborhoods. Write naturally and journalistically. Your copy should read like a skilled local reporter wrote it.

Given these articles from today, produce a JSON digest with this exact structure:

{
  "date": "YYYY-MM-DD",
  "generatedAt": "ISO timestamp",
  "summary": "2-3 sentence overview of the day's biggest Atlanta ITP stories — written like a newspaper lede",
  "topStory": { the single most significant/interesting story object from the sections below },
  "sections": [
    {
      "category": "Category Name",
      "stories": [
        {
          "id": "slug-from-headline (lowercase, hyphens, no special chars)",
          "headline": "Short punchy headline (newspaper style, 8-12 words max)",
          "summary": "3-4 sentence detailed summary focused on ITP impact and why readers should care",
          "body": "A 2-3 paragraph journalistic write-up suitable for a standalone article page. Include relevant details, quotes if available from the source material, and neighborhood context. Write in inverted pyramid style.",
          "neighborhood": "Most specific ITP neighborhood",
          "neighborhoods": ["Primary neighborhood", "Other affected neighborhoods"],
          "source": "Source name",
          "sourceUrl": "URL to original article",
          "imageUrl": "URL to image or null",
          "imageAlt": "Descriptive alt text for the image",
          "publishedAt": "ISO date from the original article",
          "keywords": ["relevant", "seo", "keywords"]
        }
      ]
    }
  ],
  "neighborhoods": {
    "Neighborhood Name": { "storyCount": N, "topStory": "story-slug" }
  }
}

IMPORTANT RULES:
- Assign neighborhoods from ONLY this list: ${ITP_NEIGHBORHOODS.join(', ')}
- If a story doesn't fit a specific neighborhood, use the closest match
- Categories to use: Development & Housing, Transit & Infrastructure, Food & Drink, Arts & Culture, Politics & Policy, Public Safety, Community, Business
- Only include stories relevant to ITP Atlanta
- Prioritize hyperlocal neighborhood-level news
- Write headlines in newspaper style — active voice, present tense
- The "body" field should be 2-3 substantial paragraphs of journalistic writing
- Generate a unique slug "id" for each story
- Include 3-5 SEO keywords per story
- The "topStory" should be duplicated from whichever section contains it — it should be the most significant story of the day
- Count each neighborhood that appears in any story's "neighborhoods" array for the neighborhoods summary
- Preserve any image URLs from the source data
- Never use the word "AI" or reference automation anywhere in the output

Articles:
${articleText}

Respond with ONLY the JSON, no markdown fences or explanation.`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(text);
}

export default async function handler(req) {
  try {
    // Fetch all feeds in parallel
    const feedResults = await Promise.all(SOURCES.map(fetchFeed));
    let allArticles = feedResults.flat();

    if (allArticles.length === 0) {
      return new Response(JSON.stringify({ message: 'No articles found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fetched ${allArticles.length} articles from ${SOURCES.length} sources`);

    // Enrich articles without images by fetching og:image
    allArticles = await enrichArticlesWithImages(allArticles);

    const articlesWithImages = allArticles.filter((a) => a.imageUrl).length;
    console.log(`${articlesWithImages}/${allArticles.length} articles have images`);

    // Summarize with Claude
    const digest = await summarizeWithClaude(allArticles);

    // Write digest to src/data so it can be used at build time
    const dataDir = path.join(process.cwd(), 'src', 'data');
    const digestPath = path.join(dataDir, 'digest-latest.json');
    const archivePath = path.join(dataDir, `digest-${digest.date}.json`);

    fs.writeFileSync(digestPath, JSON.stringify(digest, null, 2));
    fs.writeFileSync(archivePath, JSON.stringify(digest, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        articleCount: allArticles.length,
        articlesWithImages,
        digest,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Digest generation failed:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const config = {
  schedule: '@daily',
};
