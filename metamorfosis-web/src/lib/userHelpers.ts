/**
 * Helpers de user (SPEC-036).
 *
 * Resuelven gotchas conocidos del flow de auth + onboarding,
 * principalmente el `decoded.name` vacío en cuentas recién creadas
 * (el ID token cacheado no refleja `updateProfile` que ocurre en cliente).
 */

import { db } from './firebaseAdmin';
import { COLLECTIONS } from './constants/firestore';

/**
 * Devuelve el displayName real del usuario:
 *   1. Si el token trae `name`, lo usa.
 *   2. Si no, busca `users/{uid}.displayName` en Firestore (lo persistimos
 *      explícito en SPEC-029b vía `body.displayName` en /api/users/onboard).
 *   3. Fallback final: 'Biohacker'.
 *
 * Solo hace 1 read extra a Firestore cuando el token está vacío (cuentas nuevas).
 */
export async function getDisplayName(
    uid: string,
    tokenName: string | null | undefined
): Promise<string> {
    if (tokenName && tokenName.trim()) return tokenName.trim();
    try {
        const snap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
        const dn = snap.data()?.displayName;
        if (typeof dn === 'string' && dn.trim()) return dn.trim();
    } catch (e) {
        console.warn('[getDisplayName] Firestore lookup failed:', e);
    }
    return 'Biohacker';
}
