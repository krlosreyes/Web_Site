/**
 * IMR ENGINE - SPEC-70.5 (ALTA AUTORIDAD)
 * Implementación de la fórmula maestra de Metamorfosis Real.
 */

export interface SPEC705Input {
    gender: 'male' | 'female';
    age: number;
    weight: number;
    height: number; // en cm
    waist: number;  // en cm
    bodyFat: number; // en %
    fastingHours: number;
    dinnerHour: number; // 19.5 para 19:30
    exerciseMinutes: number;
    sleepQuality: number; // 0-1
    hydrationLitros: number;
    hydrationGoal: number;
    lastMealHour: number; // para Circadiano
}

export function calculateSPEC705(input: SPEC705Input) {
    const { 
        gender, age, weight, height, waist, bodyFat, 
        fastingHours, dinnerHour, exerciseMinutes, 
        sleepQuality, hydrationLitros, hydrationGoal, lastMealHour 
    } = input;

    const heightM = height / 100;

    // --- BLOQUE E: ESTRUCTURA (50%) ---
    // s1: WHtR (Cintura/Estatura)
    const whtr = waist / height;
    const s1 = Math.max(0, Math.min(1, (0.60 - whtr) / 0.15));

    // s2: FFMI (Masa Magra)
    const ffmi = (weight * (1 - bodyFat / 100)) / (heightM * heightM);
    
    // Bases FFMI por edad/género
    let baseFFMI = 17.0;
    if (gender === 'male') {
        if (age < 50) baseFFMI = 17.0;
        else if (age < 60) baseFFMI = 16.5;
        else if (age < 70) baseFFMI = 16.0;
        else baseFFMI = 15.5;
    } else {
        if (age < 50) baseFFMI = 14.5;
        else if (age < 60) baseFFMI = 14.0;
        else if (age < 70) baseFFMI = 13.5;
        else baseFFMI = 13.0;
    }
    const range = gender === 'male' ? 6.0 : 5.0;
    const s2 = Math.max(0, Math.min(1, (ffmi - baseFFMI) / range));

    const E = 0.65 * s1 + 0.35 * s2;

    // --- BLOQUE M: METABOLISMO (25%) ---
    // s4: Sigmoid Ayuno (centro 14h, ancho 1.5)
    const s4 = 1 / (1 + Math.exp(-(fastingHours - 14) / 1.5));
    
    // eTRF: Bonus Cena Temprana (centro 17h, max +15%)
    const etrf = 1.0 + 0.15 * (1 - (1 / (1 + Math.exp(-(dinnerHour - 17) / 1.0))));
    
    // Asumiendo QS_w (Quality Score) como una mezcla de nutrición y consistencia (default 0.7 para diagnostic)
    const qsw = 0.7; 
    const M = (0.70 * s4 + 0.30 * qsw) * etrf;

    // --- BLOQUE C: CONDUCTA (25%) ---
    // Circadiano (38%): penaliza si cena >= 21:30 (1290 min / 60 = 21.5h)
    const circ = lastMealHour >= 21.5 ? 0.5 : 1.0;
    const sue = Math.min(1.0, sleepQuality); // Ya viene normalizado
    const ej = Math.min(1.2, exerciseMinutes / 60);
    const nut = 0.8; // Constante para diagnóstico inicial
    const hid = Math.min(1.0, hydrationLitros / hydrationGoal);

    const C = 0.38 * circ + 0.20 * sue + 0.20 * ej + 0.12 * nut + 0.10 * hid;

    // --- IMR FINAL ---
    const imrRaw = (0.50 * E + 0.25 * M + 0.25 * C) * 100;
    const imr = Math.round(Math.max(0, Math.min(100, imrRaw)));

    let zona = 'DETERIORADO';
    if (imr >= 90) zona = 'OPTIMIZADO';
    else if (imr >= 75) zona = 'EFICIENTE';
    else if (imr >= 60) zona = 'FUNCIONAL';
    else if (imr >= 40) zona = 'INESTABLE';

    return {
        imr,
        zona,
        blocks: { E: E.toFixed(2), M: M.toFixed(2), C: C.toFixed(2) },
        ffmi: ffmi.toFixed(2),
        whtr: whtr.toFixed(3)
    };
}
