/**
 * Self-exclusion del admin para counters de artículos (SPEC-091).
 *
 * Carlos navega su propio sitio desde múltiples dispositivos (Mac,
 * iPhone, iPad). Sin esto, sus visitas y clicks inflan los contadores
 * de SPEC-086 — especialmente grave en pre-lanzamiento donde el 80%
 * del tráfico es suyo.
 *
 * La cookie `admin_session` (HttpOnly, SameSite=Strict) excluye al
 * admin logueado al panel, pero solo en ESE dispositivo y ESE
 * browser. Esta es una segunda capa de exclusión que sobrevive
 * a logout y funciona aunque el dispositivo nunca haya tenido
 * `admin_session`.
 *
 * Mecanismo:
 *   1. Visitar cualquier URL del sitio con `?mr-admin=1` setea la
 *      cookie `mr_admin_self=1` con Max-Age 1 año.
 *   2. Mientras la cookie esté presente con value '1', NO se cuentan
 *      vistas ni clicks de ese dispositivo.
 *   3. Visitar `?mr-admin=0` borra la cookie.
 *
 * Pure TS, sin dependencias. Se usa server-side (frontmatter de Astro
 * + endpoint POST).
 */

export const ADMIN_SELF_COOKIE = 'mr_admin_self';

/** Interfaz mínima que tanto Astro.cookies como un Request manual implementan. */
export interface CookieReader {
    get(name: string): { value?: string } | undefined;
}

/**
 * Returns true si el dispositivo está auto-excluido. Lee la cookie
 * `mr_admin_self` y chequea si su value es exactamente '1'.
 *
 * Cualquier otro value (incluido '0', vacío, ausente) → false.
 * Esto hace que `?mr-admin=0` desactive limpiamente.
 */
export function isSelfExcluded(cookies: CookieReader): boolean {
    const c = cookies.get(ADMIN_SELF_COOKIE);
    return c?.value === '1';
}

/**
 * Parsea el header `Cookie` crudo (formato HTTP) y retorna un
 * CookieReader minimal. Usado en endpoints que reciben un Request
 * (donde no tenemos Astro.cookies disponible directamente).
 */
export function readCookiesFromHeader(cookieHeader: string | null): CookieReader {
    const jar: Record<string, string> = {};
    if (cookieHeader) {
        for (const part of cookieHeader.split(';')) {
            const idx = part.indexOf('=');
            if (idx === -1) continue;
            const name = part.slice(0, idx).trim();
            const value = part.slice(idx + 1).trim();
            if (name) jar[name] = decodeURIComponent(value);
        }
    }
    return {
        get(name: string) {
            return name in jar ? { value: jar[name] } : undefined;
        },
    };
}

/**
 * Decide qué hacer con el query param `?mr-admin` y retorna la
 * acción que el caller debe aplicar a `Astro.cookies`.
 *
 * - `mr-admin=1` → setear cookie con value '1' por 1 año.
 * - `mr-admin=0` → eliminar cookie.
 * - cualquier otro → no tocar.
 *
 * Devolvemos un objeto descriptivo (en lugar de mutar) para que la
 * función sea pura y testeable.
 */
export type CookieAction =
    | { type: 'set'; value: '1'; maxAge: number }
    | { type: 'delete' }
    | { type: 'noop' };

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function decideCookieAction(
    searchParams: URLSearchParams,
): CookieAction {
    const value = searchParams.get('mr-admin');
    if (value === '1') {
        return { type: 'set', value: '1', maxAge: ONE_YEAR_SECONDS };
    }
    if (value === '0') {
        return { type: 'delete' };
    }
    return { type: 'noop' };
}
