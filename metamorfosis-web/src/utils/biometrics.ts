// === UTILS ===
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

// === CAPA B: CUERPO (Metrología Básica) - 40% del IMX ===
export const calculateWHtR = (waist: number, height: number): number => height <= 0 ? 0 : waist / height;
export const calculateWHR = (waist: number, hip: number): number => hip <= 0 ? 0 : waist / hip;
export const calculateNHR = (neck: number, height: number): number => height <= 0 ? 0 : neck / height;

// === MOTORES DE NORMALIZACIÓN IMX-V01 (Canonical Spec) ===

export interface IMXVariables {
    gender: 'male' | 'female';
    weight?: number; // optional — not used in score but stored for future clinical use
    waist: number;
    hip: number;
    height: number;
    neck: number;
    fastingHours: number; // 0-24
    energyScore: number;  // 0-10 (10 = excelente energía post-comida)
    nutritionScore: number; // 0-10 (10 = dieta perfecta, sin procesados)
    exerciseDays: number; // 0-7
    sleepHours: number;   // 0-24
    // Legacy aliases (kept for backward compatibility)
    ultraProcessedScore?: number; // deprecated — use nutritionScore
}

export const calculateIMX = (v: IMXVariables): number => {
    // === CAPA B (Cuerpo) — 40% ===
    const whtr = calculateWHtR(v.waist, v.height);
    const whr = calculateWHR(v.waist, v.hip);
    const nhr = calculateNHR(v.neck, v.height);

    // S1: Waist-to-Height Ratio  →  optimal WHtR < 0.4, risk > 0.6
    const s1 = clamp((0.6 - whtr) / 0.2, 0, 1);

    // S2: Waist-to-Hip Ratio  →  gender-adjusted thresholds
    const whrThreshold = v.gender === 'male' ? 0.95 : 0.90;
    const s2 = clamp((whrThreshold - whr) / 0.25, 0, 1);

    // S3: Neck-to-Height Ratio  →  proxy for upper body fat
    const s3 = clamp((0.26 - nhr) / 0.06, 0, 1);

    const capaB = (0.5 * s1) + (0.3 * s2) + (0.2 * s3);

    // === CAPA M (Metabolismo) — 30% ===
    // S4: Fasting hours — logistic normalization (16h IF = near optimal)
    const s4 = 1 / (1 + Math.exp(-(v.fastingHours - 14) / 2));

    // S5: Energy stability post-meal (0-10 scale, 10 = great)
    const s5 = clamp(v.energyScore / 10, 0, 1);

    const capaM = (0.6 * s4) + (0.4 * s5);

    // === CAPA H (Hábitos) — 30% ===
    // S6: Nutrition quality (10 = clean diet, 0 = ultra-processed heavy)
    // Support legacy 'ultraProcessedScore' (inverted) if 'nutritionScore' not provided
    let s6: number;
    if (v.nutritionScore !== undefined) {
        s6 = clamp(v.nutritionScore / 10, 0, 1);
    } else if (v.ultraProcessedScore !== undefined) {
        s6 = 1 - clamp(v.ultraProcessedScore / 10, 0, 1);
    } else {
        s6 = 0.5; // neutral default
    }

    // S7: Exercise days — clinical threshold is 5 days/week
    const s7 = clamp(v.exerciseDays / 5, 0, 1);

    // S8: Sleep hours — optimal 8h, baseline 5h, range 3h
    const s8 = clamp((v.sleepHours - 5) / 3, 0, 1);

    const capaH = (0.4 * s6) + (0.4 * s7) + (0.2 * s8);

    // === IMX FINAL (0-100) ===
    const imx = 100 * ((0.4 * capaB) + (0.3 * capaM) + (0.3 * capaH));
    return clamp(Math.round(imx), 0, 100);
};

// Export individual layer calculators for the admin analytics dashboard
export const calculateLayerB = (v: IMXVariables): number => {
    const s1 = clamp((0.6 - calculateWHtR(v.waist, v.height)) / 0.2, 0, 1);
    const whrThreshold = v.gender === 'male' ? 0.95 : 0.90;
    const s2 = clamp((whrThreshold - calculateWHR(v.waist, v.hip)) / 0.25, 0, 1);
    const s3 = clamp((0.26 - calculateNHR(v.neck, v.height)) / 0.06, 0, 1);
    return (0.5 * s1) + (0.3 * s2) + (0.2 * s3);
};

// Legacy stubs (deprecated — do not use in new code)
export const calculateBodyFat = (_gender: 'male' | 'female', _waist: number, _neck: number, _height: number, _hip: number): number => 0;
export const calculateFFMI = (_weight: number, _bodyFat: number, _height: number): number => 0;
