// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// SSR sobre Node.js — desplegado en Hostinger Node.js Apps (plan Business).
// Ver specs/SPEC-001-ssr-deploy-strategy.md
// https://astro.build/config
export default defineConfig({
  output: 'server',

  adapter: node({
    mode: 'standalone',
  }),

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },
});
