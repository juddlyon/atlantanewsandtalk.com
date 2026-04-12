import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.join(process.cwd(), 'dist');

/**
 * Build output tests. Run after `npm run build`.
 * Validates that all expected pages exist and critical files are correct.
 */

function fileExists(relativePath: string): boolean {
  // Astro generates /foo/index.html for /foo routes
  const full = path.join(DIST, relativePath);
  return fs.existsSync(full);
}

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(DIST, relativePath), 'utf-8');
}

describe('build output', () => {
  beforeAll(() => {
    if (!fs.existsSync(DIST)) {
      throw new Error('dist/ not found. Run `npm run build` before running build tests.');
    }
  });

  describe('core pages exist', () => {
    const pages = [
      'index.html',
      '404.html',
      'about/index.html',
      'contact/index.html',
      'contact/thanks/index.html',
      'editorial/index.html',
      'privacy/index.html',
      'neighborhoods/index.html',
      'guide/index.html',
      'lists/index.html',
      'resources/index.html',
    ];

    for (const page of pages) {
      it(`/${page}`, () => {
        expect(fileExists(page), `missing: ${page}`).toBe(true);
      });
    }
  });

  describe('all 42 neighborhood pages exist', () => {
    const neighborhoodsJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'src/data/neighborhoods.json'), 'utf-8')
    );

    for (const n of neighborhoodsJson.neighborhoods) {
      it(`/neighborhoods/${n.slug}`, () => {
        expect(
          fileExists(`neighborhoods/${n.slug}/index.html`),
          `missing neighborhood page: ${n.slug}`
        ).toBe(true);
      });
    }
  });

  describe('all guide pages exist', () => {
    const guidesJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'src/data/guides.json'), 'utf-8')
    );

    for (const guide of guidesJson.guides) {
      it(`/guide/${guide.slug}`, () => {
        expect(fileExists(`guide/${guide.slug}/index.html`), `missing guide: ${guide.slug}`).toBe(true);
      });
    }
  });

  describe('all list pages exist', () => {
    const listsJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'src/data/lists.json'), 'utf-8')
    );

    for (const list of listsJson.lists) {
      it(`/lists/${list.slug}`, () => {
        expect(fileExists(`lists/${list.slug}/index.html`), `missing list: ${list.slug}`).toBe(true);
      });
    }
  });

  describe('all landing pages exist', () => {
    const landingJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'src/data/landing-pages.json'), 'utf-8')
    );

    for (const page of landingJson.pages) {
      it(`/${page.slug}`, () => {
        expect(fileExists(`${page.slug}/index.html`), `missing landing: ${page.slug}`).toBe(true);
      });
    }
  });

  describe('all digest story pages exist', () => {
    const digestJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'src/data/digest-latest.json'), 'utf-8')
    );

    const stories = digestJson.sections.flatMap((s: any) => s.stories);
    for (const story of stories) {
      it(`/${story.id}`, () => {
        expect(fileExists(`${story.id}/index.html`), `missing story page: ${story.id}`).toBe(true);
      });
    }
  });

  describe('pinned story pages exist', () => {
    const pinnedJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'src/data/pinned-stories.json'), 'utf-8')
    );

    for (const story of pinnedJson) {
      it(`/${story.id}`, () => {
        expect(fileExists(`${story.id}/index.html`), `missing pinned story: ${story.id}`).toBe(true);
      });
    }
  });

  describe('feeds and sitemaps', () => {
    it('rss.xml exists', () => {
      expect(fileExists('rss.xml')).toBe(true);
    });

    it('sitemap-index.xml exists and references sitemaps', () => {
      expect(fileExists('sitemap-index.xml')).toBe(true);
      const content = readFile('sitemap-index.xml');
      expect(content).toContain('sitemap-0.xml');
      expect(content).toContain('news-sitemap.xml');
    });

    it('news-sitemap.xml exists and has news entries', () => {
      expect(fileExists('news-sitemap.xml')).toBe(true);
      const content = readFile('news-sitemap.xml');
      expect(content).toContain('xmlns:news');
      expect(content).toContain('<news:title>');
    });

    it('sitemap.xml exists', () => {
      expect(fileExists('sitemap.xml')).toBe(true);
    });

    it('robots.txt exists and references sitemaps', () => {
      expect(fileExists('robots.txt')).toBe(true);
      const content = readFile('robots.txt');
      expect(content).toContain('sitemap-index.xml');
      expect(content).toContain('news-sitemap.xml');
    });
  });

  describe('no broken internal links in homepage', () => {
    it('all href links point to existing pages', () => {
      const html = readFile('index.html');
      const hrefPattern = /href="\/([^"#]*?)"/g;
      let match;
      const broken: string[] = [];

      while ((match = hrefPattern.exec(html)) !== null) {
        const href = match[1];
        if (!href || href === '') continue;
        if (href.startsWith('http') || href.startsWith('mailto')) continue;

        const clean = href.replace(/\/$/, '');
        const asFile = href.endsWith('.xml') || href.endsWith('.txt')
          ? fileExists(href)
          : fileExists(`${clean}/index.html`) || fileExists(clean);

        if (!asFile) {
          broken.push(`/${href}`);
        }
      }

      expect(broken, `broken links on homepage: ${broken.join(', ')}`).toEqual([]);
    });
  });

  describe('trailing slashes on internal links', () => {
    it('homepage internal links use trailing slashes', () => {
      const html = readFile('index.html');
      const hrefPattern = /href="(\/[^"#]*?)"/g;
      let match;
      const missing: string[] = [];

      while ((match = hrefPattern.exec(html)) !== null) {
        const href = match[1];
        if (href === '/') continue;
        if (href.match(/\.\w+$/)) continue; // skip .xml, .txt, .svg etc
        if (!href.endsWith('/')) {
          missing.push(href);
        }
      }

      expect(missing, `links missing trailing slash: ${missing.join(', ')}`).toEqual([]);
    });
  });

  describe('digest freshness', () => {
    it('homepage HTML contains the date from digest-latest.json', () => {
      const digestJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'src/data/digest-latest.json'), 'utf-8')
      );
      const digestDate = digestJson.date; // e.g. "2026-04-10"

      // Format the date the same way helpers.ts formatDate() does
      const d = new Date(digestDate + 'T12:00:00');
      const formatted = d.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const html = readFile('index.html');
      expect(
        html.includes(formatted),
        `Homepage does not contain digest date "${formatted}" (digest-latest.json says ${digestDate}). Did you forget to rebuild after updating the digest?`
      ).toBe(true);
    });

    it('homepage HTML contains the digest summary', () => {
      const digestJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'src/data/digest-latest.json'), 'utf-8')
      );
      // Check first 60 chars of summary to avoid HTML encoding edge cases
      const summarySnippet = digestJson.summary.substring(0, 60);
      const html = readFile('index.html');
      expect(
        html.includes(summarySnippet),
        `Homepage missing digest summary. Build may be stale.`
      ).toBe(true);
    });
  });

  describe('canonical URLs', () => {
    it('homepage has canonical with trailing slash', () => {
      const html = readFile('index.html');
      const match = html.match(/rel="canonical"\s+href="([^"]+)"/);
      expect(match, 'homepage missing canonical').toBeTruthy();
      expect(match![1]).toMatch(/\/$/);
    });

    it('all pages have canonical URLs', () => {
      const pagesToCheck = [
        'about/index.html',
        'neighborhoods/index.html',
        'guide/index.html',
        'lists/index.html',
        'contact/index.html',
      ];

      for (const page of pagesToCheck) {
        if (!fileExists(page)) continue;
        const html = readFile(page);
        const match = html.match(/rel="canonical"\s+href="([^"]+)"/);
        expect(match, `${page}: missing canonical URL`).toBeTruthy();
        expect(match![1], `${page}: canonical missing trailing slash`).toMatch(/\/$/);
      }
    });

    it('homepage has <main> landmark', () => {
      const html = readFile('index.html');
      expect(html).toContain('<main');
    });
  });
});
