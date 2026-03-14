import type { APIRoute } from 'astro';
import { getAllStories, getAllNeighborhoods, slugify, SITE_URL } from '../lib/helpers';
import landingData from '../data/landing-pages.json';
import guidesData from '../data/guides.json';

export const GET: APIRoute = () => {
  const stories = getAllStories();
  const neighborhoods = getAllNeighborhoods();
  const today = new Date().toISOString().split('T')[0];

  const urls = [
    { loc: SITE_URL, lastmod: today, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_URL}/neighborhoods`, lastmod: today, changefreq: 'daily', priority: '0.8' },
    { loc: `${SITE_URL}/guide`, lastmod: today, changefreq: 'weekly', priority: '0.8' },
    // Landing pages — high SEO value
    ...landingData.pages.map((p) => ({
      loc: `${SITE_URL}/${p.slug}`,
      lastmod: today,
      changefreq: 'daily',
      priority: '0.9',
    })),
    // Guide pages — evergreen SEO content
    ...guidesData.guides.map((g) => ({
      loc: `${SITE_URL}/guide/${g.slug}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.85',
    })),
    ...neighborhoods.map((n) => ({
      loc: `${SITE_URL}/neighborhoods/${slugify(n)}`,
      lastmod: today,
      changefreq: 'daily',
      priority: '0.7',
    })),
    ...stories.map((s) => ({
      loc: `${SITE_URL}/${s.id}`,
      lastmod: s.publishedAt?.split('T')[0] || today,
      changefreq: 'weekly',
      priority: '0.9',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
