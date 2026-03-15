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

Images extracted from RSS `media:content`, `enclosure`, and `og:image` fallback. Each feed has a 15s timeout. Config in `scripts/fetch-articles.mjs`.

## Key Files

| File | Purpose |
|------|---------|
| `scripts/fetch-articles.mjs` | RSS fetcher with image extraction |
| `scripts/summarize.mjs` | Claude API summarization (fallback) |
| `scripts/rollback.mjs` | Digest version management |
| `.github/workflows/daily-digest.yml` | Daily automation via Claude Code |
| `src/data/digest-latest.json` | Current digest (generated, committed) |
| `src/data/neighborhoods.json` | 36 neighborhood descriptions |
| `src/data/guides.json` | 8 evergreen SEO guide articles |
| `src/data/lists.json` | 8 listicle/top-list articles |
| `src/data/landing-pages.json` | 20 long-tail SEO landing pages |
| `src/lib/helpers.ts` | Types, formatters, neighborhood colors |
| `src/pages/index.astro` | Homepage: hero + story grid + sidebar |
| `src/pages/[slug].astro` | Article pages (Schema.org NewsArticle) |
| `src/pages/[landing].astro` | Long-tail SEO landing pages |
| `src/pages/neighborhoods/` | 36 neighborhood pages with descriptions |
| `src/pages/guide/` | 8 evergreen guide articles |
| `src/pages/lists/` | 8 listicle/top-list articles |
| `src/pages/about.astro` | About page |
| `src/pages/404.astro` | Custom 404 |
| `src/components/` | Hero, StoryCard, Sidebar, NeighborhoodTag, SEO, Breadcrumb |

## Content Types (53 pages)

1. **Daily digest** — auto-generated article pages from RSS + Claude Code
2. **Landing pages** (20) — keyword-targeted pages (e.g. "atlanta news today", "atlanta beltline news")
3. **Neighborhood pages** (36) — evergreen descriptions, highlights, related neighborhoods, daily stories
4. **Guides** (8) — long-form evergreen content (BeltLine guide, best restaurants, moving to Atlanta)
5. **Lists** (8) — ranked listicles with outbound links (best parks, coffee shops, restaurants)
6. **About** — explains the project, lists sources with links

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
- **Never use em dashes.** Use periods, commas, or parentheses.
- **Never use:** "vibrant", "bustling", "nestled", "tapestry", "delves", "it's worth noting"
- **Never use** "hoods" or "hood" as shorthand for neighborhoods
- Write like a knowledgeable local, not a press release. Casual, warm, opinionated.
- Always link to and credit original sources. Every article links back to the source publication.
- Photos from Unsplash get credited. Photos from RSS sources are attributed to the source.
- Use varied content formatting: tables, lists, blockquotes, callout boxes. Not just walls of paragraphs.
- Include outbound links to authoritative sources (Wikipedia, official sites) when referencing people, places, things.

## SEO Structure

- **20 landing pages** targeting high-volume keywords (e.g. "atlanta news today" 73K/mo)
- **8 guides** targeting informational keywords (e.g. "best restaurants in atlanta" 8.4K/mo)
- **8 listicles** targeting long-tail keywords (e.g. "best parks east atlanta")
- **36 neighborhood pages** with evergreen descriptions
- All pages: Schema.org markup, Open Graph, Twitter Cards, sitemap, breadcrumbs
- Internal link mesh via footer (topics, SE BeltLine, neighborhoods, guides, lists)
- `_ref/` has Ahrefs keyword research data (not committed)

## Dev Workflow

- `digest-latest.json` is updated daily by the GitHub Action. Don't `git add -A` locally. Add files by name.
- Build before shipping: `npm run build`
- Deploy: `netlify deploy --build --prod`
- GitHub Action needs: `ANTHROPIC_API_KEY` repo secret + Claude Code GitHub App installed
- Archive/pagination: dated digest archives (`digest-YYYY-MM-DD.json`) are committed. Future work: build archive browsing pages.
