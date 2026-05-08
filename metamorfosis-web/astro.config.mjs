// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // Cambiado a 'server' para despliegue en Vercel con SSR
  output: 'server',
  vite: {
    plugins: [tailwindcss()],
    server: {
      fs: {
        allow: ['/private/tmp/deps-install', '/tmp/deps-install', './']
      }
    }
  },
  integrations: [react()]
});