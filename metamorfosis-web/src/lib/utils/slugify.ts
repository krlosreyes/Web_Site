/**
 * Generador de slug ASCII-safe con transliteración correcta del español (SPEC-062).
 *
 * El generador anterior usaba `replace(/[^\w\-]+/g, '')` que ELIMINA cualquier
 * carácter no-ASCII, incluyendo tildes y eñes. Resultado: "¿por qué te da
 * sueño?" → "por-qu-te-da-sueo" (sin sentido, malo para SEO, palabras
 * mutiladas en la URL).
 *
 * Este helper usa `String.prototype.normalize('NFD')` para descomponer
 * cada carácter acentuado en su letra base + combining mark (ej. 'é' →
 * 'e' + '́'), luego elimina los combining marks, dejando solo letras
 * ASCII. Resultado: "¿por qué te da sueño?" → "por-que-te-da-sueno".
 *
 * Truncado a 100 chars para evitar URLs problemáticas en algunos servers.
 */

/** Transliteración ASCII + slugificación a kebab-case. */
export function slugify(input: string): string {
    return input
        .toLowerCase()
        .trim()
        // NFD descompone acentos: 'á' → 'a' + '́', 'ñ' → 'n' + '̃'.
        .normalize('NFD')
        // Elimina TODOS los combining marks (acentos, tildes, diéresis, etc.).
        // Rango Unicode ̀-ͯ cubre el bloque Combining Diacritical Marks.
        .replace(/[̀-ͯ]/g, '')
        // Reemplaza espacios y separadores por un solo guion.
        .replace(/\s+/g, '-')
        // Elimina cualquier carácter que no sea alfanumérico ASCII o guion.
        // (Después de NFD, las letras españolas ya son ASCII.)
        .replace(/[^a-z0-9-]+/g, '')
        // Dedup guiones consecutivos.
        .replace(/-+/g, '-')
        // Quita guiones iniciales y finales.
        .replace(/^-+|-+$/g, '')
        // Trunca para evitar URLs muy largas.
        .substring(0, 100)
        // Re-trim por las dudas: si el truncado dejó un '-' al final.
        .replace(/-+$/, '');
}
