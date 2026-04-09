#!/usr/bin/env node

/**
 * Download and optimize story images
 *
 * Reads digest-latest.json (and all archived digests), downloads each story's
 * remote image, converts to WebP, and saves locally with SEO-friendly filenames.
 * Updates the digest JSON files to reference local paths.
 *
 * Run after digest generation, before `npm run build`.
 *
 * Usage: node scripts/download-images.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'stories');
const TIMEOUT = 15000;
const MAX_WIDTH = 1200;
const WEBP_QUALITY = 82;

// Ensure output directory exists
fs.mkdirSync(IMAGE_DIR, { recursive: true });

function isRemoteUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

function isLocalImage(url) {
  return url && url.startsWith('/images/stories/');
}

/**
 * Generate a clean, SEO-friendly filename from the story ID.
 * Story IDs are already slugified (e.g. "angel-reese-traded-atlanta-dream-2026").
 */
function imageFilename(storyId) {
  return `${storyId}.webp`;
}

/**
 * Download a remote image and convert to optimized WebP.
 * Returns the local path on success, null on failure.
 */
async function downloadAndConvert(url, storyId) {
  const filename = imageFilename(storyId);
  const outputPath = path.join(IMAGE_DIR, filename);

  // Skip if already downloaded
  if (fs.existsSync(outputPath)) {
    return `/images/stories/${filename}`;
  }

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
      console.log(`    ⚠ HTTP ${response.status}: ${storyId}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
      // Some CDNs return video streams or HTML — skip those
      console.log(`    ⚠ Not an image (${contentType}): ${storyId}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Convert to WebP with sharp
    await sharp(buffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`    ✓ ${filename} (${sizeKB}KB)`);

    return `/images/stories/${filename}`;
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'timeout' : err.message;
    console.log(`    ⚠ ${storyId}: ${msg}`);
    return null;
  }
}

/**
 * Process all stories in a digest, downloading images and updating URLs.
 * Returns the number of images downloaded.
 */
async function processDigest(digestPath) {
  const digest = JSON.parse(fs.readFileSync(digestPath, 'utf-8'));
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  const allStories = [digest.topStory, ...digest.sections.flatMap(s => s.stories)].filter(Boolean);

  for (const story of allStories) {
    if (!story.imageUrl && !story.originalImageUrl) {
      skipped++;
      continue;
    }

    // Check if local image exists
    if (isLocalImage(story.imageUrl)) {
      const localFile = path.join(process.cwd(), 'public', story.imageUrl);
      if (fs.existsSync(localFile)) {
        // File exists, skip
        continue;
      }
      // Local path set but file missing - try to re-download from original
      if (story.originalImageUrl && isRemoteUrl(story.originalImageUrl)) {
        const localPath = await downloadAndConvert(story.originalImageUrl, story.id);
        if (localPath) {
          downloaded++;
        } else {
          story.imageUrl = null;
          failed++;
        }
      } else {
        // No original URL to re-download from
        story.imageUrl = null;
        failed++;
      }
      continue;
    }

    if (!isRemoteUrl(story.imageUrl)) {
      skipped++;
      continue;
    }

    const localPath = await downloadAndConvert(story.imageUrl, story.id);
    if (localPath) {
      // Store original URL for attribution, update imageUrl to local
      story.originalImageUrl = story.imageUrl;
      story.imageUrl = localPath;
      downloaded++;
    } else {
      // Clear broken image URLs so components show fallback
      story.originalImageUrl = story.imageUrl;
      story.imageUrl = null;
      failed++;
    }
  }

  // Write updated digest back
  fs.writeFileSync(digestPath, JSON.stringify(digest, null, 2) + '\n');

  return { downloaded, skipped, failed, total: allStories.length };
}

async function run() {
  console.log('\nAtlanta News & Talk — Image Optimization\n');

  // Process digest-latest.json first
  const latestPath = path.join(DATA_DIR, 'digest-latest.json');
  if (!fs.existsSync(latestPath)) {
    console.log('No digest-latest.json found. Run summarization first.');
    process.exit(1);
  }

  console.log('  Processing digest-latest.json...');
  const latestResult = await processDigest(latestPath);
  console.log(`  → ${latestResult.downloaded} downloaded, ${latestResult.failed} failed, ${latestResult.total - latestResult.downloaded - latestResult.failed} skipped\n`);

  // Process all archived digests
  const archiveFiles = fs.readdirSync(DATA_DIR)
    .filter(f => /^digest-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();

  let totalDownloaded = latestResult.downloaded;
  let totalFailed = latestResult.failed;

  for (const file of archiveFiles) {
    const filePath = path.join(DATA_DIR, file);
    const digest = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const stories = [digest.topStory, ...digest.sections.flatMap(s => s.stories)].filter(Boolean);

    // Check if any images need downloading (remote URLs or missing local files)
    const needsProcessing = stories.some(s => {
      if (isRemoteUrl(s.imageUrl)) return true;
      if (isLocalImage(s.imageUrl)) {
        const localFile = path.join(process.cwd(), 'public', s.imageUrl);
        return !fs.existsSync(localFile);
      }
      return false;
    });

    if (!needsProcessing) continue; // All images already local and exist

    console.log(`  Processing ${file}...`);
    const result = await processDigest(filePath);
    totalDownloaded += result.downloaded;
    totalFailed += result.failed;
    if (result.downloaded > 0 || result.failed > 0) {
      console.log(`  → ${result.downloaded} downloaded, ${result.failed} failed`);
    }
  }

  // Summary
  const imageCount = fs.readdirSync(IMAGE_DIR).filter(f => f.endsWith('.webp')).length;
  const totalSize = fs.readdirSync(IMAGE_DIR)
    .filter(f => f.endsWith('.webp'))
    .reduce((sum, f) => sum + fs.statSync(path.join(IMAGE_DIR, f)).size, 0);
  const totalMB = (totalSize / (1024 * 1024)).toFixed(1);

  console.log(`\n  Done. ${imageCount} images in /public/images/stories/ (${totalMB}MB total)`);
  if (totalFailed > 0) {
    console.log(`  ⚠ ${totalFailed} images could not be downloaded`);
  }
  console.log();
}

run().catch(err => {
  console.error('Image download failed:', err.message);
  process.exit(1);
});
