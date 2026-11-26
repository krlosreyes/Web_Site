import { describe, it, expect } from 'vitest';
import {
    computeBodyComposition,
    fatCategory,
    whtrCategory,
    validate,
} from './bodyComposition';

describe('computeBodyComposition', () => {
    it('hombre 175 cm, cintura 90, cuello 40 → 19,2 % (promedio) e ICE 0,51 (aumentado)', () => {
        const r = computeBodyComposition({ sex: 'male', heightCm: 175, waistCm: 90, neckCm: 40 });
        expect(r.bodyFatPct).toBe(19.2);
        expect(r.fatCategory).toBe('promedio');
        expect(r.whtr).toBe(0.51);
        expect(r.whtrCategory).toBe('aumentado');
    });

    it('mujer 165 cm, cintura 80, cadera 100, cuello 33 → 31,9 % (promedio) e ICE 0,48', () => {
        const r = computeBodyComposition({ sex: 'female', heightCm: 165, waistCm: 80, neckCm: 33, hipCm: 100 });
        expect(r.bodyFatPct).toBe(31.9);
        expect(r.fatCategory).toBe('promedio');
        expect(r.whtr).toBe(0.48);
        expect(r.whtrCategory).toBe('saludable');
    });

    it('la categoría del ICE usa el valor exacto, no el redondeado', () => {
        // 84,9 / 170 = 0,4994 → se muestra 0,5 pero sigue siendo saludable
        const r = computeBodyComposition({ sex: 'male', heightCm: 170, waistCm: 84.9, neckCm: 38 });
        expect(r.whtr).toBe(0.5);
        expect(r.whtrCategory).toBe('saludable');
    });
});

describe('rangos ACE', () => {
    it('hombres: límites 6 / 14 / 18 / 25', () => {
        expect(fatCategory('male', 5.9)).toBe('esencial');
        expect(fatCategory('male', 6)).toBe('atleta');
        expect(fatCategory('male', 14)).toBe('fitness');
        expect(fatCategory('male', 18)).toBe('promedio');
        expect(fatCategory('male', 25)).toBe('obesidad');
    });
    it('mujeres: límites 14 / 21 / 25 / 32', () => {
        expect(fatCategory('female', 13.9)).toBe('esencial');
        expect(fatCategory('female', 14)).toBe('atleta');
        expect(fatCategory('female', 21)).toBe('fitness');
        expect(fatCategory('female', 25)).toBe('promedio');
        expect(fatCategory('female', 32)).toBe('obesidad');
    });
});

describe('ICE (NICE NG246)', () => {
    it('0,40–0,49 saludable · 0,50–0,59 aumentado · ≥0,60 alto', () => {
        expect(whtrCategory(0.39)).toBe('bajo');
        expect(whtrCategory(0.4)).toBe('saludable');
        expect(whtrCategory(0.499)).toBe('saludable');
        expect(whtrCategory(0.5)).toBe('aumentado');
        expect(whtrCategory(0.6)).toBe('alto');
    });
});

describe('validate', () => {
    it('exige cadera en mujeres', () => {
        expect(validate({ sex: 'female', heightCm: 165, waistCm: 80, neckCm: 33 })).toBe('cadera');
    });
    it('rechaza cintura menor o igual que el cuello', () => {
        expect(validate({ sex: 'male', heightCm: 175, waistCm: 50, neckCm: 55 })).toBe('cintura_menor_que_cuello');
    });
    it('rechaza medidas fuera de rango', () => {
        expect(validate({ sex: 'male', heightCm: 17.5, waistCm: 90, neckCm: 40 })).toBe('estatura');
    });
    it('acepta medidas válidas', () => {
        expect(validate({ sex: 'male', heightCm: 175, waistCm: 90, neckCm: 40 })).toBeNull();
    });
});
