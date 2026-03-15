# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hyperlocal Atlanta news aggregator focused on Inside The Perimeter (ITP) neighborhoods, especially the SE BeltLine corridor. Pulls from local RSS feeds, summarizes via Claude API, and publishes as a static Astro site on Netlify. Used to support SEO for local businesses (real estate, small biz).

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

### Global tools (installed globally via npm)

- `internal-linker` — analyze and improve internal linking
  - `internal-linker all` — run full analysis (scan, SEO audit, broken links, orphans)
  - `internal-linker scan` — find internal linking opportunities (read-only)
  - `internal-linker apply` — add internal links to content files (interactive)
  - `internal-linker seo` — audit SEO issues (titles, descriptions, headings, images)
  - `internal-linker links` — check for broken internal links
  - `internal-linker orphans` — find pages with no incoming internal links
- `seo-pulse` — GSC feedback loop for reading performance data and writing optimizations
  - `seo-pulse read atlantanewsandtalk.com` — query trends, impressions, indexing status
  - `seo-pulse write atlantanewsandtalk.com --content-dir .` — interactive content optimization from GSC signals
  - `seo-pulse inspect atlantanewsandtalk.com <url>` — check indexing status of specific URLs
  - `seo-pulse sites` — list GSC properties
  - `seo-pulse history atlantanewsandtalk.com` — show stored data pulls

## Architecture

- **Astro** static site on **Netlify** (atlantanewsandtalk.com)
- **Daily automation:** Netlify scheduled function (`netlify/functions/daily-rebuild.mjs`) fires a build hook at 7am ET (11:00 UTC). The `netlify.toml` build command chains: fetch RSS, summarize with Claude API, then Astro build.
  1. `scripts/fetch-articles.mjs` fetches RSS (20 sources, 15s per-feed timeout)
  2. `scripts/summarize.mjs` sends raw articles to Claude API (Sonnet), writes `src/data/digest-latest.json`
  3. `npm run build` generates static pages from the digest
  4. Netlify deploys `dist/` automatically
- **Data flow:** Netlify cron → build hook → fetch RSS → Claude API summarization → `digest-latest.json` → Astro build → deploy
- **Rollback:** Dated archives (`digest-YYYY-MM-DD.json`) kept in git. Use `npm run rollback` or Netlify deploy rollback.
- **Env vars (Netlify):** `ANTHROPIC_API_KEY` (Claude API), `BUILD_HOOK_URL` (Netlify build hook)

## RSS Sources (20 feeds)

**Tier 1 (hyperlocal ITP):** Decaturish, Urbanize Atlanta, Atlanta Civic Circle
**Tier 2 (Atlanta-wide):** SaportaReport, Rough Draft Atlanta, Atlanta Magazine, The Atlanta Voice, Georgia Recorder, Global Atlanta, Capital B Atlanta, Eater Atlanta, What Now Atlanta, Hypepotamus
**Tier 3 (broadcast + proxied):** 11Alive, WSB-TV, GPB News, Fox 5 Atlanta, WABE (via Google News), AJC (via Google News), Axios Atlanta (via Google News)

Images extracted from RSS `media:content`, `enclosure`, and `og:image` fallback. Each feed has a 15s timeout. Config in `scripts/fetch-articles.mjs`.

## Story Deduplication

When multiple sources cover the same story, merge them into a single story entry with a `sources` array:

```json
{
  "source": "Atlanta Civic Circle",
  "sourceUrl": "https://...",
  "sources": [
    { "name": "Atlanta Civic Circle", "url": "https://..." },
    { "name": "AJC", "url": "https://..." },
    { "name": "11Alive", "url": "https://..." }
  ]
}
```

The `source` and `sourceUrl` fields should be the primary (best/most detailed) source. The `sources` array lists all outlets that covered the story. The article page renders multi-source stories with a "Reported by N sources" label and buttons linking to each original. Prefer Tier 1/2 sources as primary over Tier 3 broadcast sources.

## Pinned Stories

`src/data/pinned-stories.json` contains stories that persist across daily digest rebuilds. These are merged into the Development & Housing section at build time by `helpers.ts`. Use for SEO client content or stories that should remain visible beyond a single news cycle. Each pinned story follows the same `Story` interface with an added `"pinned": true` field.

## Key Files

| File | Purpose |
|------|---------|
| `scripts/fetch-articles.mjs` | RSS fetcher with image extraction |
| `scripts/summarize.mjs` | Claude API summarization |
| `scripts/rollback.mjs` | Digest version management |
| `netlify/functions/daily-rebuild.mjs` | Scheduled function: triggers daily build at 7am ET |
| `netlify.toml` | Build command: fetch + summarize + build |
| `src/data/digest-latest.json` | Current digest (generated, committed) |
| `src/data/pinned-stories.json` | Persistent stories that survive daily rebuilds |
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

- `digest-latest.json` is updated daily by the Netlify scheduled build. Don't `git add -A` locally. Add files by name.
- Build before shipping: `npm run build`
- Deploy: `netlify deploy --build --prod`
- Netlify env vars needed: `ANTHROPIC_API_KEY`, `BUILD_HOOK_URL`
- Archive digests (`digest-YYYY-MM-DD.json`) are committed to git for rollback and archive browsing.
