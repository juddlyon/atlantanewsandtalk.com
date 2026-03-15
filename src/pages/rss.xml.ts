import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getAllStories, SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '../lib/helpers';

export function GET(context: APIContext) {
  const stories = getAllStories();

  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site: context.site!.toString(),
    items: stories.map((story) => ({
      title: story.headline,
      pubDate: new Date(story.publishedAt),
      description: story.summary,
      link: `${SITE_URL}/${story.id}`,
      categories: [story.neighborhood, ...story.keywords].filter(Boolean),
    })),
    customData: `<language>en-us</language>`,
  });
}
