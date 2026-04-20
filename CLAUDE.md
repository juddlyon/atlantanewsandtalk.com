# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hyperlocal Atlanta news aggregator focused on Inside The Perimeter (ITP) neighborhoods, especially the SE BeltLine corridor. Pulls from 20 local RSS feeds, summarizes via Claude Code, and publishes as a static Astro site on Netlify. Supports SEO for local businesses (real estate, small biz).

**PERSISTENCE IS A HARD REQUIREMENT.** Every daily digest must be committed to git so story URLs accumulate SEO value over time. Never skip the git commit step.

**Live site:** https://atlantanewsandtalk.com

## Commands

- `npm run dev` — start Astro dev server
- `npm run build` — build static site to `dist/`
- `npx serve dist` — preview built site (Netlify adapter doesn't support `astro preview`)
- `npm run fetch` — fetch RSS articles to `src/data/raw-articles.json`
- `npm run images` — download story images, convert to WebP
- `npm run rollback` — list or restore previous digest versions
- `npm run deploy` — upload pre-built site (no build minutes used)
- `npm run test:deploy` — run post-deploy smoke tests to verify site health

### Daily Update Workflow (via Claude Code)

When the user says **"run today's news"**, execute this full workflow:

1. `npm run fetch` — fetch RSS articles from 20 sources
2. **Summarize in Claude Code** — read `raw-articles.json`, generate digest JSON, write to `digest-latest.json` and `digest-YYYY-MM-DD.json`
3. **Calculate cumulative neighborhood counts** — scan ALL `digest-YYYY-MM-DD.json` files and sum story counts per neighborhood across all digests. The `neighborhoods` object in the digest must show cumulative totals, not just today's counts.
4. `npm run images` — download story images, convert to WebP, update digest URLs to local paths
5. `npm run build` — build the static site locally
6. `git add src/data/digest-*.json && git commit -m "update digest YYYY-MM-DD" && git push` — **REQUIRED: lock archives into git**
7. `npm run deploy` — upload pre-built dist (no Netlify build minutes)
8. `npm run test:deploy` — verify deployment with smoke tests (includes image check)

**IMPORTANT: Cumulative counts.** The `neighborhoods` object at the end of each digest must contain cumulative story counts across ALL archived digests, not just stories from that day. This ensures SEO value accumulates over time.

**Why Claude Code instead of API?** Summarization runs through the Claude Code conversation (covered by Max subscription) instead of the external Anthropic API, eliminating per-token costs.

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
- **Manual workflow only.** Updates run locally through Claude Code conversation, then deploy via CLI.
- **Data flow (manual):**
  1. `npm run fetch` — fetches RSS (20 sources, 15s per-feed timeout)
  2. Claude Code reads `raw-articles.json` and generates digest JSON
  3. Write `digest-latest.json` + `digest-YYYY-MM-DD.json`
  4. **Git commit + push** — archives persist in version control
  5. `netlify deploy --prod` — builds static pages from ALL archived digests and deploys
- **Story persistence:** Story pages are built from ALL archived digest files (`digest-YYYY-MM-DD.json`), so URLs stay live forever. SEO value accumulates over time. **This is why git commits are mandatory.**
- **Rollback:** Dated archives kept in git. Use `npm run rollback` or Netlify deploy rollback.
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
| `scripts/summarize.mjs` | Legacy API script (unused, summarization done in Claude Code) |
| `scripts/download-images.mjs` | Downloads story images, converts to WebP, updates digest URLs |
| `scripts/rollback.mjs` | Digest version management |
| `scripts/smoke-test.mjs` | Post-deploy smoke tests (pages, redirects, story counts) |
| `netlify.toml` | Redirects, headers, build config |
| `src/data/digest-latest.json` | Current digest (generated daily, committed) |
| `src/data/pinned-stories.json` | Persistent stories that survive daily rebuilds |
| `src/data/neighborhoods.json` | 23 neighborhood descriptions |
| `src/data/guides.json` | 10 evergreen SEO guide articles |
| `src/data/lists.json` | 8 listicle/top-list articles |
| `src/data/landing-pages.json` | 21 long-tail SEO landing pages |
| `src/lib/helpers.ts` | Types, formatters, neighborhood colors, pinned story merging |
| `src/pages/index.astro` | Homepage: hero + lead cards + bullet lists + sidebar |
| `src/pages/[slug].astro` | Article pages (Schema.org NewsArticle, multi-source support) |
| `src/pages/[landing].astro` | Long-tail SEO landing pages |
| `src/pages/neighborhoods/` | 23 neighborhood pages with descriptions |
| `src/pages/guide/` | 10 evergreen guide articles |
| `src/pages/lists/` | 8 listicle/top-list articles |
| `src/pages/about.astro` | About page (personal sidequest framing) |
| `src/pages/404.astro` | Custom 404 |
| `src/pages/rss.xml.ts` | RSS feed endpoint |
| `src/components/` | Hero, StoryCard, Sidebar, NeighborhoodTag, SEO, Breadcrumb |

## Content Types (57+ pages)

1. **Daily digest** — article pages from RSS + Claude Code summarization
2. **Landing pages** (21) — keyword-targeted (e.g. "atlanta news today", "fifa world cup atlanta 2026")
3. **Neighborhood pages** (20) — evergreen descriptions, highlights, resources, daily stories
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

## Neighborhood Coverage (23 neighborhoods)

Based on [City of Atlanta NPU structure](https://www.atlantaga.gov/government/departments/city-planning/neighborhood-planning-units/neighborhoods-by-npu). Core focus on SE BeltLine corridor, plus major ITP neighborhoods with active news coverage.

**Tier 1 (SE BeltLine core, 10 neighborhoods):**
- NPU-M: Old Fourth Ward
- NPU-N: Inman Park, Reynoldstown, Cabbagetown, Candler Park, Little Five Points, Poncey-Highland
- NPU-O: Kirkwood
- NPU-V: Summerhill, Peoplestown
- NPU-W: Grant Park, East Atlanta (includes EAV), Ormewood Park

**Tier 2 (adjacent ITP, 10 neighborhoods):**
- NPU-E: Midtown
- NPU-F: Virginia-Highland
- NPU-M: Downtown, Sweet Auburn
- NPU-O: Edgewood
- NPU-T: West End

**Tier 3 (greater ITP, 3 neighborhoods):**
- NPU-B: Buckhead
- NPU-D: West Midtown
- NPU-O: Druid Hills
- Decatur (separate city, essential coverage)

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
- **23 neighborhood pages** with evergreen descriptions
- All pages: Schema.org markup, Open Graph, Twitter Cards, sitemap, breadcrumbs, robots.txt
- Default OG image: Atlanta skyline from Wikimedia Commons
- RSS feed at `/rss.xml`
- GSC property: `sc-domain:atlantanewsandtalk.com`
- Internal link mesh via footer (topics, SE BeltLine, neighborhoods, guides, lists)

## Dev Workflow

- **"Run today's news"** triggers the full workflow: fetch → summarize (Claude Code) → git commit → git push → deploy
- **ALWAYS commit digest files to git.** This is non-negotiable. Story URLs must persist for SEO.
- Don't use `git add -A`. Add digest files by name: `git add src/data/digest-*.json`
- Archive digests (`digest-YYYY-MM-DD.json`) accumulate in git for rollback and archive browsing.
- Run `internal-linker all` after adding new pages to check linking opportunities.
- Run `seo-pulse read sc-domain:atlantanewsandtalk.com` periodically to check GSC performance.
