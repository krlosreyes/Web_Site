import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

/**
 * Tests del generador de slug (SPEC-062).
 *
 * Casos clave: tildes y eñes deben transliterarse a ASCII en lugar de
 * eliminarse. Antes de SPEC-062, `slugify("¿Por qué tienes sueño?")`
 * devolvía "por-qu-tienes-sueo" (sin sentido). Después: "por-que-tienes-sueno".
 */
describe('slugify', () => {
    it('translitera tildes y eñes a ASCII', () => {
        expect(slugify('Sueño')).toBe('sueno');
        expect(slugify('qué')).toBe('que');
        expect(slugify('después')).toBe('despues');
        expect(slugify('año')).toBe('ano');
        expect(slugify('niño')).toBe('nino');
    });

    it('genera slug correcto de los títulos reales de Carlos (anti-regresión SPEC-062)', () => {
        expect(
            slugify('¿Por qué te da sueño después de comer y tu ropa ya no te queda?'),
        ).toBe('por-que-te-da-sueno-despues-de-comer-y-tu-ropa-ya-no-te-queda');

        expect(
            slugify('El Botón de Reinicio que tu Cuerpo Necesita (y que Nadie te Enseñó a Usar)'),
        ).toBe('el-boton-de-reinicio-que-tu-cuerpo-necesita-y-que-nadie-te-enseno-a-usar');

        expect(
            slugify('¿Por qué tu cansancio de las 3 p.m. es en realidad sed?'),
        ).toBe('por-que-tu-cansancio-de-las-3-pm-es-en-realidad-sed');

        expect(
            slugify('¿Sabías que tu cena es en realidad una charla privada con tus genes?'),
        ).toBe('sabias-que-tu-cena-es-en-realidad-una-charla-privada-con-tus-genes');
    });

    it('reemplaza espacios por un solo guion', () => {
        expect(slugify('Hola Mundo')).toBe('hola-mundo');
        expect(slugify('Tres   Espacios')).toBe('tres-espacios');
        expect(slugify('Con\ttab')).toBe('con-tab');
    });

    it('elimina signos de puntuación y caracteres especiales', () => {
        expect(slugify('¡¿¡¡Hola!?!')).toBe('hola');
        expect(slugify('A!@#$%^&*()B')).toBe('ab');
        expect(slugify('comma, period.')).toBe('comma-period');
    });

    it('dedupea guiones consecutivos', () => {
        expect(slugify('hola - mundo')).toBe('hola-mundo');
        expect(slugify('a--b---c')).toBe('a-b-c');
    });

    it('quita guiones iniciales y finales', () => {
        expect(slugify('-hola-')).toBe('hola');
        expect(slugify('---test---')).toBe('test');
    });

    it('maneja casos edge sin romperse', () => {
        expect(slugify('')).toBe('');
        expect(slugify('   ')).toBe('');
        expect(slugify('!!!')).toBe('');
        expect(slugify('   hola   ')).toBe('hola');
    });

    it('trunca a 100 caracteres', () => {
        const long = 'a'.repeat(200);
        const result = slugify(long);
        expect(result.length).toBeLessThanOrEqual(100);
        expect(result).toBe('a'.repeat(100));
    });

    it('no deja guion final después de truncar', () => {
        // 99 chars + espacio + más texto: el truncado a 100 podría dejar el espacio convertido en guion final
        const input = 'a'.repeat(99) + ' palabra';
        const result = slugify(input);
        expect(result.endsWith('-')).toBe(false);
    });

    it('convierte mayúsculas a minúsculas', () => {
        expect(slugify('TÍTULO EN MAYÚSCULAS')).toBe('titulo-en-mayusculas');
        expect(slugify('MixedCase')).toBe('mixedcase');
    });

    it('preserva números', () => {
        expect(slugify('Año 2026')).toBe('ano-2026');
        expect(slugify('Top 5 protocolos')).toBe('top-5-protocolos');
    });
});
