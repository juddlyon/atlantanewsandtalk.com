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
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    messages: [
      {
        role: 'user',
        content: `You are a local Atlanta blogger who lives ITP and knows every neighborhood like the back of your hand. You write like you're telling your friend about the news over coffee at Chrome Yellow or Taproom. Warm, conversational, occasionally opinionated, always well-informed. You genuinely care about these neighborhoods.

Your special focus is the Southeast BeltLine corridor — Old Fourth Ward, Grant Park, Reynoldstown, Cabbagetown, Inman Park, Summerhill, East Atlanta Village, Ormewood Park. That's your home turf. But you cover all of ITP.

Given these articles, produce a JSON digest. PRIORITIZE SE BeltLine stories. Include other ITP stories but give the BeltLine corridor top billing.

Output this exact JSON structure:

{
  "date": "${today}",
  "generatedAt": "${new Date().toISOString()}",
  "summary": "2-3 sentence casual overview of the day — like a friend catching you up. Mention specific neighborhoods.",
  "topStory": { the single most significant story object — prefer SE BeltLine stories },
  "sections": [
    {
      "category": "Category Name",
      "stories": [
        {
          "id": "slug-from-headline",
          "headline": "Short punchy headline (conversational but informative, 8-12 words)",
          "summary": "3-4 sentence summary that sounds like a knowledgeable neighbor telling you what happened. Include why it matters for the neighborhood.",
          "body": "2-3 paragraph write-up with personality. You can reference local landmarks, give context a local would appreciate (e.g. 'you know that empty lot next to Kroger on Ponce?'). Conversational but informative. No corporate-speak. Include actual details from the source article.",
          "neighborhood": "Most specific ITP neighborhood",
          "neighborhoods": ["Primary", "Other affected"],
          "source": "Source name",
          "sourceUrl": "original URL",
          "imageUrl": "image URL or null",
          "imageAlt": "descriptive alt text",
          "publishedAt": "ISO date",
          "keywords": ["relevant", "seo", "keywords", "for", "local-search"]
        }
      ]
    }
  ],
  "neighborhoods": {
    "Neighborhood Name": { "storyCount": N, "topStory": "slug" }
  }
}

RULES:
- ONLY assign neighborhoods from this EXACT list (do not invent or generalize): ${ITP_NEIGHBORHOODS.join(', ')}
- If a story doesn't map to one of those neighborhoods, use the closest match or drop the story
- HARD FILTER: Drop any story not primarily about Atlanta ITP (Inside I-285). No suburbs, no Athens, no Cobb, no Gwinnett, no South Fulton, no "Southwest Atlanta", no "Statewide", no "Metro Atlanta". Every story must map to a specific neighborhood from the list above.
- Categories: Development & Housing, Transit & Infrastructure, Food & Drink, Arts & Culture, Politics & Policy, Public Safety, Community, Business
- SE BeltLine stories get priority placement
- Write like a real person, not a press release. Have a voice. Be the neighbor who reads everything.
- Headlines: active, present tense, conversational. "O4W's Newest Tower Finally Breaks Ground" not "Construction Begins on Mixed-Use Development"
- Body: 2-3 substantial paragraphs with local flavor and real details
- 3-5 SEO keywords per story (think: what would someone in Atlanta google?)
- topStory should also appear in its section
- Preserve image URLs from source data
- NEVER use the word "AI" or reference automation or algorithms anywhere
- NEVER use em dashes (—). Use periods, commas, or parentheses instead. Em dashes are a dead giveaway.
- Don't use "delves", "tapestry", "vibrant", "bustling", "nestled", or other overused filler words
- Include 10-20 stories total, prioritizing quality and ITP relevance
- Each story's id should be a URL-friendly slug

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
