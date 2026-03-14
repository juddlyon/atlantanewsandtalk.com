#!/usr/bin/env node

/**
 * Summarize raw articles into a digest using Claude API.
 * Reads src/data/raw-articles.json, writes src/data/digest-latest.json
 *
 * Usage: node scripts/summarize.mjs
 *
 * Requires ANTHROPIC_API_KEY env var.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');

const ITP_NEIGHBORHOODS = [
  // Tier 1 — SE BeltLine core (highest priority)
  'Old Fourth Ward', 'Grant Park', 'Reynoldstown', 'Cabbagetown', 'Inman Park',
  'Summerhill', 'East Atlanta Village', 'Ormewood Park',
  // Tier 2 — adjacent ITP
  'Kirkwood', 'Edgewood', 'Little Five Points', 'Candler Park', 'Poncey-Highland',
  'Decatur', 'East Atlanta', 'Peoplestown', 'Chosewood Park', 'Sweet Auburn',
  // Tier 3 — broader ITP
  'Midtown', 'Downtown', 'Virginia-Highland', 'Morningside', 'Druid Hills',
  'Ansley Park', 'Piedmont Heights', 'West Midtown', 'Westside', 'West End',
  'Buckhead', 'Castleberry Hill', 'Home Park', 'Atlantic Station', 'Collier Hills',
  'Bolton', 'Grove Park', 'Capitol View', 'Adair Park', 'Oakland City',
  'Mechanicsville', 'Lakewood Heights', 'Sylvan Hills', 'Pittsburgh',
];

async function main() {
  const rawPath = path.join(DATA_DIR, 'raw-articles.json');

  if (!fs.existsSync(rawPath)) {
    console.error('No raw articles found. Run fetch-articles.mjs first.');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  console.log(`Summarizing ${raw.articleCount} articles...`);

  const client = new Anthropic();

  const articleText = raw.articles
    .map((a, i) =>
      `${i + 1}. [${a.source}] "${a.title}"\n   ${a.content.slice(0, 800)}\n   Link: ${a.link}\n   Image: ${a.imageUrl || 'none'}\n   Published: ${a.pubDate}`
    )
    .join('\n\n');

  const today = new Date().toISOString().slice(0, 10);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are a hyperlocal Atlanta news editor focused on Inside The Perimeter (ITP) neighborhoods, with special emphasis on the Southeast BeltLine corridor (Old Fourth Ward, Grant Park, Reynoldstown, Cabbagetown, Inman Park, Summerhill, East Atlanta Village, Ormewood Park). Write naturally and journalistically.

Given these articles, produce a JSON digest. PRIORITIZE stories about SE BeltLine neighborhoods. Include other ITP stories but give SE BeltLine top billing.

Output this exact JSON structure:

{
  "date": "${today}",
  "generatedAt": "${new Date().toISOString()}",
  "summary": "2-3 sentence overview of the day's biggest Atlanta ITP stories — written like a newspaper lede",
  "topStory": { the single most significant story object — prefer SE BeltLine stories },
  "sections": [
    {
      "category": "Category Name",
      "stories": [
        {
          "id": "slug-from-headline",
          "headline": "Short punchy headline (newspaper style, 8-12 words)",
          "summary": "3-4 sentence summary focused on neighborhood impact",
          "body": "2-3 paragraph journalistic write-up for a standalone article page. Inverted pyramid style. Include details and neighborhood context.",
          "neighborhood": "Most specific ITP neighborhood",
          "neighborhoods": ["Primary", "Other affected"],
          "source": "Source name",
          "sourceUrl": "original URL",
          "imageUrl": "image URL or null",
          "imageAlt": "descriptive alt text",
          "publishedAt": "ISO date",
          "keywords": ["relevant", "seo", "keywords"]
        }
      ]
    }
  ],
  "neighborhoods": {
    "Neighborhood Name": { "storyCount": N, "topStory": "slug" }
  }
}

RULES:
- Assign neighborhoods from: ${ITP_NEIGHBORHOODS.join(', ')}
- Categories: Development & Housing, Transit & Infrastructure, Food & Drink, Arts & Culture, Politics & Policy, Public Safety, Community, Business
- Only include stories relevant to ITP Atlanta
- SE BeltLine stories get priority placement
- Write headlines in active voice, present tense
- Body should be 2-3 substantial paragraphs
- 3-5 SEO keywords per story
- topStory should also appear in its section
- Preserve image URLs from source data
- Never use the word "AI" or reference automation
- Include 10-20 stories total, prioritizing quality and ITP relevance

Articles:
${articleText}

Respond with ONLY valid JSON, no markdown fences.`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const digest = JSON.parse(text);

  // Write digest
  const digestPath = path.join(DATA_DIR, 'digest-latest.json');
  const archivePath = path.join(DATA_DIR, `digest-${digest.date}.json`);

  fs.writeFileSync(digestPath, JSON.stringify(digest, null, 2));
  fs.writeFileSync(archivePath, JSON.stringify(digest, null, 2));

  const storyCount = digest.sections.reduce((n, s) => n + s.stories.length, 0);
  const neighborhoods = Object.keys(digest.neighborhoods).length;

  console.log(`\nDigest generated:`);
  console.log(`  Stories: ${storyCount}`);
  console.log(`  Sections: ${digest.sections.length}`);
  console.log(`  Neighborhoods: ${neighborhoods}`);
  console.log(`\nWritten to: ${digestPath}`);
  console.log(`Archived to: ${archivePath}`);
  console.log(`\nNext: npm run build && git add -A && git commit -m "update digest" && git push`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
