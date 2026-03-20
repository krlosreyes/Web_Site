// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // Cambiado a 'static' para permitir build local sin adaptador server.
  // El proyecto originalmente usaba salida server-side; al desplegar, configura el adaptador apropiado.
  output: 'static',
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