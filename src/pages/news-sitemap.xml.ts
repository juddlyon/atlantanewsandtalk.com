import type { APIContext } from 'astro';
import { getAllStories, SITE_URL, SITE_NAME } from '../lib/helpers';

export function GET(context: APIContext) {
  const stories = getAllStories();

  // Google News sitemaps should only include articles from the last 2 days
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const recentStories = stories.filter((story) => {
    const pubDate = new Date(story.publishedAt);
    return pubDate >= twoDaysAgo;
  });

  const urls = recentStories.map((story) => `  <url>
    <loc>${SITE_URL}/${story.id}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(story.publishedAt).toISOString()}</news:publication_date>
      <news:title>${escapeXml(story.headline)}</news:title>
    </news:news>
  </url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
