/**
 * Asignación atómica de cohorte de fundadores (SPEC-056).
 *
 * `assignFounderIfEligible` se invoca desde el onboard. Encapsula la
 * transacción Firestore que:
 *   1. Lee `system/counters.founderCount` actual.
 *   2. Si < FOUNDER_CAP → incrementa counter + setea `users/{uid}.founder.isFounder=true`.
 *   3. Si >= FOUNDER_CAP → setea `users/{uid}.founder.isFounder=false`.
 *   4. Es IDEMPOTENTE: si el user ya tiene `founder.isFounder` definido
 *      (≠ undefined), retorna ese valor sin tocar counter ni doc.
 *
 * Garantía: dos onboards concurrentes que llegan al cupo #FOUNDER_CAP no
 * pueden ambos terminar marcados como fundadores. Firestore aborta una
 * de las transacciones y la reintenta con el counter ya incrementado.
 */

import { db, FieldValue } from './firebaseAdmin';
import { COLLECTIONS } from './constants/firestore';
import {
    FOUNDER_CAP,
    FOUNDER_COUNTER_DOC,
    FOUNDER_COUNTER_FIELD,
} from './constants/founders';
import type { UserFounder } from './types/user';

export interface FounderAssignmentResult {
    /** True si esta llamada asignó (nuevo) o el user ya era fundador. */
    isFounder: boolean;
    /** Número 1..FOUNDER_CAP. null si no es fundador. */
    number: number | null;
    /** ISO string. null si no es fundador. */
    assignedAt: string | null;
    /**
     * True si esta llamada CREÓ la asignación (incrementó el counter).
     * False si el user ya tenía `founder.isFounder` y solo retornamos el
     * estado existente (idempotencia). Útil para decidir si enviar el
     * email de bienvenida fundador (que solo debe ir en la primera asignación).
     */
    wasAssignedNow: boolean;
}

/**
 * Asigna el cohorte fundador al user `uid` si todavía hay cupo y el user
 * no fue asignado antes.
 *
 * Llamar después de que `users/{uid}` ya esté creado (típicamente al final
 * del onboard, después del `set` con merge).
 */
export async function assignFounderIfEligible(
    uid: string,
    nowIso: string,
): Promise<FounderAssignmentResult> {
    const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
    const counterRef = db
        .collection(FOUNDER_COUNTER_DOC.collection)
        .doc(FOUNDER_COUNTER_DOC.doc);

    return await db.runTransaction(async (tx) => {
        // 1. Leer estado actual del user.
        const userSnap = await tx.get(userRef);
        const userData = userSnap.data() as
            | { founder?: UserFounder }
            | undefined;
        const existingFounder = userData?.founder;

        // 2. Idempotencia: si ya tiene founder definido, no tocar nada.
        // Se considera "definido" si `isFounder` es boolean (no undefined).
        // Esto cubre tanto el caso "ya fue marcado fundador" como
        // "ya fue marcado NO fundador" (cupo lleno en intento anterior).
        if (existingFounder && typeof existingFounder.isFounder === 'boolean') {
            return {
                isFounder: existingFounder.isFounder,
                number: existingFounder.number ?? null,
                assignedAt: existingFounder.assignedAt ?? null,
                wasAssignedNow: false,
            };
        }

        // 3. Leer counter actual.
        const counterSnap = await tx.get(counterRef);
        const counterData = counterSnap.data() as
            | { [K in typeof FOUNDER_COUNTER_FIELD]?: number }
            | undefined;
        const currentCount = counterData?.[FOUNDER_COUNTER_FIELD] ?? 0;

        // 4. Decidir.
        if (currentCount >= FOUNDER_CAP) {
            // Cupo lleno → user normal.
            const founderField: UserFounder = {
                isFounder: false,
                number: null,
                assignedAt: null,
            };
            tx.set(userRef, { founder: founderField }, { merge: true });
            return {
                isFounder: false,
                number: null,
                assignedAt: null,
                wasAssignedNow: true,
            };
        }

        // 5. Hay cupo → incrementar counter y marcar fundador.
        const newCount = currentCount + 1;
        const founderField: UserFounder = {
            isFounder: true,
            number: newCount,
            assignedAt: nowIso,
        };

        // FieldValue.increment es seguro dentro de transaction: respeta
        // el read previo y aborta si otra transacción cambió el counter.
        tx.set(
            counterRef,
            { [FOUNDER_COUNTER_FIELD]: FieldValue.increment(1) },
            { merge: true },
        );
        tx.set(userRef, { founder: founderField }, { merge: true });

        return {
            isFounder: true,
            number: newCount,
            assignedAt: nowIso,
            wasAssignedNow: true,
        };
    });
}
