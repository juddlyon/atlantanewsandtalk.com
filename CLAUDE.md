# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hyperlocal Atlanta news aggregator focused on Inside The Perimeter (ITP) neighborhoods, with special emphasis on SE BeltLine corridor (O4W, Grant Park, Reynoldstown, Inman Park, Summerhill, etc.). Pulls from local RSS feeds, summarizes via Claude, and publishes as a static Astro site on Netlify. Used to support SEO for local businesses.

## Commands

- `npm run dev` — start Astro dev server
- `npm run build` — build static site to `dist/`
- `npx serve dist` — preview built site locally (Netlify adapter doesn't support `astro preview`)
- `npm run fetch` — fetch RSS articles to `src/data/raw-articles.json`
- `npm run summarize` — summarize raw articles into digest (requires ANTHROPIC_API_KEY)
- `npm run update` — fetch + summarize in one step
- `npm run publish` — fetch, summarize, build, commit, and push

## Architecture

- **Astro** static site deployed on **Netlify**
- **Local update workflow** (primary): `scripts/fetch-articles.mjs` → `scripts/summarize.mjs` → commit & push → Netlify auto-rebuilds
- **Netlify scheduled function** (future): `netlify/functions/fetch-news.mjs` — same logic but runs `@daily` on Netlify
- **Data flow**: RSS feeds → raw-articles.json (not committed) → Claude summarization → digest-latest.json (committed) → Astro static build
- Story categories: Development & Housing, Transit & Infrastructure, Food & Drink, Arts & Culture, Politics & Policy, Public Safety, Community, Business

## Key Files

- `scripts/fetch-articles.mjs` — local RSS fetcher with image extraction
- `scripts/summarize.mjs` — Claude API summarization into digest
- `netlify/functions/fetch-news.mjs` — Netlify scheduled function (future use)
- `src/data/digest-latest.json` — current digest (generated, committed)
- `src/data/sources.json` — RSS feed source list
- `src/lib/helpers.ts` — shared utilities (types, formatters, neighborhood colors)
- `src/pages/index.astro` — homepage with hero + story grid + sidebar
- `src/pages/[slug].astro` — individual article pages with Schema.org NewsArticle
- `src/pages/neighborhoods/[neighborhood].astro` — per-neighborhood pages
- `src/components/` — Hero, StoryCard, Sidebar, NeighborhoodTag, SEO

## Neighborhood Priority

SE BeltLine corridor neighborhoods are **Tier 1** — they get top billing:
Old Fourth Ward, Grant Park, Reynoldstown, Cabbagetown, Inman Park, Summerhill, East Atlanta Village, Ormewood Park

## Important Rules

- **Never mention "AI"** or "machine learning" or "automation" in any user-facing copy.
- ITP focus — prioritize hyperlocal neighborhood-level news over general metro Atlanta stories.
- `_ref/` contains Ahrefs keyword research data — not committed to the repo.
- `src/data/raw-articles.json` is intermediate data — not committed.
