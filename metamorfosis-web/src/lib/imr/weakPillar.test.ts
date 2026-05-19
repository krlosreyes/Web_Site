/**
 * Tests del identificador de pilar débil (SPEC-099).
 *
 * Cubre:
 *   - Identificación correcta del pilar mínimo en los 3 casos canónicos
 *   - Regla de empate C > M > E (3 combinaciones de empate)
 *   - Detección de estado óptimo (todos ≥ 0.70)
 *   - Acción de mantenimiento cuando óptimo
 *   - Referencias presentes y no vacías para cada acción correctiva
 */
import { describe, expect, it } from 'vitest';
import { identifyWeakPillar, PILLAR_ACTIONS } from './weakPillar';

describe('identifyWeakPillar — caso canónico', () => {
    it('detecta E débil cuando E es el mínimo', () => {
        const result = identifyWeakPillar({ E: 0.30, M: 0.55, C: 0.60 });
        expect(result.key).toBe('E');
        expect(result.label).toBe('Estructura');
        expect(result.scorePct).toBe(30);
        expect(result.scoreRaw).toBeCloseTo(0.30, 5);
        expect(result.isOptimal).toBe(false);
        expect(result.weeklyAction.title).toContain('fuerza');
        expect(result.weeklyAction.references.length).toBeGreaterThan(0);
    });

    it('detecta M débil cuando M es el mínimo', () => {
        const result = identifyWeakPillar({ E: 0.55, M: 0.30, C: 0.60 });
        expect(result.key).toBe('M');
        expect(result.label).toBe('Metabolismo');
        expect(result.scorePct).toBe(30);
        expect(result.isOptimal).toBe(false);
        expect(result.weeklyAction.title.toLowerCase()).toContain('ayuno');
        expect(result.weeklyAction.references.length).toBeGreaterThan(0);
    });

    it('detecta C débil cuando C es el mínimo', () => {
        const result = identifyWeakPillar({ E: 0.55, M: 0.60, C: 0.30 });
        expect(result.key).toBe('C');
        expect(result.label).toBe('Conducta');
        expect(result.scorePct).toBe(30);
        expect(result.isOptimal).toBe(false);
        expect(result.weeklyAction.title.toLowerCase()).toContain('pantallas');
        expect(result.weeklyAction.references.length).toBeGreaterThan(0);
    });
});

describe('identifyWeakPillar — regla de empate C > M > E', () => {
    it('empate exacto entre C y M → gana C', () => {
        const result = identifyWeakPillar({ E: 0.60, M: 0.40, C: 0.40 });
        expect(result.key).toBe('C');
    });

    it('empate exacto entre C y E → gana C', () => {
        const result = identifyWeakPillar({ E: 0.40, M: 0.60, C: 0.40 });
        expect(result.key).toBe('C');
    });

    it('empate exacto entre M y E → gana M', () => {
        const result = identifyWeakPillar({ E: 0.40, M: 0.40, C: 0.60 });
        expect(result.key).toBe('M');
    });

    it('empate triple → gana C (primer elemento en orden de evaluación)', () => {
        const result = identifyWeakPillar({ E: 0.50, M: 0.50, C: 0.50 });
        expect(result.key).toBe('C');
    });
});

describe('identifyWeakPillar — zona óptima', () => {
    it('todos ≥ 0.70 → isOptimal true + acción de mantenimiento', () => {
        const result = identifyWeakPillar({ E: 0.80, M: 0.75, C: 0.85 });
        expect(result.isOptimal).toBe(true);
        expect(result.weeklyAction.title.toLowerCase()).toContain('mantén');
        // El key retornado sigue siendo el mínimo (para coherencia con
        // la UI que muestra "qué pilar es el más bajo"), pero la acción
        // es de mantenimiento.
        expect(result.key).toBe('M');
    });

    it('umbral exacto 0.70 cuenta como óptimo', () => {
        const result = identifyWeakPillar({ E: 0.70, M: 0.70, C: 0.70 });
        expect(result.isOptimal).toBe(true);
    });

    it('uno apenas debajo (0.69) → NO óptimo, acción correctiva', () => {
        const result = identifyWeakPillar({ E: 0.69, M: 0.80, C: 0.85 });
        expect(result.isOptimal).toBe(false);
        expect(result.key).toBe('E');
        expect(result.weeklyAction.title).toContain('fuerza');
    });
});

describe('PILLAR_ACTIONS export', () => {
    it('las 3 acciones tienen al menos 1 referencia citada', () => {
        expect(PILLAR_ACTIONS.E.references.length).toBeGreaterThanOrEqual(1);
        expect(PILLAR_ACTIONS.M.references.length).toBeGreaterThanOrEqual(1);
        expect(PILLAR_ACTIONS.C.references.length).toBeGreaterThanOrEqual(1);
    });

    it('todos los títulos están en tuteo neutro (no voseo)', () => {
        const titles = [
            PILLAR_ACTIONS.E.title,
            PILLAR_ACTIONS.M.title,
            PILLAR_ACTIONS.C.title,
        ];
        const voseoPatterns = [
            /\bsos\b/i, /\btenés\b/i, /\bpodés\b/i, /\bquerés\b/i,
            /\bsabés\b/i, /\bnecesitás\b/i, /\bmirá\b/i, /\bhacé\b/i,
            /\bdecí\b/i, /\breservá\b/i, /\biniciá\b/i, /\bprobá\b/i,
        ];
        titles.forEach((title) => {
            voseoPatterns.forEach((pattern) => {
                expect(title).not.toMatch(pattern);
            });
        });
    });
});
