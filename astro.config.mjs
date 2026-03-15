// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://atlantanewsandtalk.com',
  adapter: netlify(),
  integrations: [sitemap()],
});
