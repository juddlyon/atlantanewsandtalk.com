import type { APIContext } from 'astro';
import { getAllArchivedStories, getDigest, SITE_URL, SITE_NAME } from '../lib/helpers';

export function GET(context: APIContext) {
  // Use ALL archived stories so we catch stories from multiple days
  const stories = getAllArchivedStories();
  const digestDate = new Date(getDigest().date + 'T23:59:59');

  // Google News sitemaps should only include articles from the last 2 days
  const twoDaysBeforeDigest = new Date(digestDate);
  twoDaysBeforeDigest.setDate(twoDaysBeforeDigest.getDate() - 2);

  const recentStories = stories.filter((story) => {
    const pubDate = new Date(story.publishedAt);
    return pubDate >= twoDaysBeforeDigest && pubDate <= digestDate;
  });

  const urls = recentStories.map((story) => {
    const absImage = story.imageUrl
      ? (story.imageUrl.startsWith('http') ? story.imageUrl : `${SITE_URL}${story.imageUrl}`)
      : null;
    const imageTag = absImage
      ? `\n    <image:image>\n      <image:loc>${escapeXml(absImage)}</image:loc>\n      <image:caption>${escapeXml(story.imageAlt || story.headline)}</image:caption>\n    </image:image>`
      : '';
    const keywords = story.keywords?.length
      ? `\n      <news:keywords>${escapeXml(story.keywords.join(', '))}</news:keywords>`
      : '';

    return `  <url>
    <loc>${SITE_URL}/${story.id}/</loc>
    <lastmod>${new Date(story.publishedAt).toISOString()}</lastmod>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(story.publishedAt).toISOString()}</news:publication_date>
      <news:title>${escapeXml(story.headline)}</news:title>${keywords}
    </news:news>${imageTag}
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
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
