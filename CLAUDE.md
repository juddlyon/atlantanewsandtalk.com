# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hyperlocal Atlanta news aggregator focused on Inside The Perimeter (ITP) neighborhoods, especially the SE BeltLine corridor. Pulls from 20 local RSS feeds, summarizes via Claude API, and publishes as a static Astro site on Netlify. Supports SEO for local businesses (real estate, small biz).

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
  - `internal-linker all` — full analysis (scan, SEO audit, broken links, orphans)
  - `internal-linker apply` — add internal links to content files (interactive)
  - `internal-linker seo` — audit titles, descriptions, headings, images
  - `internal-linker links` — check for broken links
  - `internal-linker orphans` — find pages with no incoming links
- `seo-pulse` — GSC feedback loop (requires Google Search Console access)
  - `seo-pulse read sc-domain:atlantanewsandtalk.com` — query trends, impressions, indexing
  - `seo-pulse write sc-domain:atlantanewsandtalk.com --content-dir .` — optimize from GSC signals
  - `seo-pulse inspect sc-domain:atlantanewsandtalk.com <url>` — check indexing status
  - `seo-pulse sites` — list GSC properties

## Architecture

- **Astro** static site on **Netlify** (atlantanewsandtalk.com)
- **Daily automation:** Netlify scheduled function (`netlify/functions/daily-rebuild.mjs`) fires a build hook at 7am ET (11:00 UTC). The `netlify.toml` build command chains: fetch RSS, summarize with Claude API, then Astro build.
  1. `scripts/fetch-articles.mjs` fetches RSS (20 sources, 15s per-feed timeout)
  2. `scripts/summarize.mjs` sends raw articles to Claude API (Sonnet, 16384 max tokens), writes `src/data/digest-latest.json`
  3. `npm run build` generates static pages from the digest
  4. Netlify deploys `dist/` automatically
- **Data flow:** Netlify cron → build hook → fetch RSS → Claude API summarization → `digest-latest.json` → Astro build → deploy
- **Rollback:** Dated archives (`digest-YYYY-MM-DD.json`) kept in git. Use `npm run rollback` or Netlify deploy rollback.
- **Env vars (Netlify):** `ANTHROPIC_API_KEY` (Claude API), `BUILD_HOOK_URL` (Netlify build hook)
- **No GitHub Actions.** All automation runs through Netlify.

## RSS Sources (20 feeds)

**Tier 1 (hyperlocal ITP):** Decaturish, Urbanize Atlanta, Atlanta Civic Circle
**Tier 2 (Atlanta-wide):** SaportaReport, Rough Draft Atlanta, Atlanta Magazine, The Atlanta Voice, Georgia Recorder, Global Atlanta, Capital B Atlanta, Eater Atlanta, What Now Atlanta, Hypepotamus
**Tier 3 (broadcast + proxied):** 11Alive, WSB-TV, GPB News, Fox 5 Atlanta, WABE (via Google News), AJC (via Google News), Axios Atlanta (via Google News)

Images extracted from RSS `media:content`, `enclosure`, and `og:image` fallback. Each feed has a 15s timeout. Config in `scripts/fetch-articles.mjs`.

## Neighborhood Mapping

Stories must map to a specific ITP neighborhood from the defined list in `scripts/summarize.mjs`. No generic labels ("Southwest Atlanta", "Metro Atlanta", "Statewide"). No suburbs or out-of-metro locations. If a story doesn't map to a real ITP neighborhood, drop it.

## Story Deduplication

When multiple sources cover the same story, merge into a single entry with a `sources` array:

```json
{
  "source": "Atlanta Civic Circle",
  "sourceUrl": "https://...",
  "sources": [
    { "name": "Atlanta Civic Circle", "url": "https://..." },
    { "name": "AJC", "url": "https://..." }
  ]
}
```

Article pages render multi-source stories with "Reported by N sources" and buttons to each original. Prefer Tier 1/2 as primary source.

## Source Diversity

Each daily digest includes at most ONE story per source. This prevents any single publication (especially prolific ones like Urbanize Atlanta) from dominating the homepage. The summarization prompt enforces this rule.

## Pinned Stories

`src/data/pinned-stories.json` contains stories that persist across daily digest rebuilds. Merged into Development & Housing section at build time by `helpers.ts`. Use for SEO client content or stories that should remain visible. Each entry follows the `Story` interface with `"pinned": true`.

**Current pinned:** The Row 900 (Peoplestown) linking to therow900.com and bobbiespiller.com/the-row-900.

## Key Files

| File | Purpose |
|------|---------|
| `scripts/fetch-articles.mjs` | RSS fetcher (20 sources) with image extraction |
| `scripts/summarize.mjs` | Claude API summarization (Sonnet, 16384 tokens) |
| `scripts/rollback.mjs` | Digest version management |
| `netlify/functions/daily-rebuild.mjs` | Scheduled function: triggers daily build at 7am ET |
| `netlify.toml` | Build command: fetch + summarize + build |
| `src/data/digest-latest.json` | Current digest (generated daily, committed) |
| `src/data/pinned-stories.json` | Persistent stories that survive daily rebuilds |
| `src/data/neighborhoods.json` | 36 neighborhood descriptions |
| `src/data/guides.json` | 10 evergreen SEO guide articles |
| `src/data/lists.json` | 8 listicle/top-list articles |
| `src/data/landing-pages.json` | 21 long-tail SEO landing pages |
| `src/lib/helpers.ts` | Types, formatters, neighborhood colors, pinned story merging |
| `src/pages/index.astro` | Homepage: hero + lead cards + bullet lists + sidebar |
| `src/pages/[slug].astro` | Article pages (Schema.org NewsArticle, multi-source support) |
| `src/pages/[landing].astro` | Long-tail SEO landing pages |
| `src/pages/neighborhoods/` | 36 neighborhood pages with descriptions |
| `src/pages/guide/` | 10 evergreen guide articles |
| `src/pages/lists/` | 8 listicle/top-list articles |
| `src/pages/about.astro` | About page (personal sidequest framing) |
| `src/pages/404.astro` | Custom 404 |
| `src/pages/rss.xml.ts` | RSS feed endpoint |
| `src/components/` | Hero, StoryCard, Sidebar, NeighborhoodTag, SEO, Breadcrumb |

## Content Types (57+ pages)

1. **Daily digest** — auto-generated article pages from RSS + Claude API
2. **Landing pages** (21) — keyword-targeted (e.g. "atlanta news today", "fifa world cup atlanta 2026")
3. **Neighborhood pages** (36) — evergreen descriptions, highlights, resources, daily stories
4. **Guides** (10) — long-form evergreen content (BeltLine, Summerhill, Peoplestown, restaurants, moving guide)
5. **Lists** (8) — ranked listicles with outbound links (best parks, coffee shops, restaurants)
6. **Pinned stories** — SEO client content (The Row 900)
7. **About** — personal experiment/sidequest from a web dev in Summerhill

## Design Direction

- Braves-adjacent civic palette: deep navy, signal red, warm ivory, restrained gold
- Mobile-first. Android phones are the primary audience.
- Fonts: Bitter (display serif), Space Grotesk (body sans), IBM Plex Mono (labels)
- "City desk / broadcast bulletin" energy. Not a blog template.
- Homepage uses Google News style: lead card with image per section, then bullet list
- Chevrons (› ‹) for navigation, not arrows
- All branding is lowercase: "atlanta news & talk"
- Guide/list images must be real Atlanta photos (Wikimedia Commons CC-licensed or from source sites). No generic stock photos.

## Neighborhood Priority

**Tier 1 (SE BeltLine, top billing):** Old Fourth Ward, Grant Park, Reynoldstown, Cabbagetown, Inman Park, Summerhill, East Atlanta Village, Ormewood Park, Kirkwood, Peoplestown

**Tier 2 (adjacent ITP):** Edgewood, Little Five Points, Candler Park, Poncey-Highland, Decatur, East Atlanta, Chosewood Park, Sweet Auburn

**Tier 3 (broader ITP):** Midtown, Downtown, Virginia-Highland, Morningside, West Midtown, Westside, West End, Buckhead, etc.

## Writing Rules

- **Never mention "AI"**, "machine learning", or "automation" in any user-facing copy
- **Never use em dashes.** Use periods, commas, or parentheses.
- **Never use:** "vibrant", "bustling", "nestled", "tapestry", "delves", "it's worth noting"
- **Never use** "hoods" or "hood" as shorthand for neighborhoods
- Write like a knowledgeable local, not a press release. Casual, warm, opinionated.
- Always link to and credit original sources. Every article links back to the source publication.
- Images from Wikimedia Commons get photographer + license credited. RSS images attributed to source.
- Use varied content formatting: tables, lists, blockquotes, callout boxes. Not just walls of paragraphs.
- Include outbound links to authoritative sources (Wikipedia, official sites) when referencing people, places, things.
- Don't over-optimize anchor text for SEO client links. Keep them natural.

## SEO Structure

- **21 landing pages** targeting high-volume keywords (e.g. "atlanta news today" 73K/mo, "fifa world cup atlanta 2026")
- **10 guides** targeting informational keywords (e.g. "summerhill atlanta", "peoplestown atlanta", "best restaurants in atlanta")
- **8 listicles** targeting long-tail keywords (e.g. "best parks east atlanta")
- **36 neighborhood pages** with evergreen descriptions
- All pages: Schema.org markup, Open Graph, Twitter Cards, sitemap, breadcrumbs, robots.txt
- Default OG image: Atlanta skyline from Wikimedia Commons
- RSS feed at `/rss.xml`
- GSC property: `sc-domain:atlantanewsandtalk.com`
- Internal link mesh via footer (topics, SE BeltLine, neighborhoods, guides, lists)

## Dev Workflow

- `digest-latest.json` is updated daily by the Netlify scheduled build. Don't `git add -A` locally. Add files by name.
- Build before shipping: `npm run build`
- Deploy: `netlify deploy --build --prod`
- Netlify env vars needed: `ANTHROPIC_API_KEY`, `BUILD_HOOK_URL`
- Archive digests (`digest-YYYY-MM-DD.json`) are committed to git for rollback and archive browsing.
- Run `internal-linker all` after adding new pages to check linking opportunities.
- Run `seo-pulse read sc-domain:atlantanewsandtalk.com` periodically to check GSC performance.
- To manually refresh the digest locally: `ANTHROPIC_API_KEY=$(netlify env:get ANTHROPIC_API_KEY) npm run update`
