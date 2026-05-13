/**
 * Tests del adapter de ElenaApp legacy (SPEC-087).
 *
 * Ejecutar con: `npm test`
 */

import { describe, test, expect } from 'vitest';

import {
    isElenaAppLegacyShape,
    adaptElenaAppToCanonical,
    buildCanonicalPatch,
} from './elenaAppAdapter';

// Doc de prueba real: replica el shape auditado del user `prueba1@gmail.com`
// (ver AUDITORIA_SCHEMA_USERS_v1.0.md).
const PRUEBA1_LEGACY_DOC = {
    activityLevel: 1.2,
    age: 46,
    bodyFatPercentage: 20,
    confidenceLevel: 'BAJA',
    email: 'prueba1@gmail.com',
    exerciseGoalMinutes: 20,
    fastingProtocol: 'Ninguno',
    gender: 'M',
    healthDisclaimerAccepted: true,
    height: 180,
    imrStdDev: 0,
    isMeasurementEstimated: true,
    mealsPerDay: 5,
    name: 'Prueba1',
    neckCircumference: 39,
    pantSize: 34,
    pathologies: ['Hígado Graso'],
    profile: {
        firstMealGoal: new Date('2026-05-13T13:00:00Z'),
        lastMealGoal: new Date('2026-05-13T23:00:00Z'),
        sleepTime: new Date('2026-05-13T12:00:00Z'),
        wakeUpTime: new Date('2026-05-13T08:00:00Z'),
    },
    shirtSize: 'L',
    waistCircumference: 99,
    weeklyAdherence: 0.85,
    weight: 100,
};

const CANONICAL_DOC = {
    displayName: 'Carlos',
    gender: 'male',
    bio: {
        heightCm: 180,
        weightKg: 75,
        waistCm: 80,
        neckCm: 38,
        hipCm: null,
        bodyFatPct: 15,
        leanMassPct: 85,
        updatedAt: '2026-05-13T00:00:00.000Z',
    },
    imr: {
        current: {
            imrScore: 78,
            label: 'EFICIENTE',
            blocks: { E: 0.85, M: 0.75, C: 0.7 },
            ica: 0.44,
            imc: 23.1,
            tmb: 1700,
            metabolicAge: 32,
            ffmi: 19.7,
            whtr: 0.44,
        },
        history: [],
    },
    meta: { schemaVersion: 1, createdAt: '2026-05-13T00:00:00.000Z' },
};

describe('isElenaAppLegacyShape', () => {
    test('detecta shape legacy de ElenaApp', () => {
        expect(isElenaAppLegacyShape(PRUEBA1_LEGACY_DOC)).toBe(true);
    });

    test('reconoce shape canónico como NO legacy', () => {
        expect(isElenaAppLegacyShape(CANONICAL_DOC)).toBe(false);
    });

    test('reconoce null/undefined/{} como NO legacy', () => {
        expect(isElenaAppLegacyShape(null)).toBe(false);
        expect(isElenaAppLegacyShape(undefined)).toBe(false);
        expect(isElenaAppLegacyShape({})).toBe(false);
    });

    test('doc con gender M pero sin bio plano: detecta legacy', () => {
        const doc = { gender: 'M', name: 'X' };
        expect(isElenaAppLegacyShape(doc)).toBe(true);
    });

    test('doc con AMBOS shapes coexistiendo: no es legacy puro', () => {
        const doc = {
            ...PRUEBA1_LEGACY_DOC,
            ...CANONICAL_DOC,
        };
        // Tiene bio.heightCm Y imr.current.imrScore → canónico válido.
        expect(isElenaAppLegacyShape(doc)).toBe(false);
    });
});

describe('adaptElenaAppToCanonical', () => {
    test('mapea name → displayName', () => {
        const patch = adaptElenaAppToCanonical(PRUEBA1_LEGACY_DOC);
        expect(patch.displayName).toBe('Prueba1');
    });

    test('coerce gender M → male', () => {
        const patch = adaptElenaAppToCanonical(PRUEBA1_LEGACY_DOC);
        expect(patch.gender).toBe('male');
    });

    test('coerce gender F → female', () => {
        const patch = adaptElenaAppToCanonical({
            ...PRUEBA1_LEGACY_DOC,
            gender: 'F',
        });
        expect(patch.gender).toBe('female');
    });

    test('bio mapea height/weight/waist/neck/bodyFat', () => {
        const patch = adaptElenaAppToCanonical(PRUEBA1_LEGACY_DOC);
        const bio = patch.bio as Record<string, unknown>;
        expect(bio.heightCm).toBe(180);
        expect(bio.weightKg).toBe(100);
        expect(bio.waistCm).toBe(99);
        expect(bio.neckCm).toBe(39);
        expect(bio.bodyFatPct).toBe(20);
        expect(bio.leanMassPct).toBe(80);
        expect(bio.hipCm).toBe(null);
        expect(typeof bio.updatedAt).toBe('string');
    });

    test('habits parsea fastingProtocol "Ninguno" → 12h baseline', () => {
        const patch = adaptElenaAppToCanonical(PRUEBA1_LEGACY_DOC);
        const habits = patch.habits as Record<string, unknown>;
        expect(habits.fastingHours).toBe(12);
    });

    test('habits parsea fastingProtocol "16:8" → 16', () => {
        const patch = adaptElenaAppToCanonical({
            ...PRUEBA1_LEGACY_DOC,
            fastingProtocol: '16:8',
        });
        const habits = patch.habits as Record<string, unknown>;
        expect(habits.fastingHours).toBe(16);
    });

    test('habits parsea fastingProtocol "20:4" → 20', () => {
        const patch = adaptElenaAppToCanonical({
            ...PRUEBA1_LEGACY_DOC,
            fastingProtocol: '20:4',
        });
        const habits = patch.habits as Record<string, unknown>;
        expect(habits.fastingHours).toBe(20);
    });

    test('habits.dinnerHour deriva de profile.lastMealGoal', () => {
        const patch = adaptElenaAppToCanonical(PRUEBA1_LEGACY_DOC);
        const habits = patch.habits as Record<string, unknown>;
        const dinner = habits.dinnerHour as number;
        // El Date está a las 23:00 UTC → en local depende del TZ.
        // Validamos que sea un número en rango 0..24.
        expect(typeof dinner).toBe('number');
        expect(dinner).toBeGreaterThanOrEqual(0);
        expect(dinner).toBeLessThan(24);
    });

    test('habits.source = "self_report"', () => {
        const patch = adaptElenaAppToCanonical(PRUEBA1_LEGACY_DOC);
        const habits = patch.habits as Record<string, unknown>;
        expect(habits.source).toBe('self_report');
    });

    test('meta.schemaVersion = 1', () => {
        const patch = adaptElenaAppToCanonical(PRUEBA1_LEGACY_DOC);
        const meta = patch.meta as Record<string, unknown>;
        expect(meta.schemaVersion).toBe(1);
    });

    test('exerciseMinutesPerDay mapea desde exerciseGoalMinutes', () => {
        const patch = adaptElenaAppToCanonical(PRUEBA1_LEGACY_DOC);
        const habits = patch.habits as Record<string, unknown>;
        expect(habits.exerciseMinutesPerDay).toBe(20);
    });
});

describe('buildCanonicalPatch (SPEC-088: BD es fuente única)', () => {
    test('retorna patch con campos canónicos derivables', () => {
        const { patch } = buildCanonicalPatch(PRUEBA1_LEGACY_DOC);
        expect(patch).not.toBeNull();
        expect(patch!.displayName).toBe('Prueba1');
        expect(patch!.gender).toBe('male');
        expect(patch!.bio).toBeDefined();
        expect(patch!.habits).toBeDefined();
        expect(patch!.meta).toBeDefined();
    });

    test('SPEC-088: patch NO incluye imr (el sitio no calcula)', () => {
        const { patch } = buildCanonicalPatch(PRUEBA1_LEGACY_DOC);
        // La BD es fuente única del IMR. Quien onboardea primero
        // escribe (ElenaApp vía canonical-mirror o quiz web vía
        // /api/users/onboard). El adapter NO inventa baselines.
        expect(patch!.imr).toBeUndefined();
    });

    test('retorna null patch para shape canónico (idempotencia)', () => {
        const { patch } = buildCanonicalPatch(CANONICAL_DOC);
        expect(patch).toBeNull();
    });

    test('retorna null patch para null doc', () => {
        const { patch } = buildCanonicalPatch(null);
        expect(patch).toBeNull();
    });

    test('retorna null patch para undefined doc', () => {
        const { patch } = buildCanonicalPatch(undefined);
        expect(patch).toBeNull();
    });
});
