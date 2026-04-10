#!/usr/bin/env node
/**
 * Pre-deploy image check
 * Verifies all referenced images exist in public/
 * Run before build to catch missing images early
 */

import fs from 'fs';
import path from 'path';

const missing = [];
const checked = new Set();

function checkImage(imageUrl, source, context) {
  if (!imageUrl || checked.has(imageUrl)) return;
  checked.add(imageUrl);

  const localPath = path.join('public', imageUrl);
  if (!fs.existsSync(localPath)) {
    missing.push({ url: imageUrl, source, context, reason: 'missing' });
    return;
  }

  // Check if the file is actually an image (not an HTML error page)
  const buffer = fs.readFileSync(localPath, { encoding: null, flag: 'r' });
  const header = buffer.slice(0, 20).toString('utf8');
  if (header.includes('<!DOCTYPE') || header.includes('<html')) {
    missing.push({ url: imageUrl, source, context, reason: 'invalid (HTML error page)' });
  }
}

// Check guides
const guides = JSON.parse(fs.readFileSync('src/data/guides.json', 'utf8'));
for (const guide of guides.guides) {
  for (const section of guide.sections || []) {
    if (section.imageUrl) {
      checkImage(section.imageUrl, section.originalImageUrl, `guides: ${guide.slug}`);
    }
  }
}

// Check lists
const lists = JSON.parse(fs.readFileSync('src/data/lists.json', 'utf8'));
for (const list of lists.lists) {
  if (list.imageUrl) {
    checkImage(list.imageUrl, list.originalImageUrl, `lists: ${list.slug}`);
  }
}

// Check pinned stories
const pinned = JSON.parse(fs.readFileSync('src/data/pinned-stories.json', 'utf8'));
for (const story of pinned) {
  if (story.imageUrl) {
    checkImage(story.imageUrl, story.originalImageUrl, `pinned: ${story.id}`);
  }
}

// Check all digest files
const digestFiles = fs.readdirSync('src/data').filter(f => f.match(/^digest-.*\.json$/));
for (const file of digestFiles) {
  const digest = JSON.parse(fs.readFileSync(path.join('src/data', file), 'utf8'));
  const stories = [digest.topStory, ...(digest.sections?.flatMap(s => s.stories) || [])].filter(Boolean);
  for (const story of stories) {
    if (story.imageUrl) {
      checkImage(story.imageUrl, story.originalImageUrl, `${file}: ${story.id}`);
    }
  }
}

// Report results
console.log('\n📸 Image Check Results\n');
console.log(`Checked: ${checked.size} unique image references`);

if (missing.length > 0) {
  console.log(`\n❌ PROBLEMS: ${missing.length} images\n`);
  missing.forEach(m => {
    console.log(`  ${m.url}`);
    console.log(`    Problem: ${m.reason || 'missing'}`);
    console.log(`    Context: ${m.context}`);
    if (m.source) console.log(`    Source:  ${m.source}`);
    console.log('');
  });
  process.exit(1);
} else {
  console.log('\n✅ All images present!\n');
  process.exit(0);
}
