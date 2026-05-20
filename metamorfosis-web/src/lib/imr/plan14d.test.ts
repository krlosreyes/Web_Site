/**
 * Tests del Plan IMR 14 días (SPEC-100).
 *
 * Cubre:
 *   - Estructura: exactamente 14 días, todas las claves presentes
 *   - Balance: cada pilar (E/M/C) tiene 14 acciones únicas
 *   - getPlanForPillar correcto para los 3 pilares + caso óptimo
 *   - Rotación en caso óptimo es E→M→C
 *   - Día 14 incluye CTA explícito a ElenaApp/Cohorte
 *   - Tuteo neutro (sin voseo) en todo el contenido editorial
 */
import { describe, expect, it } from 'vitest';
import { PLAN_14_DAYS } from '../../data/plan14d';
import {
    getPlanForPillar,
    pillarLabel,
    PLAN_TOTAL_DAYS,
} from './plan14d';

describe('PLAN_14_DAYS — estructura', () => {
    it('contiene exactamente 14 días', () => {
        expect(PLAN_14_DAYS).toHaveLength(14);
        expect(PLAN_TOTAL_DAYS).toBe(14);
    });

    it('los días están numerados de 1 a 14 sin gaps', () => {
        const dayNumbers = PLAN_14_DAYS.map((d) => d.day).sort((a, b) => a - b);
        expect(dayNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    });

    it('cada día tiene fase Reset (1-7) o Consolidación (8-14)', () => {
        PLAN_14_DAYS.forEach((d) => {
            if (d.day <= 7) {
                expect(d.phase).toBe('Reset');
            } else {
                expect(d.phase).toBe('Consolidación');
            }
        });
    });

    it('cada día tiene título, descripción, y acciones E/M/C', () => {
        PLAN_14_DAYS.forEach((d) => {
            expect(d.title).toBeTruthy();
            expect(d.title.length).toBeGreaterThan(5);
            expect(d.description).toBeTruthy();
            expect(d.description.length).toBeGreaterThan(20);
            expect(d.actions.E.title).toBeTruthy();
            expect(d.actions.M.title).toBeTruthy();
            expect(d.actions.C.title).toBeTruthy();
        });
    });
});

describe('getPlanForPillar — pilar correctivo', () => {
    it('pillar="E" retorna 14 días con acción de Estructura', () => {
        const plan = getPlanForPillar('E');
        expect(plan).toHaveLength(14);
        plan.forEach((d, idx) => {
            expect(d.sourcePillar).toBe('E');
            expect(d.action).toEqual(PLAN_14_DAYS[idx].actions.E);
        });
    });

    it('pillar="M" retorna 14 días con acción de Metabolismo', () => {
        const plan = getPlanForPillar('M');
        plan.forEach((d, idx) => {
            expect(d.sourcePillar).toBe('M');
            expect(d.action).toEqual(PLAN_14_DAYS[idx].actions.M);
        });
    });

    it('pillar="C" retorna 14 días con acción de Conducta', () => {
        const plan = getPlanForPillar('C');
        plan.forEach((d, idx) => {
            expect(d.sourcePillar).toBe('C');
            expect(d.action).toEqual(PLAN_14_DAYS[idx].actions.C);
        });
    });
});

describe('getPlanForPillar — modo óptimo (rotación E→M→C)', () => {
    it('pillar=null retorna 14 días con rotación E→M→C', () => {
        const plan = getPlanForPillar(null);
        const expectedRotation: ('E' | 'M' | 'C')[] = [
            'E', 'M', 'C', 'E', 'M', 'C', 'E',
            'M', 'C', 'E', 'M', 'C', 'E', 'M',
        ];
        plan.forEach((d, idx) => {
            expect(d.sourcePillar).toBe(expectedRotation[idx]);
        });
    });

    it('día 1 en modo óptimo usa pilar E', () => {
        const plan = getPlanForPillar(null);
        expect(plan[0].sourcePillar).toBe('E');
        expect(plan[0].action).toEqual(PLAN_14_DAYS[0].actions.E);
    });
});

describe('día 14 — cierre y CTA a ElenaApp', () => {
    const day14 = PLAN_14_DAYS[13];

    it('día 14 es de fase Consolidación', () => {
        expect(day14.phase).toBe('Consolidación');
    });

    it('al menos una de las 3 acciones del día 14 menciona ElenaApp', () => {
        const actionsText = (
            day14.actions.E.title + ' ' + (day14.actions.E.detail ?? '') + ' ' +
            day14.actions.M.title + ' ' + (day14.actions.M.detail ?? '') + ' ' +
            day14.actions.C.title + ' ' + (day14.actions.C.detail ?? '')
        ).toLowerCase();
        expect(actionsText).toContain('elenaapp');
    });

    it('al menos una acción del día 14 invita a re-medir el IMR', () => {
        const actionsText = (
            day14.actions.E.title + ' ' + (day14.actions.E.detail ?? '') + ' ' +
            day14.actions.M.title + ' ' + (day14.actions.M.detail ?? '') + ' ' +
            day14.actions.C.title + ' ' + (day14.actions.C.detail ?? '')
        ).toLowerCase();
        expect(actionsText).toMatch(/re-?(medir|mide|mide)|quiz|imr/);
    });
});

describe('pillarLabel', () => {
    it('mapea pilares a labels humanos', () => {
        expect(pillarLabel('E')).toBe('Estructura');
        expect(pillarLabel('M')).toBe('Metabolismo');
        expect(pillarLabel('C')).toBe('Conducta');
        expect(pillarLabel(null)).toBe('Plan de exploración');
    });
});

describe('tuteo neutro — sin voseo en todo el plan', () => {
    /**
     * Patterns que detectan voseo o imperativos rioplatenses.
     * Si alguno aparece, hay que reescribir (regla SPEC-054).
     */
    const voseoPatterns = [
        /\bsos\b/i,
        /\btenés\b/i,
        /\bpodés\b/i,
        /\bquerés\b/i,
        /\bsabés\b/i,
        /\bnecesitás\b/i,
        /\bacabás\b/i,
        /\bcreés\b/i,
        // Imperativos tildados rioplatenses
        /\bmirá\b/i,
        /\bhacé\b/i,
        /\bdecí\b/i,
        /\breservá\b/i,
        /\biniciá\b/i,
        /\bprobá\b/i,
        /\bdescubrí\b/i,
        /\brecibí\b/i,
        /\bobtené\b/i,
        /\bregistrate\b/i,
    ];

    it('títulos y descripciones comunes están en tuteo neutro', () => {
        PLAN_14_DAYS.forEach((d) => {
            const text = `${d.title} ${d.description}`;
            voseoPatterns.forEach((pattern) => {
                expect(text).not.toMatch(pattern);
            });
        });
    });

    it('acciones E/M/C están en tuteo neutro', () => {
        PLAN_14_DAYS.forEach((d) => {
            (['E', 'M', 'C'] as const).forEach((key) => {
                const action = d.actions[key];
                const text = `${action.title} ${action.detail ?? ''}`;
                voseoPatterns.forEach((pattern) => {
                    expect(text).not.toMatch(pattern);
                });
            });
        });
    });
});
