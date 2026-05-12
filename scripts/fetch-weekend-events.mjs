#!/usr/bin/env node

/**
 * Weekend events fetcher — scrapes the AccessAtlanta (AJC) weekly weekend
 * roundup article, parses structured event data, and tags ITP neighborhoods.
 *
 * Discovery path:
 *   1. fetch /things-to-do/ (follows redirect to ajc.com)
 *   2. extract first /accessatl/YYYY/MM/[slug]/ link
 *   3. fetch the article
 *   4. parse each H2 (event name) + following two <p> (description, metadata)
 *
 * Output: src/data/weekend-events.json + weekend-events-YYYY-MM-DD.json
 */

import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const INDEX_URL = 'https://www.accessatlanta.com/things-to-do/';
const ROUNDUP_RE = /\/accessatl\/\d{4}\/\d{2}\/[a-z0-9-]+\//;

const neighborhoodsConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'data', 'neighborhoods.json'), 'utf-8'),
);
const ITP_NEIGHBORHOODS = neighborhoodsConfig.neighborhoods.map((n) => n.name);

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip, deflate, br' },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function findRoundupUrl() {
  const html = await fetchText(INDEX_URL);
  const match = html.match(ROUNDUP_RE);
  if (!match) throw new Error('No /accessatl/ roundup link found on index page');
  return new URL(match[0], 'https://www.accessatlanta.com').toString();
}

function matchITPNeighborhood(locationText) {
  // Location format is typically "Neighborhood - 123 Some St" or "City - ..."
  // Match against canonical ITP neighborhoods (longest first to avoid prefix collisions).
  // Normalize hyphens/spaces so "Virginia Highland" matches "Virginia-Highland".
  const normalize = (s) => s.toLowerCase().replace(/[-\s]+/g, ' ');
  const haystack = normalize(locationText);
  const candidates = [...ITP_NEIGHBORHOODS].sort((a, b) => b.length - a.length);
  for (const name of candidates) {
    const pattern = normalize(name).replace(/[\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const re = new RegExp(`\\b${pattern}\\b`);
    if (re.test(haystack)) return name;
  }
  return null;
}

function parseMetadataParagraph($, $p) {
  // The metadata paragraph has the shape:
  // <b>Location:</b> X <a>address</a>; <b>Date:</b> Y; <b>Admission</b>: Z; <b>Time:</b> T; <b>Website:</b> <a>W</a>
  // We walk children, splitting on ; into field segments anchored by <b> labels.
  const out = {
    location: '',
    locationUrl: null,
    date: '',
    admission: '',
    time: '',
    website: '',
    websiteUrl: null,
  };

  // Flatten the paragraph into ordered tokens: { kind: 'b'|'text'|'a', text, href? }
  const tokens = [];
  $p.contents().each((_, el) => {
    if (el.type === 'tag' && el.name === 'b') {
      tokens.push({ kind: 'b', text: $(el).text().trim() });
    } else if (el.type === 'tag' && el.name === 'a') {
      tokens.push({ kind: 'a', text: $(el).text().trim(), href: $(el).attr('href') || null });
    } else if (el.type === 'text') {
      tokens.push({ kind: 'text', text: el.data });
    } else {
      // unknown tag — fall back to text
      tokens.push({ kind: 'text', text: $(el).text() });
    }
  });

  // Walk tokens, group into fields between <b> labels.
  let currentLabel = null;
  let currentParts = [];
  let currentLinks = [];
  const fields = [];

  const flush = () => {
    if (currentLabel) {
      fields.push({ label: currentLabel, text: currentParts.join('').trim(), links: currentLinks });
    }
  };

  for (const tok of tokens) {
    if (tok.kind === 'b') {
      flush();
      currentLabel = tok.text.replace(/[:\s]+$/, '').toLowerCase();
      currentParts = [];
      currentLinks = [];
    } else if (tok.kind === 'a') {
      currentParts.push(tok.text);
      if (tok.href) currentLinks.push({ text: tok.text, href: tok.href });
    } else {
      currentParts.push(tok.text);
    }
  }
  flush();

  for (const f of fields) {
    // Strip leading punctuation (": " or " ") then trailing "; "
    const cleaned = f.text.replace(/^[:\s]+/, '').replace(/[;\s]+$/, '').trim();
    if (f.label === 'location') {
      out.location = cleaned;
      if (f.links[0]) out.locationUrl = f.links[0].href;
    } else if (f.label === 'date') {
      out.date = cleaned;
    } else if (f.label === 'admission') {
      out.admission = cleaned;
    } else if (f.label === 'time') {
      out.time = cleaned;
    } else if (f.label === 'website') {
      out.website = cleaned;
      if (f.links[0]) out.websiteUrl = f.links[0].href;
    }
  }
  return out;
}

function parseEvents(html, articleUrl) {
  const $ = cheerio.load(html);
  const ogImage = $('meta[property="og:image"]').attr('content') || null;
  const articleTitle = $('meta[property="og:title"]').attr('content') || $('title').text();

  // Paragraphs are split across multiple <article> tags (paywall placeholders),
  // so `nextAll` won't reach them. Walk in document order instead.
  const nodes = $('h2.font-worksans, p.font-primary').toArray();

  const events = [];
  let current = null;

  for (const node of nodes) {
    if (node.tagName === 'h2') {
      if (current && current.metaEl) {
        events.push(finalizeEvent($, current));
      }
      const name = $(node).text().trim();
      current = name ? { name, descEl: null, metaEl: null } : null;
    } else if (node.tagName === 'p' && current) {
      // Skip paragraphs that don't have a data-index (likely ads or other non-content).
      if (!$(node).attr('data-index')) continue;
      if (!current.descEl) current.descEl = node;
      else if (!current.metaEl) current.metaEl = node;
    }
  }
  if (current && current.metaEl) events.push(finalizeEvent($, current));

  return { ogImage, articleTitle, events };
}

function finalizeEvent($, ev) {
  const desc = ev.descEl ? $(ev.descEl).text().trim() : '';
  const fields = parseMetadataParagraph($, $(ev.metaEl));
  const itpNeighborhood = matchITPNeighborhood(fields.location);
  return {
    name: ev.name,
    description: desc,
    ...fields,
    itpNeighborhood,
  };
}

function sundayOfWeek(d = new Date()) {
  const out = new Date(d);
  const dow = out.getDay();
  out.setDate(out.getDate() - dow + (dow === 0 ? 0 : 7)); // upcoming Sunday (or today if Sunday)
  return out;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('Atlanta Weekend Events — fetching from AccessAtlanta\n');

  const articleUrl = await findRoundupUrl();
  console.log(`  Roundup: ${articleUrl}`);

  const html = await fetchText(articleUrl);
  const { ogImage, articleTitle, events } = parseEvents(html, articleUrl);

  console.log(`  Parsed ${events.length} events`);
  const itpCount = events.filter((e) => e.itpNeighborhood).length;
  console.log(`  ITP-tagged: ${itpCount}\n`);

  for (const e of events) {
    const tag = e.itpNeighborhood ? `[${e.itpNeighborhood}]` : '   ';
    console.log(`  ${tag} ${e.name} — ${e.date || '(no date)'}`);
  }

  const today = new Date();
  const weekOf = isoDate(sundayOfWeek(today));
  const data = {
    weekOf,
    fetchedAt: today.toISOString(),
    source: {
      name: 'AccessAtlanta',
      url: articleUrl,
      title: articleTitle,
      ogImage,
    },
    events,
  };

  const latestPath = path.join(ROOT, 'src', 'data', 'weekend-events.json');
  const archivePath = path.join(ROOT, 'src', 'data', `weekend-events-${weekOf}.json`);
  fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
  fs.writeFileSync(archivePath, JSON.stringify(data, null, 2));

  console.log(`\nWritten:`);
  console.log(`  ${latestPath}`);
  console.log(`  ${archivePath}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
