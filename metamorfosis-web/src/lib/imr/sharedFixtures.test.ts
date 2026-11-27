/**
 * SPEC-306 (app) / SPEC-121 (sitio): el sitio y Elena prueban contra el mismo
 * archivo de casos. Si este test falla, la app y el sitio ya no calculan lo
 * mismo: corrige la fórmula en ambos repos o actualiza el archivo en los dos.
 */
import { describe, it, expect } from 'vitest';
import fixtures from './fixtures/metabolic_cases.json';
import { bodyFatNavy, metabolicAge, tmbMifflin, ENGINE_VERSION } from './engine';
import { fatCategory, whtrCategory } from '../calculators/bodyComposition';

describe('casos compartidos con Elena', () => {
    it('misma versión de motor', () => {
        expect(fixtures.engineVersion).toBe(ENGINE_VERSION);
    });
    for (const c of fixtures.cases) {
        it(c.name, () => {
            const i = c.input;
            const gender = i.gender as 'male' | 'female';
            expect(tmbMifflin({ weightKg: i.weightKg, heightCm: i.heightCm, age: i.age, gender })).toBeCloseTo(c.expected.bmrMifflin, 1);
            expect(whtrCategory(i.waistCm / i.heightCm)).toBe(c.expected.whtrCategory);
            const navy = () => bodyFatNavy({ heightCm: i.heightCm, waistCm: i.waistCm, neckCm: i.neckCm, hipCm: i.hipCm ?? undefined, gender });
            if (c.expected.bodyFatPct === null) {
                expect(navy).toThrow();
                return;
            }
            const bf = navy();
            expect(bf).toBeCloseTo(c.expected.bodyFatPct, 1);
            expect(metabolicAge({ age: i.age, weightKg: i.weightKg, heightCm: i.heightCm, bodyFatPct: bf, gender })).toBe(c.expected.metabolicAge);
            const cat = fatCategory(gender, bf);
            expect(cat === 'atleta' ? 'atletas' : cat).toBe(c.expected.fatCategory);
        });
    }
});
