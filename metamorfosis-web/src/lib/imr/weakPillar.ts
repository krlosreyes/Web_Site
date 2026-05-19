/**
 * Identificación del pilar débil + acción semanal sustentada (SPEC-099).
 *
 * El motor IMR (engine.ts) retorna `blocks { E, M, C }` en rango 0-1 con
 * pesos finales E=50%, M=25%, C=25% (ver utils/imr-engine.ts línea 79).
 *
 * Esta función toma esos blocks y devuelve el pilar con menor score
 * + una acción semanal concreta basada en evidencia (no prescripción
 * médica). La acción se diseña con dos criterios:
 *
 *   1. **Dosis mínima efectiva** — el usuario puede ejecutarla en
 *      su próxima semana sin requerir equipo, dieta especial ni
 *      compromiso impráctico.
 *   2. **Sustento publicado** — cada acción tiene 1-3 referencias
 *      revisadas por pares que la respaldan. Las refs viven en
 *      este archivo para auditoría; el frontend opcionalmente
 *      las muestra en un disclosure.
 *
 * Regla de empate (decisión Carlos 2026-05-19): si dos pilares
 * empatan en el mínimo, gana el orden `C > M > E`. Racional: la
 * Conducta es habilitadora de los otros dos (sin sueño no hay
 * fuerza efectiva; sin hidratación no hay ayuno cómodo). En la
 * práctica empates exactos son raros porque los blocks son floats.
 */

export type PillarKey = 'E' | 'M' | 'C';

export interface WeeklyAction {
    /** Título corto (5-12 palabras) que actúa como prescripción accionable. */
    title: string;
    /** 1-3 oraciones que explican el porqué y aterrizan la ejecución. */
    detail: string;
    /** Referencias revisadas por pares. Auditables. */
    references: string[];
}

export interface WeakPillarResult {
    key: PillarKey;
    /** Nombre humano del pilar. */
    label: 'Estructura' | 'Metabolismo' | 'Conducta';
    /** Score del pilar en 0-100 (redondeado para display). */
    scorePct: number;
    /** Score raw 0-1 (útil para tracking o cálculos extra). */
    scoreRaw: number;
    weeklyAction: WeeklyAction;
    /**
     * Si los 3 pilares están en zona óptima (todos ≥ 0.70 raw / 70%),
     * `isOptimal` es true y `weeklyAction` muestra copy de mantenimiento
     * en vez de corrección. Esto evita "regañar" a un usuario que ya
     * está bien.
     */
    isOptimal: boolean;
}

/**
 * Umbral por encima del cual el pilar se considera "en zona óptima".
 * Coincide con el corte que el motor usa para zona FUNCIONAL (60+) /
 * EFICIENTE (75+). Usamos 0.70 como punto medio razonable para "ya
 * cumple sin esfuerzo extra".
 */
const OPTIMAL_THRESHOLD = 0.70;

const ACTIONS: Record<PillarKey, WeeklyAction> = {
    /**
     * Pilar E (Estructura) — composición corporal, FFMI, BMI, ICA.
     * Dosis mínima de fuerza con sustento:
     *
     *   - Schoenfeld BJ, Ogborn D, Krieger JW. (2017). "Dose-response
     *     relationship between weekly resistance training volume and
     *     increases in muscle mass: A systematic review and
     *     meta-analysis." J Sports Sci 35(11):1073-1082.
     *     → 2 sesiones/sem ya producen mejoras significativas; el
     *     beneficio escala hasta ~10 sets/grupo muscular/sem.
     *
     *   - Garber CE et al. (2011). "American College of Sports Medicine
     *     position stand. Quantity and quality of exercise for
     *     developing and maintaining cardiorespiratory, musculoskeletal,
     *     and neuromotor fitness in apparently healthy adults." Med Sci
     *     Sports Exerc 43(7):1334-1359.
     *     → Recomendación ACSM: ≥2 días/sem de fuerza, todos los
     *     grupos musculares mayores.
     */
    E: {
        title: 'Suma 2 sesiones de fuerza de 20 minutos esta semana',
        detail:
            'La masa magra es el motor de tu metabolismo basal. Con dos sesiones cortas de pesos o calistenia (sentadillas, flexiones, dominadas) cubres el mínimo efectivo demostrado en meta-análisis de entrenamiento de fuerza.',
        references: [
            'Schoenfeld et al. (2017). J Sports Sci 35(11):1073-1082.',
            'Garber et al. ACSM Position Stand (2011). Med Sci Sports Exerc 43(7):1334-1359.',
        ],
    },

    /**
     * Pilar M (Metabolismo) — eTRF (early Time-Restricted Feeding),
     * sensibilidad insulínica, marcadores lipídicos.
     *
     *   - Sutton EF et al. (2018). "Early Time-Restricted Feeding
     *     Improves Insulin Sensitivity, Blood Pressure, and Oxidative
     *     Stress Even without Weight Loss in Men with Prediabetes."
     *     Cell Metab 27(6):1212-1221.
     *     → TRF temprano (ventana de 6h, cena ~15h) mejora insulina
     *     incluso sin perder peso. El componente clave es "cena
     *     temprana", no solo "ayuno largo".
     *
     *   - Wilkinson MJ et al. (2020). "Ten-Hour Time-Restricted Eating
     *     Reduces Weight, Blood Pressure, and Atherogenic Lipids in
     *     Patients with Metabolic Syndrome." Cell Metab 31(1):92-104.
     *     → Ventana de 10h (ayuno 14h) reduce peso, PA y perfil
     *     aterogénico en pacientes con síndrome metabólico.
     *
     *   - Jakubowicz D et al. (2013). "High caloric intake at breakfast
     *     vs. dinner differentially influences weight loss of overweight
     *     and obese women." Obesity 21(12):2504-2512.
     *     → Comida más temprana = mejor respuesta metabólica que
     *     comida tardía, a misma cantidad calórica.
     */
    M: {
        title: 'Extiende tu ayuno a 14 horas cerrando la cena a las 8 pm',
        detail:
            'El intervalo nocturno sin comida baja insulina y permite acceder a reservas energéticas. Una ventana de alimentación de 10 horas con cena temprana mejora sensibilidad insulínica y perfil lipídico en estudios controlados.',
        references: [
            'Sutton et al. (2018). Cell Metab 27(6):1212-1221.',
            'Wilkinson et al. (2020). Cell Metab 31(1):92-104.',
            'Jakubowicz et al. (2013). Obesity 21(12):2504-2512.',
        ],
    },

    /**
     * Pilar C (Conducta) — sueño, hidratación, ejercicio bajo, estrés.
     * Dos micro-hábitos compuestos de alta evidencia, bajo costo:
     *
     *   - Chang AM et al. (2015). "Evening use of light-emitting
     *     eReaders negatively affects sleep, circadian timing, and
     *     next-morning alertness." Proc Natl Acad Sci 112(4):1232-1237.
     *     → Luz azul nocturna retrasa melatonina ~1.5h y degrada
     *     alertness al despertar.
     *
     *   - Hale L, Guan S. (2015). "Screen time and sleep among
     *     school-aged children and adolescents: A systematic literature
     *     review." Sleep Med Rev 21:50-58.
     *     → Meta-análisis 67 estudios: uso de pantallas pre-sueño
     *     asociado a peor calidad y duración del sueño.
     *
     *   - Boschmann M et al. (2003). "Water-induced thermogenesis."
     *     J Clin Endocrinol Metab 88(12):6015-6019.
     *     → 500 mL de agua eleva termogénesis ~30% durante 30-40 min.
     *     Efecto modesto en absoluto pero acumulativo y de costo cero.
     */
    C: {
        title: 'Cierra pantallas 1 hora antes de dormir + 0.5 L de agua al despertar',
        detail:
            'La luz azul nocturna retrasa la melatonina y fragmenta el sueño profundo (cuando el cuerpo libera hormona de crecimiento). La hidratación matutina activa termogénesis. Dos hábitos compuestos de costo cero con evidencia repetida en revisiones sistemáticas.',
        references: [
            'Chang et al. (2015). PNAS 112(4):1232-1237.',
            'Hale & Guan (2015). Sleep Med Rev 21:50-58.',
            'Boschmann et al. (2003). J Clin Endocrinol Metab 88(12):6015-6019.',
        ],
    },
};

const LABELS: Record<PillarKey, WeakPillarResult['label']> = {
    E: 'Estructura',
    M: 'Metabolismo',
    C: 'Conducta',
};

/**
 * Acción de mantenimiento cuando los 3 pilares están en zona óptima.
 * No tiene referencias porque no es una intervención correctiva —
 * es validación del estado actual.
 */
const MAINTENANCE_ACTION: WeeklyAction = {
    title: 'Tu balance está sólido — mantén tu rutina esta semana',
    detail:
        'Los tres pilares (Estructura, Metabolismo, Conducta) están en zona óptima. La siguiente palanca es la consistencia: mantén exactamente lo que hiciste estas últimas 4 semanas durante una más.',
    references: [],
};

/**
 * Identifica el pilar con menor score raw + retorna la acción semanal
 * correspondiente. Inputs: `blocks` del `ImrResult` (rango 0-1).
 *
 * Si los 3 están ≥ OPTIMAL_THRESHOLD, retorna `isOptimal: true` con
 * la acción de mantenimiento (el `key` retornado es el pilar más bajo
 * para coherencia, pero el copy no es correctivo).
 */
export function identifyWeakPillar(
    blocks: { E: number; M: number; C: number }
): WeakPillarResult {
    // Orden de evaluación garantiza la regla de empate C > M > E:
    // recorremos en orden C, M, E y guardamos el primer mínimo.
    // El "primer mínimo" en ese orden es el que gana en empate.
    const ordered: { key: PillarKey; score: number }[] = [
        { key: 'C', score: blocks.C },
        { key: 'M', score: blocks.M },
        { key: 'E', score: blocks.E },
    ];

    let weakest = ordered[0];
    for (let i = 1; i < ordered.length; i++) {
        if (ordered[i].score < weakest.score) {
            weakest = ordered[i];
        }
    }

    const isOptimal =
        blocks.E >= OPTIMAL_THRESHOLD &&
        blocks.M >= OPTIMAL_THRESHOLD &&
        blocks.C >= OPTIMAL_THRESHOLD;

    return {
        key: weakest.key,
        label: LABELS[weakest.key],
        scorePct: Math.round(weakest.score * 100),
        scoreRaw: weakest.score,
        weeklyAction: isOptimal ? MAINTENANCE_ACTION : ACTIONS[weakest.key],
        isOptimal,
    };
}

/**
 * Export de las acciones brutas por si el frontend quiere mostrar
 * el catálogo completo en alguna vista de educación.
 */
export const PILLAR_ACTIONS = ACTIONS;
