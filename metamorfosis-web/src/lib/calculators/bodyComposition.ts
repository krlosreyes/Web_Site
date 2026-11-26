/**
 * SPEC-118: lógica de la calculadora pública /calculadora-grasa-corporal.
 * Funciones puras (sin DOM) para poder probarlas.
 *
 * - % de grasa: fórmula US Navy métrica (bodyFatNavy del motor IMR).
 * - Categoría de grasa: rangos del American Council on Exercise (ACE).
 * - Índice cintura-estatura (ICE): cortes de NICE NG246 (2022):
 *   0,40–0,49 saludable · 0,50–0,59 aumentado · ≥ 0,60 alto.
 */
import { bodyFatNavy } from '../imr/engine';

export type Sex = 'male' | 'female';

export interface BodyCompositionInput {
    sex: Sex;
    heightCm: number;
    waistCm: number;
    neckCm: number;
    /** Obligatoria para mujeres (la fórmula la necesita). */
    hipCm?: number;
}

export type FatCategory = 'esencial' | 'atleta' | 'fitness' | 'promedio' | 'obesidad';
export type WhtrCategory = 'bajo' | 'saludable' | 'aumentado' | 'alto';

export interface BodyCompositionResult {
    bodyFatPct: number;
    fatCategory: FatCategory;
    whtr: number;
    whtrCategory: WhtrCategory;
}

/** Límites inferiores (%) de cada categoría ACE, por sexo. */
export const ACE_RANGES: Record<Sex, { atleta: number; fitness: number; promedio: number; obesidad: number }> = {
    male: { atleta: 6, fitness: 14, promedio: 18, obesidad: 25 },
    female: { atleta: 14, fitness: 21, promedio: 25, obesidad: 32 },
};

export function fatCategory(sex: Sex, pct: number): FatCategory {
    const r = ACE_RANGES[sex];
    if (pct >= r.obesidad) return 'obesidad';
    if (pct >= r.promedio) return 'promedio';
    if (pct >= r.fitness) return 'fitness';
    if (pct >= r.atleta) return 'atleta';
    return 'esencial';
}

export function whtrCategory(whtr: number): WhtrCategory {
    if (whtr >= 0.6) return 'alto';
    if (whtr >= 0.5) return 'aumentado';
    if (whtr >= 0.4) return 'saludable';
    return 'bajo';
}

/** Rangos plausibles de medidas en adultos (cm). Fuera de ellos no se calcula. */
export const LIMITS = {
    heightCm: [120, 230],
    waistCm: [45, 200],
    neckCm: [20, 70],
    hipCm: [50, 200],
} as const;

export type ValidationError =
    | 'estatura'
    | 'cintura'
    | 'cuello'
    | 'cadera'
    | 'cintura_menor_que_cuello';

const inRange = (v: number | undefined, [lo, hi]: readonly [number, number]) =>
    typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

export function validate(input: BodyCompositionInput): ValidationError | null {
    if (!inRange(input.heightCm, LIMITS.heightCm)) return 'estatura';
    if (!inRange(input.waistCm, LIMITS.waistCm)) return 'cintura';
    if (!inRange(input.neckCm, LIMITS.neckCm)) return 'cuello';
    if (input.sex === 'female' && !inRange(input.hipCm, LIMITS.hipCm)) return 'cadera';
    if (input.waistCm <= input.neckCm) return 'cintura_menor_que_cuello';
    return null;
}

export function computeBodyComposition(input: BodyCompositionInput): BodyCompositionResult {
    const bodyFatPct =
        Math.round(
            bodyFatNavy({
                heightCm: input.heightCm,
                waistCm: input.waistCm,
                neckCm: input.neckCm,
                hipCm: input.sex === 'female' ? input.hipCm : undefined,
                gender: input.sex,
            }) * 10,
        ) / 10;
    const rawWhtr = input.waistCm / input.heightCm;
    return {
        bodyFatPct,
        fatCategory: fatCategory(input.sex, bodyFatPct),
        // Se muestra con 2 decimales; la categoría usa el valor exacto.
        whtr: Math.round(rawWhtr * 100) / 100,
        whtrCategory: whtrCategory(rawWhtr),
    };
}
