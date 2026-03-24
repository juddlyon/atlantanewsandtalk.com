#!/usr/bin/env node

/**
 * Commits the daily digest files back to the git repo via GitHub API.
 * This runs during Netlify builds so archives persist across deploys.
 *
 * Requires GITHUB_TOKEN env var with repo write access.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');

const REPO = 'juddlyon/atlantanewsandtalk.com';
const BRANCH = 'main';

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('GITHUB_TOKEN not set, skipping digest commit');
    return;
  }

  // Find today's digest file
  const today = new Date().toISOString().slice(0, 10);
  const digestFile = `digest-${today}.json`;
  const digestPath = path.join(DATA_DIR, digestFile);

  if (!fs.existsSync(digestPath)) {
    console.log(`No digest file found for ${today}`);
    return;
  }

  const content = fs.readFileSync(digestPath, 'utf-8');
  const contentBase64 = Buffer.from(content).toString('base64');
  const filePath = `src/data/${digestFile}`;

  // Check if file already exists (get its SHA)
  let existingSha = null;
  try {
    const checkRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (checkRes.ok) {
      const data = await checkRes.json();
      existingSha = data.sha;
      console.log(`Digest ${digestFile} already exists in repo, updating...`);
    }
  } catch (e) {
    // File doesn't exist, that's fine
  }

  // Commit the file
  const body = {
    message: `update digest ${today}`,
    content: contentBase64,
    branch: BRANCH,
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (res.ok) {
    console.log(`✓ Committed ${digestFile} to ${REPO}`);
  } else {
    const err = await res.text();
    console.error(`Failed to commit digest: ${res.status} ${err}`);
  }
}

main().catch((err) => {
  console.error('Error committing digest:', err);
  // Don't fail the build
});
