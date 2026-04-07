#!/usr/bin/env node

/**
 * Download and optimize images from non-digest content files
 * (guides, lists, pinned stories)
 *
 * Saves to public/images/content/ with SEO-friendly filenames.
 * Updates the JSON files to reference local paths.
 *
 * Usage: node scripts/download-content-images.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'content');
const TIMEOUT = 15000;
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 82;

fs.mkdirSync(IMAGE_DIR, { recursive: true });

function isRemoteUrl(url) {
  return url && typeof url === 'string' && url.startsWith('http');
}

let counter = 0;

/**
 * Generate a clean filename from a slug + context.
 */
function makeFilename(slug, index) {
  return `${slug}${index > 0 ? `-${index}` : ''}.webp`;
}

async function downloadAndConvert(url, filename) {
  const outputPath = path.join(IMAGE_DIR, filename);

  if (fs.existsSync(outputPath)) {
    return `/images/content/${filename}`;
  }

  // Delay between requests to avoid rate limiting (Wikimedia)
  await new Promise(r => setTimeout(r, 2000));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AtlantaNewsBot/1.0)',
        'Accept': 'image/webp,image/avif,image/png,image/jpeg,image/*,*/*',
      },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`    ⚠ HTTP ${response.status}: ${filename}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    await sharp(buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(outputPath);

    const sizeKB = Math.round(fs.statSync(outputPath).size / 1024);
    console.log(`    ✓ ${filename} (${sizeKB}KB)`);
    counter++;

    return `/images/content/${filename}`;
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'timeout' : err.message;
    console.log(`    ⚠ ${filename}: ${msg}`);
    return null;
  }
}

async function processGuides() {
  const filePath = path.join(DATA_DIR, 'guides.json');
  if (!fs.existsSync(filePath)) return;

  console.log('  Processing guides.json...');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  for (const guide of data.guides) {
    if (!guide.sections) continue;
    for (let i = 0; i < guide.sections.length; i++) {
      const section = guide.sections[i];
      if (!isRemoteUrl(section.imageUrl)) continue;

      const filename = makeFilename(guide.slug, i);
      const localPath = await downloadAndConvert(section.imageUrl, filename);
      if (localPath) {
        section.originalImageUrl = section.imageUrl;
        section.imageUrl = localPath;
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

async function processLists() {
  const filePath = path.join(DATA_DIR, 'lists.json');
  if (!fs.existsSync(filePath)) return;

  console.log('  Processing lists.json...');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  for (const list of data.lists) {
    // Hero image
    if (isRemoteUrl(list.imageUrl)) {
      const filename = makeFilename(list.slug, 0);
      const localPath = await downloadAndConvert(list.imageUrl, filename);
      if (localPath) {
        list.originalImageUrl = list.imageUrl;
        list.imageUrl = localPath;
      }
    }
    // Section images
    if (!list.items) continue;
    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i];
      if (!isRemoteUrl(item.imageUrl)) continue;

      const filename = makeFilename(list.slug, i + 1);
      const localPath = await downloadAndConvert(item.imageUrl, filename);
      if (localPath) {
        item.originalImageUrl = item.imageUrl;
        item.imageUrl = localPath;
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

async function processPinnedStories() {
  const filePath = path.join(DATA_DIR, 'pinned-stories.json');
  if (!fs.existsSync(filePath)) return;

  console.log('  Processing pinned-stories.json...');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  for (const story of data) {
    if (!isRemoteUrl(story.imageUrl)) continue;

    const filename = makeFilename(story.id, 0);
    const localPath = await downloadAndConvert(story.imageUrl, filename);
    if (localPath) {
      story.originalImageUrl = story.imageUrl;
      story.imageUrl = localPath;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

async function run() {
  console.log('\nAtlanta News & Talk — Content Image Optimization\n');

  await processGuides();
  await processLists();
  await processPinnedStories();

  const imageCount = fs.readdirSync(IMAGE_DIR).filter(f => f.endsWith('.webp')).length;
  const totalSize = fs.readdirSync(IMAGE_DIR)
    .filter(f => f.endsWith('.webp'))
    .reduce((sum, f) => sum + fs.statSync(path.join(IMAGE_DIR, f)).size, 0);
  const totalMB = (totalSize / (1024 * 1024)).toFixed(1);

  console.log(`\n  Done. ${counter} new images downloaded.`);
  console.log(`  ${imageCount} total images in /public/images/content/ (${totalMB}MB)\n`);
}

run().catch(err => {
  console.error('Content image download failed:', err.message);
  process.exit(1);
});
