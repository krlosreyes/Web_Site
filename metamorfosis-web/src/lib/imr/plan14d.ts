/**
 * Selección del Plan IMR de 14 días según pilar débil (SPEC-100).
 *
 * Lee los datos editoriales de `src/data/plan14d.ts` y produce un
 * array de 14 días "aplanado" donde cada día tiene UNA sola acción
 * (la del pilar débil del usuario), en vez de las 3 opciones.
 *
 * Cuando el usuario es óptimo (isOptimal=true de SPEC-099), no hay
 * un pilar débil claro. En ese caso retornamos un plan con acciones
 * rotativas (día 1=E, día 2=M, día 3=C, día 4=E...) para que la
 * experiencia sea más variada y exploratoria, en vez de correctiva.
 *
 * Diseño: función pura. Sin dependencias de Firebase ni de runtime.
 * Se puede llamar tanto en server-side como en cliente.
 */

import { PLAN_14_DAYS, type DayPlan, type DayAction } from '../../data/plan14d';
import type { PillarKey } from './weakPillar';

export type { DayPlan, DayAction };

/**
 * Plan aplanado para el usuario: cada día tiene UNA acción específica
 * (la elegida según el pilar débil) en lugar del objeto con las 3
 * opciones E/M/C.
 */
export interface DayPlanForUser {
    day: number;
    phase: 'Reset' | 'Consolidación';
    title: string;
    description: string;
    action: DayAction;
    /** Pilar al que pertenece la acción mostrada (útil para tracking). */
    sourcePillar: PillarKey;
}

/**
 * Rotación de pilares para usuarios óptimos. Repetimos el patrón
 * cada 3 días: E → M → C → E → M → C... Esto cubre los 14 días con
 * énfasis equilibrado (5×E, 5×M, 4×C) sin requerir contenido extra.
 *
 * Decisión arquitectónica: en vez de escribir 14 acciones de
 * "mantenimiento", reusamos las mismas acciones E/M/C que escribimos
 * para usuarios no-óptimos. La diferencia visual la marca el header
 * del componente ("Plan de exploración" vs "Plan correctivo").
 */
const OPTIMAL_ROTATION: PillarKey[] = ['E', 'M', 'C'];

function pillarForOptimalDay(day: number): PillarKey {
    // day es 1-indexed; convertimos a 0-indexed para el modulo.
    return OPTIMAL_ROTATION[(day - 1) % OPTIMAL_ROTATION.length];
}

/**
 * Retorna el plan de 14 días filtrado por pilar débil.
 *
 *   - `pillar = 'E' | 'M' | 'C'`: plan correctivo, todas las acciones
 *     son del mismo pilar.
 *   - `pillar = null`: plan de mantenimiento, acciones rotan E→M→C.
 */
export function getPlanForPillar(pillar: PillarKey | null): DayPlanForUser[] {
    return PLAN_14_DAYS.map((day) => {
        const effectivePillar = pillar ?? pillarForOptimalDay(day.day);
        return {
            day: day.day,
            phase: day.phase,
            title: day.title,
            description: day.description,
            action: day.actions[effectivePillar],
            sourcePillar: effectivePillar,
        };
    });
}

/**
 * Helper de display: dado un pilar, retorna su label humano.
 * Reusado por el componente Plan14d.
 */
export function pillarLabel(pillar: PillarKey | null): string {
    if (pillar === null) return 'Plan de exploración';
    if (pillar === 'E') return 'Estructura';
    if (pillar === 'M') return 'Metabolismo';
    return 'Conducta';
}

/**
 * Total de días del plan. Constante exportada para que tests y UI
 * no hardcodeen el número.
 */
export const PLAN_TOTAL_DAYS = PLAN_14_DAYS.length;
