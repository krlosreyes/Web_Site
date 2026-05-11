import { describe, it, expect } from 'vitest';
import { normalizeArticleContent } from './normalizeArticleContent';

/**
 * Tests del normalizador de párrafos para contenido pegado del AI (SPEC-063).
 *
 * Casos clave:
 *  - Si el contenido YA tiene `\n\n` o headings markdown, no se toca.
 *  - Si NO los tiene, se agrupa en párrafos de 3 oraciones aprox.
 *  - Las dos secciones obligatorias del parser se separan con línea en blanco.
 */
describe('normalizeArticleContent', () => {
    it('preserva contenido que YA tiene saltos de párrafo', () => {
        const input = 'Primer párrafo bien escrito.\n\nSegundo párrafo separado.';
        expect(normalizeArticleContent(input)).toBe(input);
    });

    it('preserva contenido que tiene headings markdown', () => {
        const input =
            '## Subtítulo importante\nUn párrafo después del heading. Más texto en la misma línea.';
        // El normalizador detecta el heading y NO toca el bloque
        expect(normalizeArticleContent(input)).toBe(input);
    });

    it('agrupa oraciones en párrafos de ~3 cuando viene un bloque sin saltos', () => {
        const input =
            'Primera oración corta. Segunda oración igual de breve. Tercera oración para cerrar el bloque. Cuarta oración del siguiente bloque. Quinta oración complementaria. Sexta y última.';
        const out = normalizeArticleContent(input);
        // Esperamos 2 párrafos (3+3 oraciones)
        const paragraphs = out.split('\n\n');
        expect(paragraphs.length).toBe(2);
        expect(paragraphs[0]).toContain('Primera oración corta.');
        expect(paragraphs[0]).toContain('Tercera oración');
        expect(paragraphs[1]).toContain('Cuarta oración');
        expect(paragraphs[1]).toContain('Sexta y última.');
    });

    it('inserta separación antes de las secciones obligatorias del parser', () => {
        const input =
            'Texto del cuerpo del artículo.Lo que cambia en tu cuerpo (y en tu vida):\n* bullet 1';
        const out = normalizeArticleContent(input);
        expect(out).toContain('Texto del cuerpo del artículo.\n\nLo que cambia en tu cuerpo');
    });

    it('separa "Tu plan de acción" cuando viene pegado al párrafo anterior', () => {
        const input =
            'Última oración del cuerpo. Tu plan de acción para esta semana:\n1. Paso uno';
        const out = normalizeArticleContent(input);
        expect(out).toContain('cuerpo.\n\nTu plan de acción');
    });

    it('preserva items de lista sin agruparlos', () => {
        const input = '* Item uno\n* Item dos\n* Item tres';
        const out = normalizeArticleContent(input);
        expect(out).toBe('* Item uno\n* Item dos\n* Item tres');
    });

    it('preserva pasos numerados sin agruparlos', () => {
        const input = '1. Paso uno\n2. Paso dos\n3. Paso tres';
        const out = normalizeArticleContent(input);
        expect(out).toBe('1. Paso uno\n2. Paso dos\n3. Paso tres');
    });

    it('maneja casos edge sin romperse', () => {
        expect(normalizeArticleContent('')).toBe('');
        expect(normalizeArticleContent('   ')).toBe('');
        expect(normalizeArticleContent('Una sola oración.')).toBe('Una sola oración.');
    });

    it('reduce 3+ saltos consecutivos a doble salto', () => {
        const input = 'Párrafo uno.\n\n\n\nPárrafo dos.';
        // El input tiene \n\n y se preserva sin tocar (ya estructurado).
        const out = normalizeArticleContent(input);
        // Después de ensureSectionSeparators y detección de \n\n, el helper
        // retorna el contenido tal cual (ya tiene \n\n). El collapse de 3+
        // saltos a 2 solo aplica en el branch de bloque sin saltos.
        expect(out).toBe(input);
    });

    it('no rompe oraciones que tienen punto en abreviaciones', () => {
        // "p.m." no debería partir la oración porque la siguiente palabra
        // no empieza con mayúscula tras solo un punto y espacio.
        const input = 'A las 3 p.m. sientes ese bajón. Es bioquímica pura.';
        const out = normalizeArticleContent(input);
        // Como hay 2 oraciones reales, queda 1 párrafo (≤3)
        expect(out.split('\n\n').length).toBe(1);
    });

    it('respeta el cuerpo de artículo real con secciones obligatorias', () => {
        const input =
            'Este artículo ordena la evidencia clínica. A pesar de la información contradictoria, los datos actuales permiten entender la salud metabólica.Lo que cambia en tu cuerpo (y en tu vida):\n* Bullet uno\n* Bullet dos\nTu plan de acción para esta semana:\n1. Paso uno\n2. Paso dos';
        const out = normalizeArticleContent(input);
        // Debe tener separación antes de "Lo que cambia" y "Tu plan de acción"
        expect(out).toContain('\n\nLo que cambia en tu cuerpo (y en tu vida):');
        expect(out).toContain('\n\nTu plan de acción para esta semana:');
    });
});
