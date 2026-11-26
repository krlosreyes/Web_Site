/**
 * SPEC-120: fechas <lastmod> honestas para el sitemap.
 *
 * Antes: páginas estáticas con la fecha de hoy en cada visita (Google deja
 * de confiar en un lastmod que siempre cambia) y artículos con la fecha de
 * publicación aunque se hubieran corregido después.
 */

/** Fecha de cada revisión editorial aplicada por script a los artículos. */
export const EDITORIAL_REVISIONS: Record<string, string> = {
    'spec-119': '2026-11-26',
};

/** Normaliza un timestamp (string, Timestamp de Firestore o {_seconds}) a ISO. */
export function toIso(raw: unknown): string | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof raw === 'object') {
        const ts = raw as { toDate?: () => Date; _seconds?: number };
        if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
        if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toISOString();
    }
    return null;
}

/** La fecha más reciente entre publicación, actualización y revisión editorial (YYYY-MM-DD). */
export function postLastmod(p: Record<string, unknown>, fallback: string): string {
    const dates = [toIso(p.publishedAt), toIso(p.updatedAt), toIso(p.createdAt)]
        .filter((d): d is string => !!d)
        .map((d) => d.slice(0, 10));
    const rev = typeof p.editorialRevision === 'string' ? EDITORIAL_REVISIONS[p.editorialRevision] : undefined;
    if (rev) dates.push(rev);
    return dates.length ? dates.sort().at(-1)! : fallback;
}
