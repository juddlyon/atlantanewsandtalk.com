#!/usr/bin/env node

/**
 * Ping IndexNow (Bing, Yandex) with recently updated URLs.
 * Run after deploy to notify search engines of new content.
 *
 * Usage: node scripts/ping-indexnow.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://atlantanewsandtalk.com';
const KEY = 'ec29ce55cdeac6d36341';

// Collect URLs from latest digest
const digestPath = path.join(__dirname, '..', 'src', 'data', 'digest-latest.json');
const urls = [SITE]; // always include homepage

if (fs.existsSync(digestPath)) {
  const digest = JSON.parse(fs.readFileSync(digestPath, 'utf-8'));
  const stories = [];

  if (digest.topStory) stories.push(digest.topStory);
  for (const section of (digest.sections || [])) {
    for (const story of (section.stories || [])) {
      stories.push(story);
    }
  }

  for (const story of stories) {
    if (story.id) urls.push(`${SITE}/${story.id}`);
  }
}

// Add key evergreen pages
urls.push(`${SITE}/guide/fifa-world-cup-atlanta-2026`);
urls.push(`${SITE}/atlanta-news-today`);
urls.push(`${SITE}/neighborhoods`);

console.log(`Pinging IndexNow with ${urls.length} URLs...`);

try {
  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: 'atlantanewsandtalk.com',
      key: KEY,
      keyLocation: `${SITE}/${KEY}.txt`,
      urlList: urls,
    }),
  });

  console.log(`IndexNow response: ${res.status} ${res.statusText}`);
  if (res.status === 200 || res.status === 202) {
    console.log('IndexNow ping successful');
  } else {
    const body = await res.text();
    console.log('Response:', body);
  }
} catch (err) {
  console.error('IndexNow ping failed:', err.message);
}
