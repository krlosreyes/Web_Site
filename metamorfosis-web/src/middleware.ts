/**
 * SPEC-115 — Middleware global: redirects canónicos 301.
 *
 * Toda la lógica vive en `lib/utils/canonicalRedirect.ts` (pura y testeada).
 * Este archivo solo conecta la request de Astro con esa función.
 *
 * Por qué acá y no en `public/.htaccess`: el sitio corre como app Node.js
 * (`@astrojs/node` standalone) detrás de Hostinger, no como sitio estático
 * servido por Apache, así que el `.htaccess` de la auditoría no aplicaría.
 */
import { defineMiddleware } from 'astro:middleware';
import { getCanonicalRedirect } from './lib/utils/canonicalRedirect';

export const onRequest = defineMiddleware((context, next) => {
    const site = context.site;
    if (site) {
        const target = getCanonicalRedirect({
            forwardedHost: context.request.headers.get('x-forwarded-host'),
            host: context.request.headers.get('host'),
            method: context.request.method,
            pathname: context.url.pathname,
            search: context.url.search,
            site,
        });
        if (target) return context.redirect(target, 301);
    }
    return next();
});
