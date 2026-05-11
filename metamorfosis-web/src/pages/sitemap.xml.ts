/**
 * GET /sitemap.xml — sitemap dinámico (SPEC-027).
 *
 * Lista canónica de URLs indexables: páginas estáticas relevantes + posts
 * publicados desde Firestore (filtra drafts según SPEC-015). Cache 1h en
 * el cliente / CDN para balancear frescura y carga.
 *
 * Si Carlos cambia el dominio, actualizar la constante BASE_URL.
 */

import type { APIRoute } from 'astro';
import { db } from '../lib/firebaseAdmin';
import { COLLECTIONS } from '../lib/constants/firestore';

export const prerender = false;

const BASE_URL = 'https://metamorfosisvital.com.co';

interface StaticPage {
    path: string;
    priority: number;
    changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

const STATIC_PAGES: StaticPage[] = [
    { path: '/', priority: 1.0, changefreq: 'weekly' },
    { path: '/biblioteca', priority: 0.9, changefreq: 'daily' },
    { path: '/quiz', priority: 0.9, changefreq: 'monthly' },
    { path: '/comunidad', priority: 0.7, changefreq: 'monthly' },
    { path: '/sobre-mi', priority: 0.6, changefreq: 'yearly' },
    // SPEC-051: removidas /calculadora (ahora redirect 301 a /quiz) y
    // /protocolo (experimento descartado, página borrada). Google las
    // descubrirá fuera del sitemap como 301/404 y dejará de indexarlas.
    { path: '/terminos', priority: 0.2, changefreq: 'yearly' },
    { path: '/privacidad', priority: 0.2, changefreq: 'yearly' },
];

/** Escapa caracteres XML especiales en un string. */
function xmlEscape(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/** Normaliza un timestamp a string ISO (válido para <lastmod>). null si no parsea. */
function toIso(raw: unknown): string | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof raw === 'object' && raw !== null) {
        const ts = raw as { toDate?: () => Date; _seconds?: number };
        if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
        if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toISOString();
    }
    return null;
}

export const GET: APIRoute = async () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Posts publicados — SPEC-015: legacy (sin status) cuenta como published
    let postEntries: string[] = [];
    try {
        const snapshot = await db.collection(COLLECTIONS.POSTS).get();
        const published = snapshot.docs
            .map((doc) => doc.data())
            .filter((d) => d.status === undefined || d.status === 'published')
            .filter((d) => typeof d.slug === 'string' && d.slug.length > 0);

        postEntries = published.map((p) => {
            const lastmod = toIso(p.publishedAt) || toIso(p.updatedAt) || toIso(p.createdAt);
            const lastmodStr = lastmod ? lastmod.split('T')[0] : today;
            return `  <url>
    <loc>${BASE_URL}/posts/${xmlEscape(p.slug)}</loc>
    <lastmod>${lastmodStr}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
        });
    } catch (err) {
        console.error('[sitemap.xml] Error leyendo posts:', err);
        // Best-effort: si Firestore falla, devolvemos al menos el sitemap estático
    }

    const staticEntries = STATIC_PAGES.map(
        (p) => `  <url>
    <loc>${BASE_URL}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority.toFixed(1)}</priority>
  </url>`
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries.join('\n')}
${postEntries.join('\n')}
</urlset>
`;

    return new Response(xml, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            // Cache 1h en cliente y CDN — balance entre frescura y carga.
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
    });
};
