import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAllArchivedStories, SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '../lib/helpers';

export function GET(context: APIContext) {
  // Include all archived stories so the feed has history
  const stories = getAllArchivedStories();

  // Sort newest first, limit to 50 most recent
  const sorted = stories
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 50);

  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site: context.site!.toString(),
    items: sorted.map((story) => ({
      title: story.headline,
      pubDate: new Date(story.publishedAt),
      description: story.summary,
      link: `${SITE_URL}/${story.id}/`,
      categories: [story.neighborhood, ...(story.keywords || [])].filter(Boolean),
      content: story.body,
    })),
    customData: `<language>en-us</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
<pubDate>${sorted[0] ? new Date(sorted[0].publishedAt).toUTCString() : new Date().toUTCString()}</pubDate>
<ttl>60</ttl>
<atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
<image>
  <url>${SITE_URL}/favicon.svg</url>
  <title>${SITE_NAME}</title>
  <link>${SITE_URL}</link>
</image>`,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },
  });
}
