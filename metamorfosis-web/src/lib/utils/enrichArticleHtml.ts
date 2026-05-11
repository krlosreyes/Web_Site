/**
 * SPEC-065: Enriquecedor del HTML de marked para artículos.
 *
 * marked.parse() genera HTML semántico estándar, pero para lograr el nivel de
 * formato visual de un artículo HubSpot (callouts diferenciados por tipo,
 * tablas, listas con ✅/❌, índice de contenidos) necesitamos un paso extra
 * de post-procesamiento.
 *
 * Este helper:
 *
 * 1. Asigna IDs slugificados a cada `<h2>` para que el TOC pueda linkear.
 * 2. Detecta blockquotes que empiezan con prefijos especiales y les añade
 *    una clase específica:
 *       - "Respuesta rápida:"        → callout-fast        (naranja)
 *       - "Dato clave:"              → callout-key         (azul)
 *       - "Rendimiento comprobado:"  → callout-perf        (verde)
 *       - "Transición recomendada:"  → callout-transition  (amber)
 *       - "Dato de implementación:"  → callout-impl        (morado)
 *    Los blockquotes sin prefijo se quedan con el estilo default
 *    "CLAVE DEL PROTOCOLO" (teal).
 * 3. Detecta `<li>` que empiezan con ✅ o ❌ y les añade la clase
 *    `check-yes`/`check-no`. El CSS los renderiza como bullets coloreados
 *    sin sobrescribir el grid de cards genérico.
 * 4. Genera un índice de contenidos (TOC) a partir de los H2 si hay ≥3.
 *    El TOC se inserta DESPUÉS del primer párrafo del artículo.
 *
 * Decisiones:
 * - Post-procesamiento del HTML con regex en lugar de custom renderer de
 *   marked: más simple, sin atarse al API mutante de marked v9/v10.
 * - Clases sobre `<blockquote>` / `<li>` en lugar de envolver en `<div>`s
 *   extra: el HTML resultante sigue siendo semánticamente correcto.
 * - TOC se omite si hay <3 H2s: para artículos cortos sería ruido visual.
 */

import { slugify } from './slugify';

export interface Heading {
    id: string;
    text: string;
}

export interface EnrichedHtml {
    html: string;
    headings: Heading[];
}

const CALLOUT_PREFIXES: Array<{ prefix: string; className: string }> = [
    { prefix: 'Respuesta rápida', className: 'callout-fast' },
    { prefix: 'Dato clave', className: 'callout-key' },
    { prefix: 'Rendimiento comprobado', className: 'callout-perf' },
    { prefix: 'Transición recomendada', className: 'callout-transition' },
    { prefix: 'Dato de implementación', className: 'callout-impl' },
];

/**
 * Escapa caracteres regex en una string. Necesario porque los prefijos
 * tienen tildes — aunque hoy no contengan metacaracteres, futuro-proof.
 */
function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Decodifica entidades HTML básicas en el texto extraído de un H2.
 * marked produce `&amp;`, `&#39;`, etc. — para el TOC y para los IDs queremos
 * el texto plano legible.
 */
function decodeBasicEntities(s: string): string {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

/**
 * Strip de tags HTML internos del texto de un heading (ej. `<strong>foo</strong>`
 * → `foo`). El TOC muestra texto plano.
 */
function stripInnerTags(s: string): string {
    return s.replace(/<[^>]+>/g, '');
}

export function enrichArticleHtml(rawHtml: string): EnrichedHtml {
    let html = rawHtml;
    const headings: Heading[] = [];

    // 1) IDs en H2 + recolectar para el TOC
    html = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (_match, attrs: string | undefined, inner: string) => {
        const plainText = decodeBasicEntities(stripInnerTags(inner)).trim();
        if (!plainText) return `<h2${attrs ?? ''}>${inner}</h2>`;
        const id = slugify(plainText);
        headings.push({ id, text: plainText });
        // Si ya tiene attrs (poco probable desde marked default), no pisar id existente
        const hasId = attrs && /\sid=/.test(attrs);
        if (hasId) return `<h2${attrs}>${inner}</h2>`;
        return `<h2 id="${id}"${attrs ?? ''}>${inner}</h2>`;
    });

    // 2) Callout boxes por prefijo
    for (const { prefix, className } of CALLOUT_PREFIXES) {
        // marked emite el blockquote con un \n inicial: <blockquote>\n<p>...
        // El prefijo puede venir como **Prefix:** que marked convierte a <strong>Prefix:</strong>
        // Soportamos también la variante sin negrita y con/sin dos puntos.
        const escapedPrefix = escapeRegex(prefix);
        const pattern = new RegExp(
            `<blockquote>(\\s*<p>)(\\s*)(<strong>\\s*${escapedPrefix}\\s*:?\\s*<\\/strong>|${escapedPrefix}\\s*:)`,
            'gi'
        );
        html = html.replace(pattern, `<blockquote class="${className}">$1$2$3`);
    }

    // 3) ✅/❌ en listas
    // marked emite <li>texto</li>. Detectamos el primer carácter del contenido.
    html = html
        .replace(/<li>(\s*)✅(\s*)/g, '<li class="check-yes">$1✅$2')
        .replace(/<li>(\s*)❌(\s*)/g, '<li class="check-no">$1❌$2');

    // 4) TOC si hay ≥3 H2s
    if (headings.length >= 3) {
        const tocItems = headings
            .map(h => `<li><a href="#${h.id}">${h.text}</a></li>`)
            .join('');
        const tocHtml = `<nav class="article-toc" aria-label="Índice del artículo"><div class="article-toc-label">En este artículo</div><ol class="article-toc-list">${tocItems}</ol></nav>`;

        // Insertar después del primer </p> (introducción). Si no hay </p>,
        // insertar al principio.
        const firstParaClose = html.indexOf('</p>');
        if (firstParaClose >= 0) {
            html = html.slice(0, firstParaClose + 4) + tocHtml + html.slice(firstParaClose + 4);
        } else {
            html = tocHtml + html;
        }
    }

    return { html, headings };
}
