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
import { buildCanonicalPatch } from '../../../lib/legacy/elenaAppAdapter';

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
        const docRef = db.collection(COLLECTIONS.USERS).doc(decoded.uid);
        const snap = await docRef.get();

        if (!snap.exists) {
            return jsonResponse(404, { error: 'User doc not found', uid: decoded.uid });
        }

        const rawData = snap.data() ?? {};

        // SPEC-087 + SPEC-088: si el doc viene en shape legacy de
        // ElenaApp (Flutter), canonicalizamos los campos derivables
        // (displayName, bio, habits, meta) y los persistimos. El IMR
        // NO se calcula acá; lo escribe quien onboardea primero (la
        // app vía canonical-mirror, o el quiz web). Si el doc no tiene
        // imr.current, el dashboard muestra "Tu IMR aún no está
        // disponible" en lugar de un número inventado.
        const { patch } = buildCanonicalPatch(rawData);
        let mergedData = rawData;
        if (patch) {
            try {
                await docRef.set(patch, { merge: true });
                // Mergeamos en memoria también para devolver el shape
                // canónico en esta misma respuesta, sin segundo fetch.
                mergedData = { ...rawData, ...patch };
            } catch (writeErr) {
                console.error('[me] SPEC-087 canonical persist error:', writeErr);
                // Fallback: devolvemos el merge en memoria aunque la
                // persistencia haya fallado. El user ve su IMR; el doc
                // se canonicalizará en la próxima lectura exitosa.
                mergedData = { ...rawData, ...patch };
            }
        }

        return jsonResponse(200, { success: true, user: mergedData });
    } catch (err) {
        console.error('[me] Error:', err);
        return jsonResponse(500, { error: 'Error interno' });
    }
};
