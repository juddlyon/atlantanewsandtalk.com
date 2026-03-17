// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://atlantanewsandtalk.com',
  adapter: netlify(),
  integrations: [sitemap({
    changefreq: 'daily',
    priority: 0.7,
    serialize(item) {
      // Homepage: highest priority, changes daily
      if (item.url === 'https://atlantanewsandtalk.com/') {
        item.changefreq = 'daily';
        item.priority = 1.0;
      }
      // Daily article pages
      else if (item.url.match(/atlantanewsandtalk\.com\/[a-z]+-[a-z]/) &&
               !item.url.includes('/guide/') &&
               !item.url.includes('/lists/') &&
               !item.url.includes('/neighborhoods/') &&
               !item.url.includes('/archive/')) {
        item.changefreq = 'never';
        item.priority = 0.8;
      }
      // Guides
      else if (item.url.includes('/guide/')) {
        item.changefreq = 'monthly';
        item.priority = 0.9;
      }
      // Lists
      else if (item.url.includes('/lists/')) {
        item.changefreq = 'monthly';
        item.priority = 0.8;
      }
      // Neighborhood pages
      else if (item.url.includes('/neighborhoods/')) {
        item.changefreq = 'weekly';
        item.priority = 0.7;
      }
      // Landing pages (SEO targets)
      else if (item.url.match(/atlantanewsandtalk\.com\/(atlanta|things|fifa|midtown|old-fourth|grant-park|inman|east-atlanta|downtown|buckhead|virginia|decatur|kirkwood|reynoldstown|west-midtown|summerhill)/)) {
        item.changefreq = 'daily';
        item.priority = 0.9;
      }
      // Archive pages
      else if (item.url.includes('/archive/')) {
        item.changefreq = 'never';
        item.priority = 0.3;
      }
      return item;
    },
  })],
});
