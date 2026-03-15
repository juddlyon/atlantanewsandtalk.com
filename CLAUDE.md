# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hyperlocal Atlanta news aggregator focused on Inside The Perimeter (ITP) neighborhoods, especially the SE BeltLine corridor. Pulls from local RSS feeds, summarizes via Claude Code (GitHub Action), and publishes as a static Astro site on Netlify. Used to support SEO for local businesses (real estate, small biz).

**Live site:** https://atlantanewsandtalk.com

## Commands

- `npm run dev` — start Astro dev server
- `npm run build` — build static site to `dist/`
- `npx serve dist` — preview built site (Netlify adapter doesn't support `astro preview`)
- `npm run fetch` — fetch RSS articles to `src/data/raw-articles.json`
- `npm run summarize` — summarize raw articles into digest (requires ANTHROPIC_API_KEY)
- `npm run update` — fetch + summarize in one step
- `npm run rollback` — list or restore previous digest versions
- `netlify deploy --build --prod` — deploy to production

## Architecture

- **Astro** static site on **Netlify** (atlantanewsandtalk.com)
- **Daily automation:** GitHub Action (`.github/workflows/daily-digest.yml`) runs at 7am ET
  1. `scripts/fetch-articles.mjs` fetches RSS (12 sources, 15s per-feed timeout)
  2. Claude Code reads raw articles + CLAUDE.md, writes `src/data/digest-latest.json`
  3. Builds site, commits digest, pushes. Netlify auto-rebuilds.
- **Data flow:** RSS feeds → `raw-articles.json` (not committed) → Claude Code → `digest-latest.json` (committed) → Astro build
- **Rollback:** Dated archives (`digest-YYYY-MM-DD.json`) kept in git. Use `npm run rollback` or Netlify deploy rollback.

## RSS Sources (12 feeds)

**Tier 1:** Decaturish, Urbanize Atlanta, Atlanta Civic Circle
**Tier 2:** SaportaReport, Rough Draft Atlanta, Atlanta Magazine, The Atlanta Voice, Georgia Recorder, Global Atlanta
**Tier 3:** 11Alive, WSB-TV, GPB News

Images are extracted from RSS `media:content`, `enclosure`, and `og:image` fallback. Each feed has a 15s timeout. Config in `scripts/fetch-articles.mjs`.

## Key Files

| File | Purpose |
|------|---------|
| `scripts/fetch-articles.mjs` | RSS fetcher with image extraction |
| `scripts/summarize.mjs` | Claude API summarization (fallback to Action) |
| `scripts/rollback.mjs` | Digest version management |
| `.github/workflows/daily-digest.yml` | Daily automation via Claude Code |
| `src/data/digest-latest.json` | Current digest (generated, committed) |
| `src/data/neighborhoods.json` | Evergreen neighborhood descriptions (36 hoods) |
| `src/data/guides.json` | 8 evergreen SEO guide articles |
| `src/data/landing-pages.json` | 20 long-tail SEO landing pages |
| `src/lib/helpers.ts` | Types, formatters, neighborhood colors |
| `src/pages/index.astro` | Homepage: hero + story grid + sidebar |
| `src/pages/[slug].astro` | Article pages with Schema.org NewsArticle |
| `src/pages/[landing].astro` | Long-tail SEO landing pages |
| `src/pages/neighborhoods/` | Neighborhood index + per-neighborhood pages |
| `src/pages/guide/` | Guide index + article pages |
| `src/components/` | Hero, StoryCard, Sidebar, NeighborhoodTag, SEO, Breadcrumb |

## Design Direction

- Braves-adjacent civic palette: deep navy, signal red, warm ivory, restrained gold
- Mobile-first. Android phones are the primary audience.
- Fonts: Bitter (display serif), Space Grotesk (body sans), IBM Plex Mono (labels)
- "City desk / broadcast bulletin" energy. Not a blog template.
- Cards are clean, structured, minimal motion. No scrapbook styling.
- All branding is lowercase: "atlanta news & talk"

## Neighborhood Priority

**Tier 1 (SE BeltLine, top billing):** Old Fourth Ward, Grant Park, Reynoldstown, Cabbagetown, Inman Park, Summerhill, East Atlanta Village, Ormewood Park, Kirkwood

**Tier 2 (adjacent ITP):** Edgewood, Little Five Points, Candler Park, Poncey-Highland, Decatur, East Atlanta, Chosewood Park, Sweet Auburn

**Tier 3 (broader ITP):** Midtown, Downtown, Virginia-Highland, Morningside, West Midtown, Westside, West End, Buckhead, etc.

## Writing Rules

- **Never mention "AI"**, "machine learning", or "automation" in any user-facing copy
- **Never use em dashes.** Use periods, commas, or parentheses instead.
- **Never use:** "vibrant", "bustling", "nestled", "tapestry", "delves", "it's worth noting"
- Write like a local Atlanta blogger, not a press release. Casual, warm, opinionated.
- Headlines: active voice, present tense, conversational
- Reference specific streets, landmarks, restaurants by name
- Story categories: Development & Housing, Transit & Infrastructure, Food & Drink, Arts & Culture, Politics & Policy, Public Safety, Community, Business

## SEO Pages

- **20 landing pages** targeting keywords like "atlanta news today" (73K/mo), "things to do in atlanta" (39K/mo), "atlanta beltline news" (14K/mo)
- **8 evergreen guides** targeting "best restaurants in atlanta", "moving to atlanta", "atlanta beltline", etc.
- **36 neighborhood pages** with descriptions, highlights, related neighborhoods
- All pages have Schema.org markup, Open Graph, Twitter Cards, sitemap inclusion
- `_ref/` has Ahrefs keyword data (not committed)

## Dev Workflow Notes

- `digest-latest.json` is updated daily by the GitHub Action. Don't `git add -A` locally or you'll overwrite it. Add files by name instead.
- Build before shipping: `npm run build`
- Deploy with: `netlify deploy --build --prod`
- The GitHub Action needs `ANTHROPIC_API_KEY` as a repo secret + Claude Code GitHub App installed
