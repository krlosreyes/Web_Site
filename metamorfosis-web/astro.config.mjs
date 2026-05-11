// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// SSR sobre Node.js — desplegado en Hostinger Node.js Apps (plan Business).
// Ver specs/SPEC-001-ssr-deploy-strategy.md
// https://astro.build/config
export default defineConfig({
  // SPEC-052b: URL canónica del sitio. Usada por `Astro.site` para
  // construir URLs absolutas (canonical, OG image, OG url, sitemap, etc.).
  // Sin esto, `Astro.url` cae a `http://localhost:4321/` en SSR cuando el
  // request header `Host` no se propaga bien a través del reverse proxy de
  // Hostinger HCDN, rompiendo previews de redes sociales (FB/LinkedIn
  // intentan fetchear localhost y fallan silenciosamente).
  site: 'https://metamorfosisvital.com.co',

  output: 'server',

  adapter: node({
    mode: 'standalone',
  }),

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },
});
