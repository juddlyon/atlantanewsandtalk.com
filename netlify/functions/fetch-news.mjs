import Anthropic from '@anthropic-ai/sdk';
import RSSParser from 'rss-parser';
import fs from 'fs';
import path from 'path';

const parser = new RSSParser();

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
        snippet: (item.contentSnippet || item.content || '').slice(0, 500),
        source: source.name,
        neighborhood: source.neighborhood,
      }));
  } catch (err) {
    console.error(`Failed to fetch ${source.name}: ${err.message}`);
    return [];
  }
}

async function summarizeWithClaude(articles) {
  const client = new Anthropic();

  const articleText = articles
    .map(
      (a, i) =>
        `${i + 1}. [${a.source}] "${a.title}"\n   ${a.snippet}\n   Link: ${a.link}`
    )
    .join('\n\n');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a hyperlocal Atlanta news editor focused on Inside The Perimeter (ITP) neighborhoods. Write naturally and journalistically — never use the word "AI" or reference automation in the output.

Given these articles from today, produce a JSON digest with this structure:
{
  "date": "YYYY-MM-DD",
  "summary": "2-3 sentence overview of the day's biggest Atlanta ITP stories",
  "sections": [
    {
      "category": "Category Name",
      "stories": [
        {
          "headline": "Short punchy headline",
          "summary": "2-3 sentence summary focused on ITP impact",
          "neighborhood": "Specific ITP neighborhood if applicable",
          "source": "Source name",
          "link": "URL",
          "originalTitle": "Original article title"
        }
      ]
    }
  ]
}

Categories to use: Development & Housing, Transit & Infrastructure, Food & Drink, Arts & Culture, Politics & Policy, Public Safety, Community, Business

Only include stories relevant to ITP Atlanta. Prioritize hyperlocal neighborhood-level news. If a story is about metro Atlanta generally but doesn't specifically affect ITP, skip it.

Articles:
${articleText}

Respond with ONLY the JSON, no markdown fences.`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(text);
}

export default async function handler(req) {
  // Fetch all feeds in parallel
  const feedResults = await Promise.all(SOURCES.map(fetchFeed));
  const allArticles = feedResults.flat();

  if (allArticles.length === 0) {
    return new Response(JSON.stringify({ message: 'No articles found' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`Fetched ${allArticles.length} articles from ${SOURCES.length} sources`);

  // Summarize with Claude
  const digest = await summarizeWithClaude(allArticles);

  // Write digest to src/data so it can be used at build time
  const dataDir = path.join(process.cwd(), 'src', 'data');
  const digestPath = path.join(dataDir, 'digest-latest.json');
  const archivePath = path.join(dataDir, `digest-${digest.date}.json`);

  fs.writeFileSync(digestPath, JSON.stringify(digest, null, 2));
  fs.writeFileSync(archivePath, JSON.stringify(digest, null, 2));

  return new Response(JSON.stringify({ success: true, articleCount: allArticles.length, digest }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = {
  schedule: '@daily',
};
