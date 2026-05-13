/**
 * Tests de calculateAge y maxBirthDateFor18Plus (SPEC-089).
 *
 * Ejecutar con `npm test`.
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { calculateAge, maxBirthDateFor18Plus } from './age';

/**
 * Helper para construir un birthDate relativo a hoy.
 *
 * `yearsAgo(30)` retorna 'YYYY-MM-DD' de hace exactamente 30 años,
 * mismo día y mes que hoy. Como ya cumplió años hoy, `calculateAge`
 * debe retornar 30.
 */
function yearsAgo(years: number, offsetDays = 0): string {
    const now = new Date();
    const target = new Date(
        now.getFullYear() - years,
        now.getMonth(),
        now.getDate() + offsetDays,
    );
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

describe('calculateAge', () => {
    test('cumpleaños HOY: retorna edad exacta', () => {
        // Nació hace 35 años el mismo día/mes que hoy.
        expect(calculateAge(yearsAgo(35))).toBe(35);
    });

    test('cumpleaños AYER: retorna edad ya cumplida', () => {
        // Nació hace 35 años + 1 día (o sea cumplió ayer).
        expect(calculateAge(yearsAgo(35, -1))).toBe(35);
    });

    test('cumpleaños MAÑANA: retorna edad - 1 (aún no cumplió)', () => {
        // Nació hace 35 años pero el cumpleaños es mañana.
        expect(calculateAge(yearsAgo(35, 1))).toBe(34);
    });

    test('fecha futura retorna 0', () => {
        const now = new Date();
        const future = new Date(now.getFullYear() + 5, 0, 1);
        const y = future.getFullYear();
        const m = String(future.getMonth() + 1).padStart(2, '0');
        const d = String(future.getDate()).padStart(2, '0');
        expect(calculateAge(`${y}-${m}-${d}`)).toBe(0);
    });

    test('null o undefined retorna 0', () => {
        expect(calculateAge(null)).toBe(0);
        expect(calculateAge(undefined)).toBe(0);
    });

    test('string vacío retorna 0', () => {
        expect(calculateAge('')).toBe(0);
    });

    test('formato inválido retorna 0', () => {
        expect(calculateAge('1985')).toBe(0);
        expect(calculateAge('15-03-1985')).toBe(0);
        expect(calculateAge('not a date')).toBe(0);
    });

    test('mes/día fuera de rango retorna 0', () => {
        expect(calculateAge('1985-13-01')).toBe(0);
        expect(calculateAge('1985-00-15')).toBe(0);
        expect(calculateAge('1985-03-32')).toBe(0);
        expect(calculateAge('1985-03-00')).toBe(0);
    });

    test('clamp inferior: edad negativa → 0', () => {
        // Caso patológico: año actual + 1 (fecha en el futuro)
        const future = new Date().getFullYear() + 1;
        expect(calculateAge(`${future}-01-01`)).toBe(0);
    });

    test('clamp superior: > 150 → 150', () => {
        // Año muy lejano en el pasado.
        expect(calculateAge('1800-01-01')).toBe(150);
    });

    test('edad típica adulto: cuadra con el cálculo manual', () => {
        // Caso reproducible: alguien nacido el 1ro de enero de 2000.
        // Hoy = 2026-05-13 → tiene 26 años (ya cumplió en enero).
        // Nota: este test depende de la fecha actual, así que usamos
        // vi.useFakeTimers para fijarla.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-13T12:00:00Z'));
        expect(calculateAge('2000-01-01')).toBe(26);
        expect(calculateAge('2000-06-01')).toBe(25); // no cumple hasta junio
        expect(calculateAge('2000-05-13')).toBe(26); // cumple HOY
        expect(calculateAge('2000-05-14')).toBe(25); // cumple mañana
        vi.useRealTimers();
    });
});

describe('maxBirthDateFor18Plus', () => {
    test('retorna fecha de hace exactamente 18 años', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-13T12:00:00Z'));
        expect(maxBirthDateFor18Plus()).toBe('2008-05-13');
        vi.useRealTimers();
    });

    test('el resultado da edad exacta 18 al pasarlo a calculateAge', () => {
        // Usar el max como birthDate debe dar edad 18 hoy.
        const max = maxBirthDateFor18Plus();
        expect(calculateAge(max)).toBe(18);
    });

    test('un día después del max ya da 17 (no se puede registrar)', () => {
        const max = maxBirthDateFor18Plus();
        const parts = max.split('-').map((p) => parseInt(p, 10));
        const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        expect(calculateAge(`${y}-${m}-${day}`)).toBe(17);
    });
});
