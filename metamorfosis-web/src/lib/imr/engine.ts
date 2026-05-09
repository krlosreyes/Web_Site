/**
 * Motor IMR canónico — wrapper sobre `calculateSPEC705` que normaliza inputs,
 * calcula Body Fat con Navy si no viene explícito, y agrega métricas derivadas
 * (IMC, TMB, ICA, edad metabólica) para producir un `ImrResult` completo.
 *
 * Esta es la fuente única de verdad del cálculo IMR de la web. Si en el futuro
 * decidimos que ElenaApp consuma este mismo motor (Cloud Function o package
 * compartido), se exporta desde acá.
 *
 * Ver specs/SPEC-004-calculate-imr-write.md
 */

import { calculateSPEC705, type SPEC705Input } from '../../utils/imr-engine';
import type { ImrResult, Gender } from '../types/user';

/**
 * Inputs aceptados por el motor. Los campos mínimos requeridos para un
 * cálculo válido son los biométricos (height, weight, waist, neck) + age + gender.
 * El resto tiene defaults razonables; web los ofrece como proxy auto-reportado
 * en el quiz inicial.
 */
export interface ComputeImrInput {
    /** Altura en cm */
    heightCm: number;
    /** Peso actual en kg */
    weightKg: number;
    /** Perímetro de cintura en cm */
    waistCm: number;
    /** Perímetro de cuello en cm (Body Fat Navy) */
    neckCm: number;
    /** Perímetro de cadera en cm. Requerido para Navy en mujeres. */
    hipCm?: number;
    /** Edad en años */
    age: number;
    gender: Gender;
    /** % de grasa corporal. Si no viene, se calcula con Navy. */
    bodyFatPct?: number;
    // Hábitos (opcionales, defaults neutros)
    fastingHours?: number;
    /** 19.5 = 19:30 */
    dinnerHour?: number;
    exerciseMinutes?: number;
    /** 0–1 */
    sleepQuality?: number;
    hydrationLitres?: number;
    /** Meta diaria de hidratación en litros, ej. 3 */
    hydrationGoal?: number;
    lastMealHour?: number;
}

/**
 * Body Fat por método Navy (Hodgdon-Beckett). Aproximación útil cuando no hay
 * bioimpedancia. Para mujeres requiere perímetro de cadera; si no viene, se
 * estima como 1.05 * cintura (aproximación conservadora).
 *
 * Referencias:
 *   - U.S. Navy circumference method, Hodgdon & Beckett (1984).
 */
export function bodyFatNavy(input: {
    heightCm: number;
    waistCm: number;
    neckCm: number;
    hipCm?: number;
    gender: Gender;
}): number {
    const { heightCm, waistCm, neckCm, hipCm, gender } = input;
    if (gender === 'male') {
        // Hombres: 86.010 * log10(waist - neck) - 70.041 * log10(height) + 36.76
        return Math.max(
            2,
            86.010 * Math.log10(Math.max(1, waistCm - neckCm)) -
                70.041 * Math.log10(heightCm) +
                36.76
        );
    }
    // Mujeres: 163.205 * log10(waist + hip - neck) - 97.684 * log10(height) - 78.387
    const hip = hipCm ?? waistCm * 1.05;
    return Math.max(
        2,
        163.205 * Math.log10(Math.max(1, waistCm + hip - neckCm)) -
            97.684 * Math.log10(heightCm) -
            78.387
    );
}

/**
 * Tasa metabólica basal — Mifflin-St Jeor (1990).
 * Usa peso total (no distingue masa magra). Adecuada para reportes generales
 * de TMB. Para edad metabólica preferimos Katch-McArdle (ver `tmbKatchMcArdle`)
 * porque corrige por composición corporal real.
 *
 * Ref: Mifflin MD, St Jeor ST, et al. Am J Clin Nutr 1990;51(2):241-7.
 */
export function tmbMifflin(input: {
    weightKg: number;
    heightCm: number;
    age: number;
    gender: Gender;
}): number {
    const { weightKg, heightCm, age, gender } = input;
    if (gender === 'male') {
        return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    }
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

/**
 * TMB Katch-McArdle: depende de masa libre de grasa (LBM), no del peso total.
 * Es la base correcta para edad metabólica porque dos personas con el mismo
 * peso pero distinta composición corporal van a tener TMBs muy distintas.
 *
 * Fórmula: BMR = 370 + 21.6 * LBM(kg)
 * Ref: Katch FI, McArdle WD. Nutrition, Weight Control, and Exercise (1983).
 */
export function tmbKatchMcArdle(input: {
    weightKg: number;
    bodyFatPct: number;
}): number {
    const { weightKg, bodyFatPct } = input;
    const lbm = weightKg * (1 - bodyFatPct / 100);
    return 370 + 21.6 * Math.max(0, lbm);
}

/**
 * Rango de % grasa "saludable / fitness" según ACSM (American College of
 * Sports Medicine), por edad y género. Usamos el centro del rango fitness
 * como referencia para calcular la composición "ideal" del user.
 *
 * Ref: ACSM's Guidelines for Exercise Testing and Prescription, 11ª ed.
 */
function referenceBodyFatPct(age: number, gender: Gender): number {
    if (gender === 'male') {
        if (age < 30) return 14;
        if (age < 40) return 17;
        if (age < 50) return 20;
        if (age < 60) return 22;
        return 24;
    }
    if (age < 30) return 22;
    if (age < 40) return 24;
    if (age < 50) return 27;
    if (age < 60) return 29;
    return 31;
}

/**
 * Edad metabólica — método empírico basado en composición corporal y BMI.
 *
 * Por qué este método (y no Katch-McArdle absoluto): la BMR via LBM crece
 * con el peso total. Una persona con sobrepeso (95 kg, 30 % bf) tiene LBM
 * absoluta mayor que la referencia "ideal" (~52 kg LBM) y termina pareciendo
 * "metabólicamente joven", lo cual es clínicamente engañoso (verificado en
 * SPEC-006: tests con sobrepeso 50a y atleta 35a daban ambos clamp 18). El
 * riesgo metabólico real correlaciona con (a) % grasa por encima del óptimo
 * y (b) sobrepeso (BMI > 22), no con masa magra absoluta.
 *
 * Fórmula:
 *   deltaBf  = bodyFat - referenceBfPct(age, gender)   // + es peor (más grasa)
 *   deltaBmi = max(0, bmi - 22)                          // solo penaliza sobrepeso
 *   offset   = deltaBf * 1.0 + deltaBmi * 0.6
 *   metAge   = clamp(18, age + offset, 80)
 *
 * Pesos calibrados para producir resultados coherentes:
 *   - Atleta 30a (bf=10, BMI=23) → ~21 años
 *   - Promedio 35a (bf=18, BMI=24) → ~36 años
 *   - Sobrepeso 50a (bf=30, BMI=31) → ~63 años
 *
 * Este es el contrato canónico que ElenaApp también respetará. Si se quiere
 * refinar (FFMI, VO2max, biomarcadores reales), modificar solo esta función.
 */
export function metabolicAge(input: {
    age: number;
    weightKg: number;
    heightCm: number;
    bodyFatPct: number;
    gender: Gender;
}): number {
    const { age, weightKg, heightCm, bodyFatPct, gender } = input;

    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    const bfRef = referenceBodyFatPct(age, gender);

    const deltaBf = bodyFatPct - bfRef;
    const deltaBmi = Math.max(0, bmi - 22);

    const yearOffset = deltaBf * 1.0 + deltaBmi * 0.6;

    return Math.max(18, Math.min(80, Math.round(age + yearOffset)));
}

/**
 * Cálculo principal: produce un `ImrResult` completo con todas las métricas
 * que la UI espera (imrScore, label, blocks E/M/C, ica, imc, tmb, ffmi, whtr,
 * metabolicAge).
 */
export function computeImr(input: ComputeImrInput): ImrResult {
    const {
        heightCm,
        weightKg,
        waistCm,
        neckCm,
        hipCm,
        age,
        gender,
    } = input;

    const heightM = heightCm / 100;

    // Body Fat: explícito o Navy
    const bodyFat = input.bodyFatPct ?? bodyFatNavy({ heightCm, waistCm, neckCm, hipCm, gender });

    // SPEC-70.5 motor base
    const specInput: SPEC705Input = {
        gender,
        age,
        weight: weightKg,
        height: heightCm,
        waist: waistCm,
        bodyFat,
        fastingHours: input.fastingHours ?? 12,
        dinnerHour: input.dinnerHour ?? 19,
        exerciseMinutes: input.exerciseMinutes ?? 30,
        sleepQuality: input.sleepQuality ?? 0.7,
        hydrationLitros: input.hydrationLitres ?? 2,
        hydrationGoal: input.hydrationGoal ?? 3,
        lastMealHour: input.lastMealHour ?? 19,
    };
    const spec = calculateSPEC705(specInput);

    // Métricas derivadas que el frontend usa
    const imc = weightKg / (heightM * heightM);
    const ica = waistCm / heightCm;
    const tmb = tmbMifflin({ weightKg, heightCm, age, gender });

    // Edad metabólica fundamentada en TMB (Katch-McArdle) vs referencia ACSM.
    // Ver `metabolicAge` arriba para la metodología completa.
    const metAge = metabolicAge({
        age,
        weightKg,
        heightCm,
        bodyFatPct: bodyFat,
        gender,
    });

    return {
        imrScore: spec.imr,
        label: spec.zona,
        blocks: {
            E: parseFloat(spec.blocks.E),
            M: parseFloat(spec.blocks.M),
            C: parseFloat(spec.blocks.C),
        },
        ica: parseFloat(ica.toFixed(3)),
        imc: parseFloat(imc.toFixed(2)),
        tmb: Math.round(tmb),
        metabolicAge: metAge,
        ffmi: parseFloat(spec.ffmi),
        whtr: parseFloat(spec.whtr),
    };
}

/** Versión del motor; etiqueta cada cálculo en `imr.history.engineVersion`. */
export const ENGINE_VERSION = 'spec-70.5-v1' as const;
