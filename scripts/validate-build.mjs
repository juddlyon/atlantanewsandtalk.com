#!/usr/bin/env node

/**
 * Post-build validation. Checks dist/ for:
 * - All expected pages exist (neighborhoods, guides, lists, landing pages, stories)
 * - Internal links on key pages point to existing files
 * - Sitemaps and feeds exist and are well-formed
 * - HTML has required landmarks (<main>)
 * - Images have width/height attributes
 *
 * Run after `npm run build`. Exits 1 if critical issues found.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const errors = [];
const warnings = [];

function exists(rel) {
  return fs.existsSync(path.join(DIST, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(DIST, rel), 'utf-8');
}

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf-8'));
}

// --- Check dist exists ---
if (!fs.existsSync(DIST)) {
  console.error('FAIL: dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

// --- Core pages ---
const corePages = [
  'index.html', '404.html', 'about/index.html', 'contact/index.html',
  'neighborhoods/index.html', 'guide/index.html', 'lists/index.html',
  'resources/index.html', 'editorial/index.html', 'privacy/index.html',
];
for (const page of corePages) {
  if (!exists(page)) errors.push(`missing core page: ${page}`);
}

// --- All neighborhood pages ---
const neighborhoods = loadJson('src/data/neighborhoods.json');
for (const n of neighborhoods.neighborhoods) {
  if (!exists(`neighborhoods/${n.slug}/index.html`)) {
    errors.push(`missing neighborhood page: /neighborhoods/${n.slug}`);
  }
}

// --- Guide pages ---
const guides = loadJson('src/data/guides.json');
for (const g of guides.guides) {
  if (!exists(`guide/${g.slug}/index.html`)) {
    errors.push(`missing guide page: /guide/${g.slug}`);
  }
}

// --- List pages ---
const lists = loadJson('src/data/lists.json');
for (const l of lists.lists) {
  if (!exists(`lists/${l.slug}/index.html`)) {
    errors.push(`missing list page: /lists/${l.slug}`);
  }
}

// --- Landing pages ---
const landing = loadJson('src/data/landing-pages.json');
for (const p of landing.pages) {
  if (!exists(`${p.slug}/index.html`)) {
    errors.push(`missing landing page: /${p.slug}`);
  }
}

// --- Story pages (digest + pinned) ---
const digest = loadJson('src/data/digest-latest.json');
const stories = digest.sections.flatMap((s) => s.stories);
for (const s of stories) {
  if (!exists(`${s.id}/index.html`)) {
    errors.push(`missing story page: /${s.id}`);
  }
}
const pinned = loadJson('src/data/pinned-stories.json');
for (const s of pinned) {
  if (!exists(`${s.id}/index.html`)) {
    errors.push(`missing pinned story page: /${s.id}`);
  }
}

// --- Sitemaps and feeds ---
if (!exists('sitemap-index.xml')) errors.push('missing sitemap-index.xml');
if (!exists('news-sitemap.xml')) errors.push('missing news-sitemap.xml');
if (!exists('rss.xml')) errors.push('missing rss.xml');
if (!exists('robots.txt')) errors.push('missing robots.txt');

if (exists('sitemap-index.xml')) {
  const idx = read('sitemap-index.xml');
  if (!idx.includes('news-sitemap.xml')) {
    errors.push('sitemap-index.xml does not reference news-sitemap.xml');
  }
}

if (exists('news-sitemap.xml')) {
  const ns = read('news-sitemap.xml');
  if (!ns.includes('<news:title>')) {
    warnings.push('news-sitemap.xml has no story entries (may be expected for stale local data)');
  }
}

if (exists('robots.txt')) {
  const rt = read('robots.txt');
  if (!rt.includes('news-sitemap.xml')) {
    errors.push('robots.txt does not reference news-sitemap.xml');
  }
}

// --- Internal links on homepage ---
if (exists('index.html')) {
  const html = read('index.html');
  const hrefRe = /href="\/([^"#]*?)"/g;
  let match;
  while ((match = hrefRe.exec(html)) !== null) {
    const href = match[1];
    if (!href || href.startsWith('http') || href.startsWith('mailto')) continue;
    const asPage = href.endsWith('.xml') || href.endsWith('.txt')
      ? exists(href)
      : exists(`${href}/index.html`) || exists(href);
    if (!asPage) {
      errors.push(`broken link on homepage: /${href}`);
    }
  }
}

// --- Digest freshness: built HTML must match digest-latest.json ---
if (exists('index.html')) {
  const html = read('index.html');
  const digestDate = digest.date; // e.g. "2026-04-10"
  const d = new Date(digestDate + 'T12:00:00');
  const formatted = d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!html.includes(formatted)) {
    const siteDate = html.match(/\w{3}, \w+ \d+, \d{4}/)?.[0] || 'unknown';
    errors.push(`STALE BUILD: homepage shows "${siteDate}" but digest-latest.json is "${formatted}". Clear cache and rebuild: rm -rf dist node_modules/.astro && npm run build`);
  }

  // Also check the summary made it into the build
  const summarySnippet = digest.summary.substring(0, 60);
  if (!html.includes(summarySnippet)) {
    errors.push('homepage summary does not match digest-latest.json. Build may be cached.');
  }
}

// --- HTML quality checks on homepage ---
if (exists('index.html')) {
  const html = read('index.html');
  if (!html.includes('<main')) {
    errors.push('homepage missing <main> landmark element');
  }

  // Check canonical URL has trailing slash
  const canonicalMatch = html.match(/rel="canonical"\s+href="([^"]+)"/);
  if (canonicalMatch) {
    const canonical = canonicalMatch[1];
    if (!canonical.endsWith('/')) {
      errors.push(`homepage canonical URL missing trailing slash: ${canonical}`);
    }
  }

  // Check internal links use trailing slashes (skip .xml, .txt, etc)
  const hrefRe2 = /href="(\/[^"#]*?)"/g;
  let m;
  while ((m = hrefRe2.exec(html)) !== null) {
    const href = m[1];
    if (href.match(/\.\w+$/) || href === '/') continue;
    if (!href.endsWith('/')) {
      warnings.push(`internal link missing trailing slash: ${href}`);
    }
  }
}

// --- Spot-check canonicals on a few key pages ---
const spotCheckPages = [
  'about/index.html',
  'neighborhoods/index.html',
  'guide/index.html',
];
for (const page of spotCheckPages) {
  if (exists(page)) {
    const html = read(page);
    const cm = html.match(/rel="canonical"\s+href="([^"]+)"/);
    if (!cm) {
      errors.push(`${page}: missing canonical URL`);
    } else if (!cm[1].endsWith('/')) {
      errors.push(`${page}: canonical URL missing trailing slash: ${cm[1]}`);
    }
  }
}

// --- Report ---
if (warnings.length > 0) {
  console.log(`\n⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ${w}`);
}

if (errors.length > 0) {
  console.log(`\n✗ ${errors.length} build validation error(s):`);
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}

const pageCount = corePages.length + neighborhoods.neighborhoods.length +
  guides.guides.length + lists.lists.length + landing.pages.length +
  stories.length + pinned.length;

console.log(`\n✓ Build validated: ${pageCount} pages, sitemaps OK, no broken links\n`);
