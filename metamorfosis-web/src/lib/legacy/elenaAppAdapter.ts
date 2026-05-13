/**
 * Adapter del shape legacy de ElenaApp al schema canónico (SPEC-087).
 *
 * ElenaApp (Flutter) escribe `users/{uid}` con un shape plano:
 *   { name, age, gender: 'M'|'F', height, weight, waistCircumference,
 *     neckCircumference, bodyFatPercentage, fastingProtocol,
 *     mealsPerDay, exerciseGoalMinutes, profile: { wakeUpTime,
 *     sleepTime, firstMealGoal, lastMealGoal }, ... }
 *
 * El sitio web espera el shape canónico de SPEC-005:
 *   { displayName, gender: 'male'|'female', bio: {...}, habits: {...},
 *     imr: { current, history }, meta: { schemaVersion, createdAt } }
 *
 * Este módulo es PURE TS: no importa Firebase ni hace I/O. Se invoca
 * desde `/api/users/me` (server) y desde `BioDashboard` (client) con el
 * objeto crudo que llega de Firestore, y produce los campos canónicos
 * derivados — incluido un IMR baseline calculado con el motor del sitio.
 *
 * Idempotente: si el doc ya tiene shape canónico, las funciones lo
 * detectan y no modifican nada (retornan `{}` o `null` según el caso).
 *
 * Ver specs/SPEC-087-adapter-elenaapp-shape.md
 */

import { computeImr } from '../imr/engine';
import type { ImrResult, Gender } from '../types/user';

/** Doc crudo de Firestore — record genérico. */
export type RawDoc = Record<string, unknown>;

/**
 * Detecta si el doc viene en shape legacy de ElenaApp.
 *
 * Criterios (al menos UNO de los planos + ausencia del canónico):
 *   - Tiene `height`, `weight` o `waistCircumference` planos en root.
 *   - O tiene `gender: 'M'` / `'F'` (en lugar de 'male'/'female').
 *   - Y NO tiene `bio.heightCm` o `imr.current.imrScore` ya seteados.
 *
 * Esto evita el falso positivo de un doc que tenga AMBOS shapes
 * coexistiendo (futuro post-canonical-mirror de ElenaApp): si ya hay
 * canónico válido, no consideramos el doc "legacy" y el adapter no
 * actúa.
 */
export function isElenaAppLegacyShape(doc: RawDoc | null | undefined): boolean {
    if (!doc) return false;

    const bio = (doc.bio as RawDoc | undefined) ?? {};
    const imr = (doc.imr as RawDoc | undefined) ?? {};
    const imrCurrent = (imr.current as RawDoc | undefined) ?? null;

    const hasCanonicalBio = typeof bio.heightCm === 'number';
    const hasCanonicalImr =
        imrCurrent !== null &&
        typeof imrCurrent === 'object' &&
        typeof (imrCurrent as RawDoc).imrScore === 'number';

    // Si ya tiene canónico completo, no es "legacy puro" — no actuamos.
    if (hasCanonicalBio && hasCanonicalImr) return false;

    const hasLegacyBio =
        typeof doc.height === 'number' ||
        typeof doc.weight === 'number' ||
        typeof doc.waistCircumference === 'number';
    const hasLegacyGender = doc.gender === 'M' || doc.gender === 'F';

    return hasLegacyBio || hasLegacyGender;
}

/** Convierte 'M'/'F' al gender canónico. Default 'male' si desconocido. */
function coerceGender(raw: unknown): Gender {
    if (raw === 'F' || raw === 'female' || raw === 'Femenino') return 'female';
    return 'male';
}

/**
 * Parsea fastingProtocol legacy a horas de ayuno numéricas.
 *   'Ninguno' → 12 (línea base humana razonable, no 0).
 *   '16:8'    → 16
 *   '18:6'    → 18
 *   '20:4'    → 20
 *   otro      → 12 (default neutro)
 *
 * Decisión: usamos 12h como baseline para "Ninguno" porque
 * fisiológicamente todos hacemos ~12h de ayuno entre cena y desayuno.
 * Esto evita que el motor IMR penalice fuerte el bloque metabolismo
 * para usuarios nuevos que aún no eligieron protocolo.
 */
function parseFastingProtocol(raw: unknown): number {
    if (typeof raw !== 'string') return 12;
    switch (raw) {
        case 'Ninguno':
            return 12;
        case '16:8':
            return 16;
        case '18:6':
            return 18;
        case '20:4':
            return 20;
        default:
            return 12;
    }
}

/**
 * Convierte un valor Firestore Timestamp (o ISO string) a hora float
 * (ej. 21:30 → 21.5). Retorna `null` si el valor no se puede interpretar.
 *
 * ElenaApp guarda las horas de comida como `Timestamp` de Firestore;
 * cuando lo recibimos vía Admin SDK puede llegar como objeto con
 * `_seconds` o como `Date`. Soportamos ambos.
 */
function toHourFloat(raw: unknown): number | null {
    if (!raw) return null;
    let d: Date | null = null;
    if (raw instanceof Date) {
        d = raw;
    } else if (typeof raw === 'object' && raw !== null) {
        const ts = raw as { toDate?: () => Date; _seconds?: number; seconds?: number };
        if (typeof ts.toDate === 'function') d = ts.toDate();
        else if (typeof ts._seconds === 'number') d = new Date(ts._seconds * 1000);
        else if (typeof ts.seconds === 'number') d = new Date(ts.seconds * 1000);
    } else if (typeof raw === 'string') {
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) d = parsed;
    }
    if (!d) return null;
    return d.getHours() + d.getMinutes() / 60;
}

/**
 * Mapea el shape legacy de ElenaApp a los campos canónicos.
 * NO toca el shape legacy original — solo produce los campos nuevos
 * que se mezclarán por `merge: true`.
 *
 * Si el doc no tiene los inputs mínimos (height, weight, gender, age),
 * retorna un objeto parcial con lo que sí pudo derivar.
 */
export function adaptElenaAppToCanonical(doc: RawDoc): Partial<RawDoc> {
    const nowIso = new Date().toISOString();
    const profile = (doc.profile as RawDoc | undefined) ?? {};

    const heightCm = typeof doc.height === 'number' ? doc.height : null;
    const weightKg = typeof doc.weight === 'number' ? doc.weight : null;
    const waistCm =
        typeof doc.waistCircumference === 'number' ? doc.waistCircumference : null;
    const neckCm =
        typeof doc.neckCircumference === 'number' ? doc.neckCircumference : null;
    const bodyFatPct =
        typeof doc.bodyFatPercentage === 'number' ? doc.bodyFatPercentage : null;
    const leanMassPct = bodyFatPct !== null ? 100 - bodyFatPct : null;

    const lastMealHour = toHourFloat(profile.lastMealGoal);

    const name = typeof doc.name === 'string' ? doc.name : 'Biohacker';

    return {
        displayName: name,
        // gender canónico va como campo nuevo. NO pisamos `doc.gender`
        // (que sigue siendo 'M'|'F' para la app); el sitio lee de
        // `gender` con prioridad si es 'male'/'female', y si no, hace
        // coerción al vuelo (ver normalización en el caller).
        gender: coerceGender(doc.gender),
        bio: {
            heightCm,
            weightKg,
            waistCm,
            neckCm,
            hipCm: null,
            bodyFatPct,
            leanMassPct,
            updatedAt: nowIso,
        },
        habits: {
            fastingHours: parseFastingProtocol(doc.fastingProtocol),
            dinnerHour: lastMealHour,
            lastMealHour,
            exerciseMinutesPerDay:
                typeof doc.exerciseGoalMinutes === 'number'
                    ? doc.exerciseGoalMinutes
                    : null,
            sleepQuality: null,
            hydrationLitresPerDay: null,
            source: 'self_report',
            updatedAt: nowIso,
        },
        meta: {
            schemaVersion: 1,
            createdAt: nowIso,
        },
    };
}

/**
 * Calcula un IMR baseline usando el motor del sitio (`computeImr`) con
 * los inputs disponibles en el shape legacy.
 *
 * Retorna `null` si faltan inputs mínimos (height, weight, waist, age).
 * El neck es opcional: si falta, se estima conservadoramente para que
 * Body Fat Navy no falle (38cm hombre, 32cm mujer — aproximaciones
 * promedio adulto sano).
 */
export function computeBaselineImrFromLegacy(doc: RawDoc): ImrResult | null {
    const heightCm = typeof doc.height === 'number' ? doc.height : null;
    const weightKg = typeof doc.weight === 'number' ? doc.weight : null;
    const waistCm =
        typeof doc.waistCircumference === 'number' ? doc.waistCircumference : null;
    const age = typeof doc.age === 'number' ? doc.age : null;
    const gender = coerceGender(doc.gender);

    if (heightCm === null || weightKg === null || waistCm === null || age === null) {
        return null;
    }

    const neckCm =
        typeof doc.neckCircumference === 'number'
            ? doc.neckCircumference
            : gender === 'male'
                ? 38
                : 32;

    const bodyFatPct =
        typeof doc.bodyFatPercentage === 'number'
            ? doc.bodyFatPercentage
            : undefined;

    return computeImr({
        heightCm,
        weightKg,
        waistCm,
        neckCm,
        age,
        gender,
        bodyFatPct,
        // Hábitos: defaults razonables si no vienen explícitos.
        fastingHours: parseFastingProtocol(doc.fastingProtocol),
        dinnerHour: toHourFloat((doc.profile as RawDoc | undefined)?.lastMealGoal) ?? 20,
        exerciseMinutes:
            typeof doc.exerciseGoalMinutes === 'number'
                ? doc.exerciseGoalMinutes
                : 20,
        sleepQuality: 0.7,
        hydrationLitres: 2,
        hydrationGoal: 3,
        lastMealHour:
            toHourFloat((doc.profile as RawDoc | undefined)?.lastMealGoal) ?? 20,
    });
}

/**
 * Pipeline completo: detecta legacy → mapea canónico → computa baseline IMR.
 *
 * Devuelve `{ patch, imrCurrent }` donde:
 *   - `patch` es lo que hay que mergear al doc en Firestore (campos
 *     canónicos + opcionalmente imr.current si se pudo computar).
 *   - `imrCurrent` es el ImrResult para mostrar inmediatamente al user
 *     en la respuesta de `/api/users/me`. Null si no se pudo computar.
 *
 * Si el doc ya está en shape canónico, retorna `{ patch: null, imrCurrent: null }`
 * y el caller no debe hacer nada.
 */
export function buildCanonicalPatch(doc: RawDoc | null | undefined): {
    patch: Partial<RawDoc> | null;
    imrCurrent: ImrResult | null;
} {
    if (!doc || !isElenaAppLegacyShape(doc)) {
        return { patch: null, imrCurrent: null };
    }

    const canonical = adaptElenaAppToCanonical(doc);
    const imrCurrent = computeBaselineImrFromLegacy(doc);

    const patch: Partial<RawDoc> = { ...canonical };
    if (imrCurrent) {
        patch.imr = { current: imrCurrent, history: [] };
    }

    return { patch, imrCurrent };
}
