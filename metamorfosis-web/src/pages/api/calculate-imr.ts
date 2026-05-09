/**
 * POST /api/calculate-imr
 *
 * Endpoint público. Recibe biometría + (opcional) hábitos y devuelve un
 * `ImrResult` completo con score, label, blocks, body fat derivado, métricas
 * de composición y edad metabólica.
 *
 * Diseño:
 *   - Pure compute. NO escribe en Firestore. La persistencia del cálculo en
 *     `users/{uid}` la hace SPEC-006 (onboarding) tras autenticación, no este
 *     endpoint.
 *   - Sin auth: el quiz funciona para visitantes anónimos. Si el quiz se
 *     dispara desde sesión autenticada, el cliente persiste en otra llamada.
 *   - Validación estricta de inputs numéricos requeridos: 400 si faltan.
 *
 * Ver specs/SPEC-004-calculate-imr-write.md (sub-spec 4.1, opción B: motor local)
 */

import type { APIRoute } from 'astro';
import { computeImr } from '../../lib/imr/engine';
import type { Gender, ImrResult } from '../../lib/types/user';

export const prerender = false;

const REQUIRED_NUMERIC_FIELDS = [
    'heightCm',
    'currentWeightKg',
    'waistCircumferenceCm',
    'neckCircumferenceCm',
] as const;

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
        },
    });
}

export const POST: APIRoute = async ({ request }) => {
    let data: any;
    try {
        data = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }

    // Validar campos numéricos requeridos
    for (const k of REQUIRED_NUMERIC_FIELDS) {
        if (typeof data[k] !== 'number' || !Number.isFinite(data[k])) {
            return jsonResponse(400, { error: `Campo inválido: ${k}` });
        }
    }

    try {
        const result: ImrResult = computeImr({
            heightCm: data.heightCm,
            weightKg: data.currentWeightKg,
            waistCm: data.waistCircumferenceCm,
            neckCm: data.neckCircumferenceCm,
            hipCm: typeof data.hipCircumferenceCm === 'number' ? data.hipCircumferenceCm : undefined,
            age: typeof data.age === 'number' ? data.age : 40,
            gender: (data.gender === 'female' ? 'female' : 'male') as Gender,
            bodyFatPct: typeof data.bodyFat === 'number' ? data.bodyFat : undefined,
            fastingHours: typeof data.fastingHours === 'number' ? data.fastingHours : undefined,
            dinnerHour: typeof data.dinnerHour === 'number' ? data.dinnerHour : undefined,
            exerciseMinutes: typeof data.exerciseMinutes === 'number' ? data.exerciseMinutes : undefined,
            sleepQuality: typeof data.sleepQuality === 'number' ? data.sleepQuality : undefined,
            hydrationLitres: typeof data.hydrationLitres === 'number' ? data.hydrationLitres : undefined,
            hydrationGoal: typeof data.hydrationGoal === 'number' ? data.hydrationGoal : undefined,
            lastMealHour: typeof data.lastMealHour === 'number' ? data.lastMealHour : undefined,
        });

        return jsonResponse(200, { success: true, result });
    } catch (error) {
        console.error('[calculate-imr] Engine error:', error);
        return jsonResponse(500, { error: 'Error interno del motor IMR' });
    }
};
