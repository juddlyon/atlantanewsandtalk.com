# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Automated hyperlocal Atlanta news aggregator focused on Inside The Perimeter (ITP) neighborhoods. Pulls from local RSS feeds nightly, summarizes via Claude API, and publishes as a static site.

## Commands

- `npm run dev` — start Astro dev server
- `npm run build` — build static site to `dist/`
- `npx serve dist` — preview the built site locally (Netlify adapter doesn't support `astro preview`)

## Architecture

- **Astro** static site deployed on **Netlify**
- **Netlify scheduled function** (`netlify/functions/fetch-news.mjs`) runs `@daily`:
  1. Fetches RSS feeds from 8 hyperlocal Atlanta sources
  2. Filters to last 24 hours of articles
  3. Sends to Claude API for categorization and summarization
  4. Writes digest JSON to `src/data/digest-latest.json` and a dated archive copy
- **Astro build** reads `src/data/digest-latest.json` at build time to generate static HTML
- Story categories: Development & Housing, Transit & Infrastructure, Food & Drink, Arts & Culture, Politics & Policy, Public Safety, Community, Business

## Key Files

- `netlify/functions/fetch-news.mjs` — nightly RSS fetch + Claude summarization
- `src/data/sources.json` — RSS feed source list
- `src/data/digest-latest.json` — current day's digest (generated)
- `src/pages/index.astro` — main page rendering the digest
- `src/layouts/Base.astro` — site shell (header, footer, meta)
- `src/styles/global.css` — all styles (CSS custom properties, no framework)

## Important Rules

- Never mention "AI", "machine learning", or "automation" in any user-facing copy. Describe the site as aggregating/summarizing news without referencing the technology.
- ITP (Inside The Perimeter) focus — prioritize hyperlocal neighborhood-level news over general metro Atlanta stories.
- `_ref/` contains Ahrefs keyword research data — not committed to the repo.
