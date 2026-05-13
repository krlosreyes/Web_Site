/**
 * Counters atómicos del funnel del quiz IMR (SPEC-093).
 *
 * Persistidos en `system/counters.quizFunnel.<event>` con
 * `FieldValue.increment(1)`. Atómico ante concurrencia.
 *
 * Eventos del funnel:
 *   - 'started': click "Iniciar mi diagnóstico" en el step 0 del quiz.
 *   - 'completed': el user llegó al final del quiz (handleFinish).
 *   - 'registered': cuenta creada desde el flujo del quiz.
 *
 * Best-effort: si la op falla, NO propaga ni rompe el flujo del user.
 */

import { db, FieldValue } from './firebaseAdmin';

export type QuizFunnelEvent = 'started' | 'completed' | 'registered';

const COUNTER_PATH = 'system/counters';
const FIELD_NAMESPACE = 'quizFunnel';

/** Map de event → field name dentro del namespace. */
const FIELD_BY_EVENT: Record<QuizFunnelEvent, string> = {
    started: 'started',
    completed: 'completed',
    registered: 'registered',
};

export function isValidFunnelEvent(value: unknown): value is QuizFunnelEvent {
    return value === 'started' || value === 'completed' || value === 'registered';
}

/**
 * Incrementa atómicamente `system/counters.quizFunnel.<event>` en +1.
 * Best-effort: nunca lanza.
 */
export async function incrementFunnel(event: QuizFunnelEvent): Promise<void> {
    try {
        const [collection, docId] = COUNTER_PATH.split('/');
        await db
            .collection(collection)
            .doc(docId)
            .set(
                {
                    [FIELD_NAMESPACE]: {
                        [FIELD_BY_EVENT[event]]: FieldValue.increment(1),
                    },
                },
                { merge: true },
            );
    } catch (err) {
        console.error('[quizFunnel] incrementFunnel error:', err);
    }
}
