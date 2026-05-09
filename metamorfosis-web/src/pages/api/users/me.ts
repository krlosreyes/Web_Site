/**
 * GET /api/users/me
 *
 * Devuelve el documento canónico `users/{uid}` del usuario autenticado.
 *
 * Auth: Firebase ID token en header `Authorization: Bearer <token>`.
 *
 * Útil cuando el cliente prefiere un fetch contra el server (con caching) en
 * lugar de pegar a Firestore directo. Reglas de seguridad de Firestore ya
 * garantizan que el dueño puede leer su propio doc, pero este endpoint es más
 * predictible para SSR y para entornos donde el cliente Firebase no es ideal
 * (por ejemplo, integraciones con otros servicios).
 *
 * Ver specs/SPEC-006-onboarding-web-app.md
 */

import type { APIRoute } from 'astro';
import { db, auth } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';

export const prerender = false;

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export const GET: APIRoute = async ({ request }) => {
    const authHeader = request.headers.get('authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) {
        return jsonResponse(401, { error: 'Missing ID token' });
    }

    let decoded;
    try {
        decoded = await auth.verifyIdToken(idToken);
    } catch {
        return jsonResponse(401, { error: 'Invalid ID token' });
    }

    try {
        const snap = await db
            .collection(COLLECTIONS.USERS)
            .doc(decoded.uid)
            .get();

        if (!snap.exists) {
            return jsonResponse(404, { error: 'User doc not found', uid: decoded.uid });
        }

        return jsonResponse(200, { success: true, user: snap.data() });
    } catch (err) {
        console.error('[me] Error:', err);
        return jsonResponse(500, { error: 'Error interno' });
    }
};
