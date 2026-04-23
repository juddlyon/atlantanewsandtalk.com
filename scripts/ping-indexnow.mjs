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
const urls = new Set();
urls.add(`${SITE}/`); // homepage

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
    if (story.id) urls.add(`${SITE}/${story.id}/`);
    // Also ping neighborhood pages that got new stories today
    const hoods = (story.neighborhoods && story.neighborhoods.length) ? story.neighborhoods : (story.neighborhood ? [story.neighborhood] : []);
    for (const n of hoods) {
      const slug = n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (slug) urls.add(`${SITE}/neighborhoods/${slug}/`);
    }
  }

  // Archive page for today's digest
  if (digest.date) urls.add(`${SITE}/archive/${digest.date}/`);
}

// Evergreen hubs and feeds Google/Bing should recrawl daily
urls.add(`${SITE}/archive/`);
urls.add(`${SITE}/neighborhoods/`);
urls.add(`${SITE}/rss.xml`);
urls.add(`${SITE}/news-sitemap.xml`);
urls.add(`${SITE}/sitemap-index.xml`);
urls.add(`${SITE}/atlanta-news-today/`);
urls.add(`${SITE}/guide/fifa-world-cup-atlanta-2026/`);

const urlList = [...urls];
console.log(`Pinging IndexNow with ${urlList.length} URLs...`);

try {
  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: 'atlantanewsandtalk.com',
      key: KEY,
      keyLocation: `${SITE}/${KEY}.txt`,
      urlList,
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
