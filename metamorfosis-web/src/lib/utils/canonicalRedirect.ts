/**
 * SPEC-115 — Redirects canónicos (301) calculados de forma pura.
 *
 * Reglas, en orden y combinadas en UN solo salto:
 *   1. host `www.<site>` → host `<site>` (T2 de la auditoría SEO 2026-09-11).
 *   2. Slug legacy en LEGACY_POST_REDIRECTS → slug vigente (T7).
 *   3. Barra final en cualquier path ≠ "/" → sin barra (trailingSlash "never").
 *
 * Solo aplica a GET/HEAD: un 301 sobre POST/PUT/DELETE a /api/* haría que el
 * navegador reenvíe como GET y perdería el body.
 *
 * El host se lee de `x-forwarded-host` y luego `host` (el reverse proxy de
 * Hostinger HCDN puede no propagar `Host`; ver SPEC-052b). Si ninguno
 * identifica a `www.<site>`, NO se redirige: nunca se asume, así que un header
 * ausente no puede producir un bucle.
 */

/** slug viejo → slug vigente (sin /posts/ ni barras). */
export const LEGACY_POST_REDIRECTS: Record<string, string> = {
    'que-pasa-cuerpo-16-horas-autofagia':
        'ayuno-intermitente-guia-practica-para-sanar-tu-metabolismo-sin-pasar-hambre',
};

export interface CanonicalRedirectInput {
    /** Valor de `x-forwarded-host` (o null). */
    forwardedHost: string | null;
    /** Valor de `host` (o null). */
    host: string | null;
    method: string;
    pathname: string;
    search: string;
    /** `Astro.site` (origen canónico, sin www). */
    site: URL;
}

/** Primer host de un header que puede venir como lista "a.com, b.com". */
function firstHost(raw: string | null): string | null {
    if (!raw) return null;
    const first = raw.split(',')[0]?.trim().toLowerCase();
    if (!first) return null;
    // Quita el puerto si lo hay.
    return first.replace(/:\d+$/, '');
}

/**
 * Devuelve la URL absoluta destino del 301, o null si la request ya es
 * canónica.
 */
export function getCanonicalRedirect(input: CanonicalRedirectInput): string | null {
    const method = input.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return null;

    const apex = input.site.hostname.toLowerCase();
    const requestHost = firstHost(input.forwardedHost) ?? firstHost(input.host);
    const isWww = requestHost === `www.${apex}`;

    let path = input.pathname;
    let changed = isWww;

    // Barra final (excepto raíz). Colapsa múltiples barras finales.
    if (path.length > 1 && path.endsWith('/')) {
        path = path.replace(/\/+$/, '') || '/';
        changed = true;
    }

    // Slug legacy → vigente.
    const legacy = /^\/posts\/([^/]+)$/.exec(path);
    if (legacy) {
        const target = LEGACY_POST_REDIRECTS[legacy[1]];
        if (target) {
            path = `/posts/${target}`;
            changed = true;
        }
    }

    if (!changed) return null;
    return `${input.site.origin}${path}${input.search}`;
}
