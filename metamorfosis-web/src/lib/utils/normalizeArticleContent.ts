/**
 * Normalización del contenido de artículos pegado en el admin editor (SPEC-063).
 *
 * Problema: las IAs (Gemini, GPT, etc.) frecuentemente generan el cuerpo del
 * artículo como un solo bloque de texto con `.` entre oraciones pero SIN
 * `\n\n` reales entre párrafos. Cuando `marked.parse()` procesa eso,
 * convierte todo en un único `<p>...</p>` — el resultado en pantalla es un
 * muro de texto que ignora todos los estilos `prose` del renderer.
 *
 * Este helper detecta el caso problemático y aplica una heurística simple
 * para forzar párrafos visualmente legibles, SIN tocar el contenido cuando
 * ya viene bien formateado.
 *
 * Reglas:
 *   1. Si el contenido YA tiene `\n\n` o headings markdown (`##`, `###`),
 *      confiamos en la IA y NO modificamos nada.
 *   2. Si NO los tiene, dividimos por oraciones (punto + espacio + mayúscula)
 *      y agrupamos en párrafos de 3 oraciones aproximadamente.
 *   3. Las dos secciones obligatorias del parser ("Lo que cambia en tu
 *      cuerpo (y en tu vida):" y "Tu plan de acción para esta semana:")
 *      siempre reciben línea en blanco antes para que se vean separadas.
 *   4. Items de listas (líneas que empiezan con `*` o `1.`) se preservan
 *      como están — no se agrupan con texto.
 */

const PARAGRAPH_TARGET_SENTENCES = 3;

/**
 * Detecta si el contenido ya tiene estructura visual decente (la IA hizo
 * el trabajo bien). Si tiene cualquiera de estos marcadores, no tocamos.
 */
function isAlreadyStructured(text: string): boolean {
    // Doble salto de línea = ya hay párrafos.
    if (text.includes('\n\n')) return true;
    // Headings markdown = la IA respetó el formato.
    if (/^#{2,3}\s/m.test(text)) return true;
    // Blockquote = idem.
    if (/^>\s/m.test(text)) return true;
    return false;
}

/**
 * Divide un texto en oraciones usando una heurística simple:
 * punto/signo terminal + espacio + letra mayúscula del siguiente
 * arranque. Cubre `.`, `?`, `!` y respeta caracteres acentuados.
 */
function splitIntoSentences(text: string): string[] {
    // Regex: signo terminal + uno o más espacios + lookahead a una mayúscula
    // (incluyendo acentos españoles). Usamos `(?<=...)` y `(?=...)` para
    // que el split no consuma los caracteres.
    return text
        .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"«])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

/**
 * Agrupa oraciones en párrafos de tamaño objetivo.
 */
function groupIntoParagraphs(sentences: string[], targetSize = PARAGRAPH_TARGET_SENTENCES): string[] {
    const paragraphs: string[] = [];
    for (let i = 0; i < sentences.length; i += targetSize) {
        paragraphs.push(sentences.slice(i, i + targetSize).join(' '));
    }
    return paragraphs;
}

/**
 * Asegura que las dos secciones obligatorias del parser tengan línea en
 * blanco antes para que se vean separadas del párrafo previo.
 */
function ensureSectionSeparators(text: string): string {
    return text
        .replace(
            /([^\n])\s*(Lo que cambia en tu cuerpo \(y en tu vida\):)/g,
            '$1\n\n$2',
        )
        .replace(
            /([^\n])\s*(Tu plan de acción para esta semana:)/g,
            '$1\n\n$2',
        );
}

/**
 * Normaliza el contenido pegado en el editor. Si ya viene bien formateado,
 * no modifica nada. Si viene como bloque, inserta saltos heurísticamente.
 */
export function normalizeArticleContent(input: string): string {
    if (!input || !input.trim()) return '';

    // Antes que nada: garantizar separación de las secciones obligatorias.
    const withSeparators = ensureSectionSeparators(input);

    if (isAlreadyStructured(withSeparators)) {
        // La IA ya entregó markdown decente. No tocamos.
        return withSeparators;
    }

    // Caso problema: bloque continuo. Aplicamos heurística.
    // Pero respetamos líneas que ya son items de lista o numeración.
    const lines = withSeparators.split('\n');
    const out: string[] = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            out.push('');
            continue;
        }
        // Items de lista, pasos numerados, headings, blockquotes → no agrupar
        if (/^(\*|-|>|#{1,6}\s|\d+\.\s)/.test(line)) {
            out.push(line);
            continue;
        }
        // Sección obligatoria del parser → preservar literal
        if (
            line === 'Lo que cambia en tu cuerpo (y en tu vida):' ||
            line === 'Tu plan de acción para esta semana:'
        ) {
            out.push(line);
            continue;
        }
        // Línea de texto normal: dividir en oraciones y agrupar
        const sentences = splitIntoSentences(line);
        if (sentences.length <= 1) {
            out.push(line);
        } else {
            const paragraphs = groupIntoParagraphs(sentences);
            out.push(paragraphs.join('\n\n'));
        }
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
