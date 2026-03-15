#!/usr/bin/env node

/**
 * Rollback the digest to a previous date's version.
 *
 * Usage:
 *   node scripts/rollback.mjs              # list available digests
 *   node scripts/rollback.mjs 2026-03-13   # rollback to specific date
 *   node scripts/rollback.mjs latest       # show current digest date
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'src', 'data');

const target = process.argv[2];

// List available digests
const files = fs.readdirSync(DATA_DIR)
  .filter(f => f.startsWith('digest-') && f !== 'digest-latest.json')
  .sort()
  .reverse();

if (!target) {
  console.log('Available digest archives:\n');
  if (files.length === 0) {
    console.log('  (none yet)');
  } else {
    files.forEach(f => {
      const date = f.replace('digest-', '').replace('.json', '');
      const stats = fs.statSync(path.join(DATA_DIR, f));
      const size = (stats.size / 1024).toFixed(1);
      console.log(`  ${date}  (${size}KB)`);
    });
  }

  const current = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'digest-latest.json'), 'utf8'));
  console.log(`\nCurrent digest: ${current.date}`);
  console.log('\nUsage: node scripts/rollback.mjs <date>');
  process.exit(0);
}

if (target === 'latest') {
  const current = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'digest-latest.json'), 'utf8'));
  console.log(`Current digest date: ${current.date}`);
  console.log(`Generated at: ${current.generatedAt}`);
  const storyCount = current.sections.reduce((n, s) => n + s.stories.length, 0);
  console.log(`Stories: ${storyCount}`);
  process.exit(0);
}

// Rollback to specific date
const archiveFile = `digest-${target}.json`;
const archivePath = path.join(DATA_DIR, archiveFile);

if (!fs.existsSync(archivePath)) {
  console.error(`No archive found for date: ${target}`);
  console.error(`Available: ${files.map(f => f.replace('digest-', '').replace('.json', '')).join(', ') || '(none)'}`);
  process.exit(1);
}

// Backup current
const current = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'digest-latest.json'), 'utf8'));
const backupName = `digest-${current.date}-backup-${Date.now()}.json`;
fs.writeFileSync(path.join(DATA_DIR, backupName), JSON.stringify(current, null, 2));
console.log(`Backed up current digest to ${backupName}`);

// Restore archive
fs.copyFileSync(archivePath, path.join(DATA_DIR, 'digest-latest.json'));
const restored = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'digest-latest.json'), 'utf8'));
const storyCount = restored.sections.reduce((n, s) => n + s.stories.length, 0);
console.log(`Restored digest from ${target} (${storyCount} stories)`);
console.log('\nNext: npm run build && netlify deploy --build --prod');
