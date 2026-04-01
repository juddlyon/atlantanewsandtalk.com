#!/usr/bin/env node

/**
 * Validate and clean digest-latest.json before build.
 * Drops stories with invalid neighborhoods, violent crime content,
 * duplicate IDs, or missing required fields. Writes cleaned digest back.
 * Exit 1 only if the digest is completely unusable (no stories survive).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIGEST_PATH = path.join(__dirname, '..', 'src', 'data', 'digest-latest.json');

const ITP_NEIGHBORHOODS = [
  'Old Fourth Ward', 'Grant Park', 'Reynoldstown', 'Cabbagetown', 'Inman Park',
  'Summerhill', 'East Atlanta Village', 'Ormewood Park',
  'Kirkwood', 'Edgewood', 'Little Five Points', 'Candler Park', 'Poncey-Highland',
  'Decatur', 'East Atlanta', 'Peoplestown', 'Chosewood Park', 'Sweet Auburn',
  'Midtown', 'Downtown', 'Virginia-Highland', 'Morningside', 'Druid Hills',
  'Ansley Park', 'Piedmont Heights', 'West Midtown', 'Westside', 'West End',
  'Buckhead', 'Castleberry Hill', 'Home Park', 'Atlantic Station', 'Collier Hills',
  'Bolton', 'Grove Park', 'Capitol View', 'Adair Park', 'Oakland City',
  'Mechanicsville', 'Lakewood Heights', 'Sylvan Hills', 'Pittsburgh',
];

// Matches against headline + summary (case-insensitive)
const CRIME_PATTERNS = [
  /\bmurder(?:ed|s|ing)?\b/i,
  /\bhomicide\b/i,
  /\bkill(?:ed|ing|s)\b/i,
  /\bstabb(?:ed|ing)\b/i,
  /\brape[ds]?\b/i,
  /\bsexual\s+assault/i,
  /\bchild\s+abuse\b/i,
  /\bfatal\s+shoot/i,
  /\bshot\s+(?:and\s+)?kill/i,
  /\bman\s+(?:found\s+)?dead\b/i,
  /\bwoman\s+(?:found\s+)?dead\b/i,
  /\bchild\s+(?:found\s+)?dead\b/i,
  /\bbody\s+found\b/i,
  /\bdead\s+(?:at|in|on|near)\b/i,
];

const BANNED_WORDS_RE = [
  /\bvibrant\b/gi,
  /\bbustling\b/gi,
  /\bnestled\b/gi,
  /\btapestry\b/gi,
  /\bdelves\b/gi,
  /it's worth noting/gi,
];

const REQUIRED_FIELDS = ['id', 'headline', 'summary', 'neighborhood', 'source', 'sourceUrl', 'publishedAt'];

const dropped = [];
const warnings = [];

// --- Load digest ---

if (!fs.existsSync(DIGEST_PATH)) {
  console.error('FAIL: digest-latest.json not found');
  process.exit(1);
}

let digest;
try {
  digest = JSON.parse(fs.readFileSync(DIGEST_PATH, 'utf-8'));
} catch (e) {
  console.error(`FAIL: digest-latest.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

// --- Top-level fields ---

if (!digest.date || !digest.generatedAt || !digest.summary) {
  console.error('FAIL: digest missing required top-level fields (date, generatedAt, summary)');
  process.exit(1);
}

if (!Array.isArray(digest.sections) || digest.sections.length === 0) {
  console.error('FAIL: digest has no sections');
  process.exit(1);
}

// --- Story filter ---

function shouldDrop(story) {
  const label = story.id || story.headline || '(unknown)';

  // Missing required fields
  for (const field of REQUIRED_FIELDS) {
    if (!story[field] || (typeof story[field] === 'string' && !story[field].trim())) {
      dropped.push(`[${label}] missing "${field}"`);
      return true;
    }
  }

  // Invalid neighborhood
  if (!ITP_NEIGHBORHOODS.includes(story.neighborhood)) {
    dropped.push(`[${label}] invalid neighborhood "${story.neighborhood}"`);
    return true;
  }

  // Violent crime content
  const text = `${story.headline} ${story.summary}`;
  for (const pattern of CRIME_PATTERNS) {
    if (pattern.test(text)) {
      dropped.push(`[${label}] matched crime filter (${pattern.source})`);
      return true;
    }
  }

  // Bad source URL
  if (!story.sourceUrl.startsWith('http')) {
    dropped.push(`[${label}] bad sourceUrl "${story.sourceUrl}"`);
    return true;
  }

  return false;
}

// --- Clean sections ---

const seenIds = new Set();

for (const section of digest.sections) {
  if (!section.stories) continue;
  section.stories = section.stories.filter((story) => {
    if (shouldDrop(story)) return false;

    // Deduplicate by ID
    if (seenIds.has(story.id)) {
      dropped.push(`[${story.id}] duplicate id`);
      return false;
    }
    seenIds.add(story.id);

    // Clean invalid entries from neighborhoods array
    if (Array.isArray(story.neighborhoods)) {
      const before = story.neighborhoods.length;
      story.neighborhoods = story.neighborhoods.filter((n) => ITP_NEIGHBORHOODS.includes(n));
      if (story.neighborhoods.length < before) {
        warnings.push(`[${story.id}] removed invalid entries from neighborhoods array`);
      }
    }

    return true;
  });
}

// Remove empty sections
digest.sections = digest.sections.filter((s) => s.stories && s.stories.length > 0);

// --- Auto-clean text issues ---

function cleanText(text) {
  let cleaned = text;
  // Replace em dashes with comma or period depending on context
  cleaned = cleaned.replace(/\s*—\s*/g, ', ');
  // Strip banned words (replace with simpler alternatives)
  for (const pattern of BANNED_WORDS_RE) {
    if (pattern.test(cleaned)) {
      warnings.push(`cleaned banned word "${pattern.source}" from text`);
      cleaned = cleaned.replace(pattern, '');
      // Clean up double spaces left behind
      cleaned = cleaned.replace(/  +/g, ' ').trim();
    }
  }
  return cleaned;
}

for (const section of digest.sections) {
  for (const story of section.stories) {
    const origH = story.headline;
    const origS = story.summary;
    const origB = story.body;
    story.headline = cleanText(story.headline);
    story.summary = cleanText(story.summary);
    story.body = cleanText(story.body);
    if (story.headline !== origH || story.summary !== origS || story.body !== origB) {
      warnings.push(`[${story.id}] auto-cleaned text (em dashes / banned words)`);
    }
  }
}
if (digest.summary) {
  digest.summary = cleanText(digest.summary);
}

// --- Source diversity: max 1 story per source ---

const seenSources = new Set();
if (digest.topStory) {
  seenSources.add(digest.topStory.source);
}
for (const section of digest.sections) {
  section.stories = section.stories.filter((story) => {
    if (seenSources.has(story.source)) {
      dropped.push(`[${story.id}] duplicate source "${story.source}"`);
      return false;
    }
    seenSources.add(story.source);
    return true;
  });
}
digest.sections = digest.sections.filter((s) => s.stories && s.stories.length > 0);

// --- Fix topStory if it was dropped ---

if (digest.topStory) {
  if (shouldDrop(digest.topStory) || !seenIds.has(digest.topStory.id)) {
    // Promote first story from first section
    const firstStory = digest.sections[0]?.stories?.[0];
    if (firstStory) {
      digest.topStory = firstStory;
      warnings.push(`topStory replaced with "${firstStory.id}"`);
    } else {
      delete digest.topStory;
      warnings.push('topStory removed, no replacement available');
    }
  }
}

// --- Count surviving stories ---

const storyCount = digest.sections.reduce((n, s) => n + s.stories.length, 0);

if (storyCount === 0) {
  console.error('FAIL: all stories were dropped, nothing to publish');
  process.exit(1);
}

// --- Write cleaned digest ---

const changed = dropped.length > 0 || warnings.length > 0;

if (dropped.length > 0) {
  console.log(`\n✂ Dropped ${dropped.length} story/stories:`);
  for (const d of dropped) console.log(`  ${d}`);
}

if (warnings.length > 0) {
  console.log(`\n⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ${w}`);
}

if (changed) {
  fs.writeFileSync(DIGEST_PATH, JSON.stringify(digest, null, 2) + '\n');
  console.log(`\n✓ Cleaned digest: ${storyCount} stories, ${digest.sections.length} sections (was ${storyCount + dropped.length})\n`);
} else {
  console.log(`\n✓ Digest clean: ${storyCount} stories, ${digest.sections.length} sections\n`);
}
