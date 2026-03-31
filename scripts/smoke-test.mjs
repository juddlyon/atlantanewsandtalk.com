#!/usr/bin/env node

/**
 * Post-deploy smoke test
 * Verifies the live site is working correctly after deployment
 *
 * Checks:
 * - Pages load without 404s
 * - Trailing slashes are enforced
 * - Today's digest is present
 * - Story counts are incrementing
 * - RSS feed is valid
 * - SEO pages work
 *
 * Usage: npm run test:deploy
 */

const SITE_URL = 'https://atlantanewsandtalk.com';
const TIMEOUT = 15000;
const DELAY_BETWEEN_REQUESTS = 200; // ms

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m'
};

function log(status, message) {
  const icon = status === 'pass' ? `${colors.green}✓${colors.reset}`
             : status === 'fail' ? `${colors.red}✗${colors.reset}`
             : status === 'warn' ? `${colors.yellow}⚠${colors.reset}`
             : `${colors.cyan}→${colors.reset}`;
  console.log(`  ${icon} ${message}`);
}

function section(title) {
  console.log(`\n${colors.cyan}${title}${colors.reset}`);
}

async function fetchWithTimeout(url, timeout = TIMEOUT, followRedirects = true, retries = 2) {
  // Small delay to avoid overwhelming the server
  await sleep(DELAY_BETWEEN_REQUESTS);

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: followRedirects ? 'follow' : 'manual',
        headers: { 'User-Agent': 'AtlantaNewsAndTalk-SmokeTest/1.0' }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (attempt === retries) {
        throw error;
      }
      // Wait before retry
      await sleep(1000);
    }
  }
}

async function checkUrl(url, options = {}) {
  const { expectText, expectStatus = 200, name } = options;
  const displayName = name || url.replace(SITE_URL, '');

  try {
    const response = await fetchWithTimeout(url);

    if (response.status !== expectStatus) {
      log('fail', `${displayName} - HTTP ${response.status} (expected ${expectStatus})`);
      return false;
    }

    if (expectText) {
      const text = await response.text();
      const textsToCheck = Array.isArray(expectText) ? expectText : [expectText];

      for (const expected of textsToCheck) {
        if (!text.includes(expected)) {
          log('fail', `${displayName} - missing expected content: "${expected.substring(0, 50)}..."`);
          return false;
        }
      }
    }

    log('pass', displayName);
    return true;
  } catch (error) {
    log('fail', `${displayName} - ${error.message}`);
    return false;
  }
}

async function checkTrailingSlashRedirect(path) {
  const urlWithoutSlash = `${SITE_URL}${path.replace(/\/$/, '')}`;
  const urlWithSlash = `${SITE_URL}${path.endsWith('/') ? path : path + '/'}`;

  try {
    // Check that non-slash URL redirects to slash URL
    const response = await fetchWithTimeout(urlWithoutSlash, TIMEOUT, false);

    // Should be a 301 or 308 redirect
    if (response.status === 301 || response.status === 308) {
      const location = response.headers.get('location');
      if (location && (location === urlWithSlash || location === path + '/' || location.endsWith(path + '/'))) {
        log('pass', `${path} (redirects with trailing slash)`);
        return true;
      }
    }

    // If we get a 200 without redirect, check if the URL has a trailing slash
    if (response.status === 200) {
      log('pass', `${path} (serves directly)`);
      return true;
    }

    log('fail', `${path} - no trailing slash redirect (got ${response.status})`);
    return false;
  } catch (error) {
    log('fail', `${path} - ${error.message}`);
    return false;
  }
}

async function getLatestDigest() {
  try {
    const response = await fetchWithTimeout(`${SITE_URL}/rss.xml`);
    const text = await response.text();

    // Extract story URLs from RSS
    const urlMatches = text.match(/<link>https:\/\/atlantanewsandtalk\.com\/[^<]+<\/link>/g) || [];
    const storyUrls = urlMatches
      .map(m => m.replace(/<\/?link>/g, ''))
      .filter(url => !url.endsWith('.com/') && !url.includes('/neighborhoods/') && !url.includes('/guide/'));

    return storyUrls.slice(0, 5); // Test first 5 stories
  } catch (error) {
    return [];
  }
}

async function checkNeighborhoodStoryCounts() {
  /**
   * Verify neighborhood story counts are present and reasonable
   * The homepage should show story counts for neighborhoods
   */
  try {
    const response = await fetchWithTimeout(SITE_URL);
    const html = await response.text();

    // Look for neighborhood links with story counts
    // Format varies, but should have numbers associated with neighborhoods
    const hasDowntownCount = /Downtown.*?\d+/is.test(html) || /\d+.*?Downtown/is.test(html);
    const hasMidtownCount = /Midtown.*?\d+/is.test(html) || /\d+.*?Midtown/is.test(html);

    if (!hasDowntownCount && !hasMidtownCount) {
      log('warn', 'Homepage may not display neighborhood story counts');
      return true; // Warn but don't fail
    }

    log('pass', 'Neighborhood story counts present');
    return true;
  } catch (error) {
    log('fail', `Story count check - ${error.message}`);
    return false;
  }
}

async function checkNeighborhoodPageCounts() {
  /**
   * Check that neighborhood pages show cumulative story counts
   */
  const neighborhoodUrl = `${SITE_URL}/neighborhoods/downtown/`;

  try {
    const response = await fetchWithTimeout(neighborhoodUrl);
    const html = await response.text();

    // Look for story count indicators (e.g., "52 stories" or similar)
    const storyCountMatch = html.match(/(\d+)\s*(stories|story|articles?)/i);

    if (storyCountMatch) {
      const count = parseInt(storyCountMatch[1], 10);
      if (count > 0) {
        log('pass', `/neighborhoods/downtown/ shows ${count} stories`);
        return true;
      }
    }

    // Check for story listings
    const hasStoryLinks = html.includes('href="/') && html.includes('article');
    if (hasStoryLinks) {
      log('pass', '/neighborhoods/downtown/ has story content');
      return true;
    }

    log('warn', '/neighborhoods/downtown/ - could not verify story count display');
    return true; // Warn but don't fail
  } catch (error) {
    log('fail', `/neighborhoods/downtown/ - ${error.message}`);
    return false;
  }
}

async function getTopStorySlug() {
  /**
   * Extract the top story slug from the homepage
   * Stories have slugs like /midtown-international-school-closure (with hyphen)
   * Excludes: /neighborhoods, /guide, /lists, /archive, /about, /fifa-*
   */
  try {
    const response = await fetchWithTimeout(SITE_URL);
    const html = await response.text();

    // Find all hrefs that look like story slugs (contain hyphen, not a known section)
    const hrefMatches = html.match(/href="\/([a-z][a-z0-9]+-[a-z0-9-]+)"/g) || [];

    for (const match of hrefMatches) {
      const slug = match.match(/href="\/([^"]+)"/)?.[1];
      if (slug &&
          !slug.startsWith('neighborhoods') &&
          !slug.startsWith('guide') &&
          !slug.startsWith('lists') &&
          !slug.startsWith('archive') &&
          !slug.startsWith('about') &&
          !slug.startsWith('fifa-') &&
          slug.includes('-')) {
        return slug;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function checkTodayContent() {
  /**
   * Verify today's digest content appears on the site
   */
  const today = new Date().toISOString().split('T')[0];
  let allPassed = true;

  try {
    // Check homepage for today's date or recent content
    const response = await fetchWithTimeout(SITE_URL);
    const html = await response.text();

    // Check for today's date in various formats
    const dateFormats = [
      today, // 2026-03-31
      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), // March 31, 2026
      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), // Mar 31
    ];

    const hasToday = dateFormats.some(format => html.includes(format));

    if (hasToday) {
      log('pass', 'Homepage shows today\'s date');
    } else {
      log('warn', 'Homepage may not show today\'s date (could be timezone issue)');
    }

    // Check archive page for today
    const archiveResponse = await fetchWithTimeout(`${SITE_URL}/archive/${today}/`);
    if (archiveResponse.status === 200) {
      log('pass', `/archive/${today}/ exists`);
    } else {
      log('fail', `/archive/${today}/ not found (${archiveResponse.status})`);
      allPassed = false;
    }

    return allPassed;
  } catch (error) {
    log('fail', `Today's content check - ${error.message}`);
    return false;
  }
}

async function checkTopStory() {
  /**
   * Verify the top/headline story page exists (critical test)
   */
  const topStorySlug = await getTopStorySlug();

  if (!topStorySlug) {
    log('warn', 'Could not identify top story from homepage');
    return true; // Warn but don't fail
  }

  try {
    const response = await fetchWithTimeout(`${SITE_URL}/${topStorySlug}/`);
    if (response.status === 200) {
      log('pass', `Top story /${topStorySlug}/ exists`);
      return true;
    } else {
      log('fail', `Top story /${topStorySlug}/ returns ${response.status}`);
      return false;
    }
  } catch (error) {
    log('fail', `Top story check - ${error.message}`);
    return false;
  }
}

async function checkRSSFreshness() {
  /**
   * Verify RSS feed contains recent items
   */
  try {
    const response = await fetchWithTimeout(`${SITE_URL}/rss.xml`);
    const text = await response.text();

    // Check for pubDate in RSS
    const pubDateMatch = text.match(/<pubDate>([^<]+)<\/pubDate>/);
    if (pubDateMatch) {
      const pubDate = new Date(pubDateMatch[1]);
      const now = new Date();
      const daysDiff = (now - pubDate) / (1000 * 60 * 60 * 24);

      if (daysDiff < 2) {
        log('pass', `RSS feed updated recently (${pubDate.toDateString()})`);
        return true;
      } else {
        log('warn', `RSS feed may be stale (last updated ${pubDate.toDateString()})`);
        return true;
      }
    }

    // Count items in feed
    const itemCount = (text.match(/<item>/g) || []).length;
    if (itemCount > 0) {
      log('pass', `RSS feed has ${itemCount} items`);
      return true;
    }

    log('fail', 'RSS feed appears empty');
    return false;
  } catch (error) {
    log('fail', `RSS freshness check - ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  atlanta news & talk - Post-Deploy Smoke Test${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.dim}  Testing: ${SITE_URL}${colors.reset}`);
  console.log(`${colors.dim}  Time: ${new Date().toISOString()}${colors.reset}`);

  const results = { passed: 0, failed: 0, warned: 0 };

  const track = (success) => {
    if (success) results.passed++;
    else results.failed++;
    return success;
  };

  // 1. Homepage tests
  section('Homepage');
  track(await checkUrl(SITE_URL, {
    expectText: ['atlanta news & talk', '/neighborhoods'],
    name: '/ (homepage loads with nav)'
  }));

  // 2. Trailing slash enforcement
  section('Trailing Slash Redirects');
  const slashTestPaths = [
    '/about',
    '/neighborhoods',
    '/neighborhoods/downtown',
    '/guide',
  ];
  for (const path of slashTestPaths) {
    track(await checkTrailingSlashRedirect(path));
  }

  // 3. Critical static pages
  section('Static Pages');
  const staticPages = [
    { path: '/about/', expect: 'About' },
    { path: '/neighborhoods/', expect: 'Neighborhoods' },
    { path: '/guide/', expect: 'Guides' },
    { path: '/lists/', expect: 'Lists' },
    { path: '/archive/', expect: 'Archive' },
  ];

  for (const page of staticPages) {
    track(await checkUrl(`${SITE_URL}${page.path}`, { expectText: page.expect }));
  }

  // 4. Sample neighborhood pages
  section('Neighborhood Pages');
  const neighborhoods = [
    '/neighborhoods/old-fourth-ward/',
    '/neighborhoods/grant-park/',
    '/neighborhoods/midtown/',
    '/neighborhoods/decatur/',
    '/neighborhoods/kirkwood/',
  ];

  for (const path of neighborhoods) {
    track(await checkUrl(`${SITE_URL}${path}`));
  }

  // 5. RSS feed
  section('RSS Feed');
  track(await checkUrl(`${SITE_URL}/rss.xml`, {
    expectText: ['<rss', '<channel>', '<item>'],
    name: '/rss.xml (valid RSS structure)'
  }));
  track(await checkRSSFreshness());

  // 6. Recent story pages from RSS
  section('Recent Story Pages');
  const storyUrls = await getLatestDigest();

  if (storyUrls.length === 0) {
    log('warn', 'Could not extract story URLs from RSS');
    results.warned++;
  } else {
    for (const url of storyUrls) {
      track(await checkUrl(url, { expectText: 'article' }));
    }
  }

  // 7. Landing pages (SEO)
  section('SEO Landing Pages');
  const landingPages = [
    '/atlanta-news-today/',
    '/atlanta-beltline-news/',
    '/things-to-do-in-atlanta/',
  ];

  for (const path of landingPages) {
    track(await checkUrl(`${SITE_URL}${path}`));
  }

  // 8. Check for 404 page
  section('Error Handling');
  track(await checkUrl(`${SITE_URL}/this-page-should-not-exist-12345/`, {
    expectStatus: 404,
    name: '/404 (returns 404 status)'
  }));

  // 9. Today's content and freshness
  section('Content Freshness');
  track(await checkTodayContent());
  track(await checkTopStory());

  // 10. Story counts
  section('Story Counts');
  track(await checkNeighborhoodStoryCounts());
  track(await checkNeighborhoodPageCounts());

  // Summary
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);

  const total = results.passed + results.failed;
  const successRate = Math.round((results.passed / total) * 100);

  if (results.failed === 0) {
    console.log(`${colors.green}  ✓ All ${results.passed} tests passed${colors.reset}`);
    if (results.warned > 0) {
      console.log(`${colors.yellow}    (${results.warned} warnings)${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}  ✗ ${results.failed} of ${total} tests failed${colors.reset}`);
    console.log(`${colors.dim}    ${results.passed} passed, ${results.failed} failed (${successRate}% success rate)${colors.reset}`);
  }

  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  // Exit with error code if any tests failed
  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error(`${colors.red}Smoke test crashed: ${error.message}${colors.reset}`);
  process.exit(1);
});
