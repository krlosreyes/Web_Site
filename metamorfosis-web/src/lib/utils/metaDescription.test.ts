import { describe, expect, test } from 'vitest';
import {
    buildMetaDescription,
    META_DESCRIPTION_MAX,
    stripMarkdown,
    truncateAtBoundary,
} from './metaDescription';

describe('stripMarkdown', () => {
    test('quita prefijo CONTENIDO, encabezados, énfasis y enlaces', () => {
        const md = 'CONTENIDO: ## Título\n\nTexto con **negrita** y [un enlace](https://x.com) aquí.';
        expect(stripMarkdown(md)).toBe('Texto con negrita y un enlace aquí.');
    });
    test('quita listas, citas y bloques de código', () => {
        expect(stripMarkdown('> cita\n- item\n1. uno\n```js\ncode\n```\nfin')).toBe('cita item uno fin');
    });
});

describe('truncateAtBoundary', () => {
    test('texto corto se devuelve igual', () => {
        expect(truncateAtBoundary('Hola mundo.')).toBe('Hola mundo.');
    });
    test('nunca corta a mitad de palabra ni excede el máximo', () => {
        const text = 'palabra '.repeat(60).trim();
        const out = truncateAtBoundary(text);
        expect(out.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX + 1); // +1 por "…"
        expect(out.endsWith('…')).toBe(true);
        expect(out.replace('…', '').split(' ').every((w) => w === 'palabra')).toBe(true);
    });
    test('prefiere cortar en fin de oración', () => {
        const text =
            'Esta es una primera oración bastante larga que ocupa buena parte del espacio disponible. ' +
            'Segunda oración que ya no cabe completa dentro del límite de caracteres permitido aquí.';
        const out = truncateAtBoundary(text);
        expect(out.endsWith('disponible.')).toBe(true);
    });
});

describe('buildMetaDescription', () => {
    test('usa la descripción manual si existe', () => {
        expect(buildMetaDescription('  Descripción escrita a mano.  ', 'cuerpo largo')).toBe('Descripción escrita a mano.');
    });
    test('deriva del contenido si no hay manual', () => {
        expect(buildMetaDescription('', 'CONTENIDO: Un cuerpo **simple**.')).toBe('Un cuerpo simple.');
        expect(buildMetaDescription(undefined, null)).toBe('');
    });
    test('regresión T6: no termina cortado a media palabra', () => {
        const body = 'Cuando ayunas el cuerpo cambia de combustible y empieza a usar grasa. '.repeat(10);
        const out = buildMetaDescription(null, body);
        expect(out.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX + 1);
        expect(/[.…]$/.test(out)).toBe(true);
    });
});
