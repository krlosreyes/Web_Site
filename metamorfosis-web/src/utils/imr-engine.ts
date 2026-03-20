/**
 * IMR ENGINE - Autoridad Técnica Metamorfosis Real
 * Implementación de lógica metabólica basada en ICA (WHtR) vs IMC.
 * Boris Style: Directo, técnico y basado en evidencia.
 */

export interface IMRInput {
    heightCm: number;
    currentWeightKg: number;
    waistCircumferenceCm: number;
    neckCircumferenceCm: number;
    pathologies: string[];
    age: number;
    gender: 'male' | 'female';
}

export interface IMRResult {
    imc: number;
    ica: number;
    tmb: number;
    imrScore: number;
    label: 'Eficiente' | 'Inflamado' | 'Riesgo';
    metabolicAge: number;
    recommendations: {
        science: string;
        advice: string;
    };
}

export function calculateIMR(data: IMRInput): IMRResult {
    const { heightCm, currentWeightKg, waistCircumferenceCm, pathologies, age, gender } = data;
    
    // Normalización de altura
    const heightM = heightCm / 100;

    // 1. IMC (Índice de Masa Corporal) - Referencial
    const imc = currentWeightKg / (heightM * heightM);

    // 2. ICA (Índice Cintura-Altura / WHtR) - El predictor REAL
    const ica = waistCircumferenceCm / heightCm;

    // 3. TMB (Tasa Metabólica Basal - Mifflin-St Jeor)
    let tmb = (10 * currentWeightKg) + (6.25 * heightCm) - (5 * age);
    tmb += (gender === 'male' ? 5 : -161);

    // 4. Algoritmo IMR Score (0-100)
    // Reglas: Prioridad ICA. Si ICA < 0.5, salud metabólica base es alta (80%).
    let score = ica < 0.5 ? 80 : 50;
    
    // Penalización por inflamación (ICA > 0.5)
    if (ica >= 0.5) {
        const excess = ica - 0.5;
        score -= (excess * 200); // Penalización agresiva por grasa visceral
    } else {
        const efficiency = 0.5 - ica;
        score += (efficiency * 100); // Bono por bajo riesgo visceral
    }

    // Penalización por patologías metabólicas (-10 pts cada una)
    score -= (pathologies.length * 10);
    
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    // 5. Etiquetado (Categorización Técnica)
    let label: 'Eficiente' | 'Inflamado' | 'Riesgo' = 'Eficiente';
    if (finalScore < 70) label = 'Inflamado';
    if (finalScore < 40 || ica > 0.55) label = 'Riesgo';

    // 6. Estimación Edad Metabólica
    // Calculada por desviación del ICA ideal (0.5)
    const ageCorrection = (ica - 0.5) * 40; 
    const metabolicAge = Math.round(age + (ageCorrection > 0 ? ageCorrection : ageCorrection / 2));

    return {
        imc: parseFloat(imc.toFixed(2)),
        ica: parseFloat(ica.toFixed(4)),
        tmb: Math.round(tmb),
        imrScore: finalScore,
        label,
        metabolicAge,
        recommendations: {
            science: "El ICA (Índice Cintura-Altura) es un predictor de salud 3 veces más potente que el IMC. Mientras el IMC no distingue entre músculo y grasa, el ICA mide directamente la expansión de la grasa visceral, el principal motor de la inflamación sistémica.",
            advice: (finalScore < 60 || pathologies.includes('insulin_resistance')) 
                ? "Protocolo sugerido: Implementar Ayuno intermitente 16:8. Esta ventana de alimentación reduce la secreción pulsátil de insulina y promueve la Autofagia, esencial para revertir la inflamación celular."
                : "Estado óptimo. Mantener flexibilidad metabólica alternando periodos de carga nutricional con micro-ayunos preventivos de 12-14 horas."
        }
    };
}
