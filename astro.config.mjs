import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// Демо на GitHub Pages: подпапку и адрес задаёт workflow, локально – корень.
const SITE = process.env.PUBLIC_SITE_URL || 'https://tema-mail.github.io';
const BASE = process.env.PUBLIC_BASE || '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: [preact()],
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
