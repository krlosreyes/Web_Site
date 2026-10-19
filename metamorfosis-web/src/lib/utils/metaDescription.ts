/**
 * SPEC-115 — Meta description sin cortes a media palabra (T6, auditoría SEO).
 *
 * Antes: `content.substring(0, 160)` sobre el markdown crudo, que cortaba
 * palabras ("…con todas sus fuerzas. Te l") e incluía el prefijo "CONTENIDO:"
 * y sintaxis markdown.
 *
 * Prioridad: `description` manual (campo Firestore) → derivada del cuerpo.
 */

export const META_DESCRIPTION_MAX = 155;

/** Quita markdown y prefijos de plantilla para obtener texto plano. */
export function stripMarkdown(input: string): string {
    return input
        .replace(/^\s*CONTENIDO:?\s*/i, '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}#{1,6}\s+.*$/gm, ' ')
        .replace(/^\s*>\s?/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/^\s*\|.*\|\s*$/gm, ' ')
        .replace(/[*_`~]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Corta `text` a ≤ `max` caracteres, preferentemente en el último fin de
 * oración; si no hay, en el último espacio. Nunca a mitad de palabra.
 */
export function truncateAtBoundary(text: string, max = META_DESCRIPTION_MAX): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;

    const window = clean.slice(0, max + 1);
    // Último fin de oración que deje al menos 60 caracteres útiles.
    const sentenceEnd = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('? '),
        window.lastIndexOf('! '),
    );
    if (sentenceEnd >= 60) return window.slice(0, sentenceEnd + 1).trim();

    const lastSpace = window.lastIndexOf(' ', max);
    const cut = lastSpace > 0 ? window.slice(0, lastSpace) : clean.slice(0, max);
    return cut.replace(/[\s,;:\-–—(]+$/, '') + '…';
}

/** Descripción final del artículo: manual si existe, si no derivada. */
export function buildMetaDescription(manual: unknown, content: unknown): string {
    if (typeof manual === 'string' && manual.trim().length > 0) {
        return truncateAtBoundary(manual.trim(), 200);
    }
    return truncateAtBoundary(stripMarkdown(typeof content === 'string' ? content : ''));
}
