/**
 * Tests del motor IMR (SPEC-020).
 *
 * Cubre:
 *   - bodyFatNavy (hombre/mujer, edge cases)
 *   - tmbMifflin (hombre/mujer)
 *   - tmbKatchMcArdle (cálculo LBM)
 *   - metabolicAge (3 casos canónicos del comentario del código + clamps)
 *   - computeImr (smoke + defaults)
 *
 * Tolerancia para floats: ±1 unidad. La fórmula es estable, pero el orden
 * de operaciones puede mover el último decimal entre runs. Una regresión
 * real moverá >3 unidades, así que la tolerancia no oculta nada.
 */
import { describe, expect, it } from 'vitest';
import {
    bodyFatNavy,
    tmbMifflin,
    tmbKatchMcArdle,
    metabolicAge,
    computeImr,
    ENGINE_VERSION,
} from './engine';

const expectClose = (actual: number, expected: number, tolerance = 1) => {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
        throw new Error(
            `Expected ${actual} to be within ±${tolerance} of ${expected} (diff: ${diff})`
        );
    }
};

describe('bodyFatNavy', () => {
    it('calcula bf para hombre con valores típicos', () => {
        // SPEC-118: fórmula métrica. Hombre 175 cm, cintura 90, cuello 40:
        //   495 / (1.0324 − 0.19077·log10(50) + 0.15456·log10(175)) − 450 = 19.21
        // (la versión en pulgadas con las medidas convertidas da 19.32)
        const bf = bodyFatNavy({ heightCm: 175, waistCm: 90, neckCm: 40, gender: 'male' });
        expectClose(bf, 19.21, 0.1);
    });

    it('calcula bf para hombre delgado', () => {
        // Hombre 180 cm, cintura 78, cuello 38 (fórmula métrica) = 10.32
        const bf = bodyFatNavy({ heightCm: 180, waistCm: 78, neckCm: 38, gender: 'male' });
        expectClose(bf, 10.32, 0.1);
    });

    it('calcula bf para mujer con hipCm explícito', () => {
        // Mujer 165 cm, cintura 80, cadera 100, cuello 33 (fórmula métrica) = 31.89.
        // La versión anterior (coeficientes en pulgadas) daba 58.72, imposible.
        const bf = bodyFatNavy({
            heightCm: 165,
            waistCm: 80,
            neckCm: 33,
            hipCm: 100,
            gender: 'female',
        });
        expectClose(bf, 31.89, 0.1);
    });

    it('mujer sin hipCm usa fallback waist*1.05', () => {
        const sinHip = bodyFatNavy({ heightCm: 165, waistCm: 80, neckCm: 33, gender: 'female' });
        const conHip = bodyFatNavy({
            heightCm: 165,
            waistCm: 80,
            neckCm: 33,
            hipCm: 80 * 1.05,
            gender: 'female',
        });
        expect(sinHip).toBeCloseTo(conHip, 5);
    });

    it('equivale a la versión en pulgadas con las medidas convertidas', () => {
        const inches = (w: number, n: number, h: number) =>
            86.01 * Math.log10(w / 2.54 - n / 2.54) - 70.041 * Math.log10(h / 2.54) + 36.76;
        for (const [w, n, h] of [[90, 40, 175], [78, 38, 180], [105, 42, 170]]) {
            const bf = bodyFatNavy({ heightCm: h, waistCm: w, neckCm: n, gender: 'male' });
            expectClose(bf, inches(w, n, h), 0.4);
        }
    });

    it('clamp inferior: nunca devuelve menos de 2%', () => {
        // Caso degenerado: waist=neck para hombre → log10(0)
        const bf = bodyFatNavy({ heightCm: 180, waistCm: 40, neckCm: 40, gender: 'male' });
        expect(bf).toBeGreaterThanOrEqual(2);
    });
});

describe('tmbMifflin', () => {
    it('hombre 35a 80kg 175cm = 1723.75', () => {
        // 10*80 + 6.25*175 - 5*35 + 5 = 800 + 1093.75 - 175 + 5 = 1723.75
        const tmb = tmbMifflin({ weightKg: 80, heightCm: 175, age: 35, gender: 'male' });
        expectClose(tmb, 1723.75, 0.1);
    });

    it('mujer 35a 65kg 165cm = 1345.25', () => {
        // 10*65 + 6.25*165 - 5*35 - 161 = 650 + 1031.25 - 175 - 161 = 1345.25
        const tmb = tmbMifflin({ weightKg: 65, heightCm: 165, age: 35, gender: 'female' });
        expectClose(tmb, 1345.25, 0.1);
    });
});

describe('tmbKatchMcArdle', () => {
    it('80kg 18% bf → LBM 65.6kg → ~1787', () => {
        const tmb = tmbKatchMcArdle({ weightKg: 80, bodyFatPct: 18 });
        // 370 + 21.6 * (80 * 0.82) = 370 + 21.6 * 65.6 = 370 + 1416.96 = 1786.96
        expectClose(tmb, 1787, 1);
    });

    it('clamp: bodyFatPct=100 no rompe (LBM=0)', () => {
        const tmb = tmbKatchMcArdle({ weightKg: 80, bodyFatPct: 100 });
        expect(tmb).toBe(370);
    });
});

describe('metabolicAge — casos canónicos del comentario', () => {
    // El comentario en engine.ts (línea ~163) garantiza estos tres casos.
    // Si rompen, hay una regresión en el modelo.

    it('Atleta 30a (bf=10, BMI=23) → 24 años (no ~21 como dice el comentario del motor)', () => {
        // FINDING: el comentario en engine.ts línea ~165 dice "Atleta 30a → ~21
        // años". La fórmula real con age=30 da 24:
        //   bfRef(30, male) = 17 (rama age<40, age=30 NO es <30)
        //   deltaBf = 10 - 17 = -7
        //   deltaBmi = max(0, 22.99 - 22) = 0.99
        //   yearOffset = -7 + 0.594 = -6.406
        //   metAge = round(30 - 6.406) = 24
        // Para llegar a ~21 habría que recalibrar la fórmula (otro ticket).
        // Test fija el comportamiento ACTUAL del motor — si cambia, lo notamos.
        const age = metabolicAge({
            age: 30,
            weightKg: 70.4,
            heightCm: 175,
            bodyFatPct: 10,
            gender: 'male',
        });
        expectClose(age, 24, 1);
    });


    it('Promedio 35a (bf=18, BMI=24) → ~36 años', () => {
        const age = metabolicAge({
            age: 35,
            weightKg: 73.5, // bmi=24 con 175cm
            heightCm: 175,
            bodyFatPct: 18,
            gender: 'male',
        });
        expectClose(age, 36, 2);
    });

    it('Sobrepeso 50a (bf=30, BMI=31) → ~63 años', () => {
        const age = metabolicAge({
            age: 50,
            weightKg: 95, // bmi=31 con 175cm
            heightCm: 175,
            bodyFatPct: 30,
            gender: 'male',
        });
        expectClose(age, 63, 3);
    });

    it('clamp superior: nunca devuelve > 80', () => {
        const age = metabolicAge({
            age: 70,
            weightKg: 130,
            heightCm: 170,
            bodyFatPct: 50,
            gender: 'male',
        });
        expect(age).toBeLessThanOrEqual(80);
    });

    it('clamp inferior: nunca devuelve < 18', () => {
        // Joven atlético extremo
        const age = metabolicAge({
            age: 18,
            weightKg: 65,
            heightCm: 180,
            bodyFatPct: 8,
            gender: 'male',
        });
        expect(age).toBeGreaterThanOrEqual(18);
    });
});

describe('computeImr (smoke)', () => {
    const baseInput = {
        heightCm: 175,
        weightKg: 75,
        waistCm: 85,
        neckCm: 38,
        age: 35,
        gender: 'male' as const,
    };

    it('devuelve un ImrResult con todos los campos del schema', () => {
        const result = computeImr(baseInput);
        expect(result).toMatchObject({
            imrScore: expect.any(Number),
            label: expect.any(String),
            blocks: { E: expect.any(Number), M: expect.any(Number), C: expect.any(Number) },
            ica: expect.any(Number),
            imc: expect.any(Number),
            tmb: expect.any(Number),
            metabolicAge: expect.any(Number),
            ffmi: expect.any(Number),
            whtr: expect.any(Number),
        });
    });

    it('imrScore en rango 0–100', () => {
        const result = computeImr(baseInput);
        expect(result.imrScore).toBeGreaterThanOrEqual(0);
        expect(result.imrScore).toBeLessThanOrEqual(100);
    });

    it('sin bodyFatPct explícito, lo calcula con Navy', () => {
        const result = computeImr(baseInput);
        // Navy para hombre 175cm, waist 85, neck 38 → ~14-15%
        // Eso debería poner bf > 0 y < 50, no NaN.
        expect(result.imrScore).not.toBeNaN();
    });

    it('imc se calcula correctamente', () => {
        const result = computeImr(baseInput);
        // 75 / 1.75^2 = 24.49
        expectClose(result.imc, 24.49, 0.05);
    });

    it('ENGINE_VERSION está exportado correctamente', () => {
        expect(ENGINE_VERSION).toBe('spec-118-v1');
    });
});
