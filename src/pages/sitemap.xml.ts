import type { APIRoute } from 'astro';
import { getAllStories, getAllNeighborhoods, slugify, SITE_URL } from '../lib/helpers';
import guidesData from '../data/guides.json';
import listsData from '../data/lists.json';
import landingPages from '../data/landing-pages.json';

export const GET: APIRoute = () => {
  const stories = getAllStories();
  const neighborhoods = getAllNeighborhoods();

  const staticPages = [
    { loc: SITE_URL, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE_URL}/about`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${SITE_URL}/neighborhoods`, priority: '0.8', changefreq: 'daily' },
    { loc: `${SITE_URL}/guide`, priority: '0.8', changefreq: 'weekly' },
    { loc: `${SITE_URL}/lists`, priority: '0.8', changefreq: 'weekly' },
  ];

  const storyPages = stories.map((story) => ({
    loc: `${SITE_URL}/${story.id}`,
    priority: '0.7',
    changefreq: 'weekly' as const,
  }));

  const neighborhoodPages = neighborhoods.map((n) => ({
    loc: `${SITE_URL}/neighborhoods/${slugify(n)}`,
    priority: '0.7',
    changefreq: 'daily' as const,
  }));

  const guidePages = guidesData.guides.map((guide) => ({
    loc: `${SITE_URL}/guide/${guide.slug}`,
    priority: '0.8',
    changefreq: 'monthly' as const,
  }));

  const listPages = listsData.lists.map((list) => ({
    loc: `${SITE_URL}/lists/${list.slug}`,
    priority: '0.8',
    changefreq: 'monthly' as const,
  }));

  const landingPageEntries = ((landingPages as any).pages as any[]).map((page: any) => ({
    loc: `${SITE_URL}/${page.slug}`,
    priority: '0.9',
    changefreq: 'daily' as const,
  }));

  const allPages = [
    ...staticPages,
    ...storyPages,
    ...neighborhoodPages,
    ...guidePages,
    ...listPages,
    ...landingPageEntries,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
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
