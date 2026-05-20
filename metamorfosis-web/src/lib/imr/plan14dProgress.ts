/**
 * Lógica de progresión del Plan IMR 14d (SPEC-101).
 *
 * Funciones puras sobre `UserPlan14d`. Sin side effects, sin
 * dependencias de Firebase ni del DOM. Testeable aisladamente.
 *
 * El componente `Plan14d.tsx` usa estos helpers para decidir qué día
 * está activo, qué días mostrar bloqueados, y cuándo permitir undo.
 * La persistencia (escribir el resultado a Firestore) es responsabilidad
 * del componente — este módulo solo produce el NUEVO estado.
 */

import type { UserPlan14d } from '../types/user';
import { PLAN_TOTAL_DAYS } from './plan14d';

/**
 * Estado inicial cuando el user aún no ha completado ningún día.
 * Se usa al primer mount del componente y como fallback si el doc
 * Firestore no tiene el campo `plan14d`.
 */
export const INITIAL_PROGRESS: UserPlan14d = {
    startedAt: null,
    completedDays: [],
    initialPillar: null,
    completedAt: {},
    finishedAt: null,
};

/**
 * Retorna el número del día actual (el siguiente a completar).
 * Si todos los días están completados, retorna `PLAN_TOTAL_DAYS + 1`
 * para que el componente sepa que está en estado de cierre.
 */
export function getCurrentDay(progress: UserPlan14d): number {
    if (progress.completedDays.length === 0) return 1;
    const max = Math.max(...progress.completedDays);
    return Math.min(max + 1, PLAN_TOTAL_DAYS + 1);
}

/** `true` si el día ya fue completado por el usuario. */
export function isDayCompleted(progress: UserPlan14d, day: number): boolean {
    return progress.completedDays.includes(day);
}

/**
 * `true` si el día NO es accesible aún (está más allá del día actual).
 * El día actual NO se considera "locked" — se considera "current".
 */
export function isDayLocked(progress: UserPlan14d, day: number): boolean {
    return day > getCurrentDay(progress);
}

/**
 * `true` si el usuario puede marcar este día como completado AHORA.
 * Solo se permite marcar el día actual y solo si no fue ya marcado.
 */
export function canCompleteDay(progress: UserPlan14d, day: number): boolean {
    return day === getCurrentDay(progress) && !isDayCompleted(progress, day);
}

/**
 * `true` si el usuario puede deshacer el último día marcado.
 * Solo si hay al menos uno completado.
 */
export function canUndoLastDay(progress: UserPlan14d): boolean {
    return progress.completedDays.length > 0;
}

/**
 * `true` si el usuario completó los 14 días.
 */
export function isPlanFinished(progress: UserPlan14d): boolean {
    return progress.completedDays.length >= PLAN_TOTAL_DAYS;
}

/**
 * Aplica "marcar como completado" al estado y retorna el nuevo
 * `UserPlan14d`. NO escribe a Firestore — el componente lo hace
 * con el objeto retornado.
 *
 * Si `canCompleteDay(progress, day)` retorna false, retorna el
 * mismo objeto sin cambios (defensa contra doble-click o race
 * conditions de UI).
 *
 * @param day día a marcar (debe ser el día actual)
 * @param initialPillar pilar al momento de iniciar (solo se setea en el día 1)
 * @param nowIso ISO timestamp del momento de completion. Pasarlo como
 *               parámetro permite tests deterministas; en producción
 *               el componente pasa `new Date().toISOString()`.
 */
export function markDayComplete(
    progress: UserPlan14d,
    day: number,
    initialPillar: 'E' | 'M' | 'C' | null,
    nowIso: string
): UserPlan14d {
    if (!canCompleteDay(progress, day)) return progress;

    const next: UserPlan14d = {
        ...progress,
        completedDays: [...progress.completedDays, day],
        completedAt: { ...progress.completedAt, [String(day)]: nowIso },
        // startedAt solo se setea la primera vez (al marcar día 1).
        startedAt: progress.startedAt ?? nowIso,
        // initialPillar también solo se setea la primera vez.
        initialPillar: progress.initialPillar ?? initialPillar,
        // finishedAt se setea solo cuando se completa día 14.
        finishedAt:
            progress.completedDays.length + 1 >= PLAN_TOTAL_DAYS
                ? nowIso
                : progress.finishedAt,
    };
    return next;
}

/**
 * Aplica "desmarcar último" al estado y retorna el nuevo `UserPlan14d`.
 * Solo permite remover el día con mayor número (el último marcado).
 *
 * Si no hay nada para desmarcar, retorna el mismo objeto sin cambios.
 */
export function undoLastDay(progress: UserPlan14d): UserPlan14d {
    if (!canUndoLastDay(progress)) return progress;
    const sorted = [...progress.completedDays].sort((a, b) => a - b);
    const lastDay = sorted[sorted.length - 1];
    const remaining = sorted.slice(0, -1);

    const nextCompletedAt = { ...progress.completedAt };
    delete nextCompletedAt[String(lastDay)];

    return {
        ...progress,
        completedDays: remaining,
        completedAt: nextCompletedAt,
        // Si desmarcamos día 14, también borramos finishedAt.
        finishedAt: lastDay === PLAN_TOTAL_DAYS ? null : progress.finishedAt,
        // Si desmarcamos día 1 (queda vacío), también borramos startedAt
        // e initialPillar — el plan vuelve al estado virgen.
        startedAt: remaining.length === 0 ? null : progress.startedAt,
        initialPillar: remaining.length === 0 ? null : progress.initialPillar,
    };
}
