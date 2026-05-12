/**
 * POST /api/posts/[slug]/click — incrementa analytics.clicks (SPEC-086).
 *
 * Invocado por `navigator.sendBeacon()` desde /posts/[slug].astro al
 * clickear los CTAs principales del artículo (Iniciar diagnóstico IMR,
 * Entrar a la comunidad). El beacon es fire-and-forget: el browser
 * lo entrega antes de navegar y no nos importa la respuesta.
 *
 * Por eso respondemos 204 No Content (sin body) y nunca lanzamos.
 *
 * sendBeacon manda Content-Type según el payload:
 *   - Sin payload → Content-Type omitido o `application/x-www-form-urlencoded`
 *   - Con Blob de application/json → `application/json`
 * Astro 6 CSRF (GET-config) bloquea POST sin Content-Type válido, así que
 * el frontend siempre envía un Blob de application/json vacío `{}` para
 * pasar el filtro.
 */

import type { APIRoute } from 'astro';
import { incrementClick } from '../../../../lib/postAnalytics';

export const prerender = false;

export const POST: APIRoute = async ({ params }) => {
    const slug = typeof params.slug === 'string' ? params.slug : '';
    if (!slug) {
        return new Response(null, { status: 204 });
    }
    // Fire-and-forget desde la perspectiva del browser. Acá sí lo
    // esperamos para asegurar que Firestore registró el increment
    // antes de cerrar la conexión, pero si falla, no lo propagamos.
    try {
        await incrementClick(slug);
    } catch (err) {
        console.error('[api/posts/click] error:', err);
    }
    return new Response(null, { status: 204 });
};
