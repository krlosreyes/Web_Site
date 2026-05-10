/**
 * GET  /api/users/me/notifications?limit=20  — lista del user actual + unreadCount
 * POST /api/users/me/notifications/read       (handled aquí también con `?op=read`
 *                                               para evitar otra ruta dedicada)
 *
 * Auth: Firebase ID token en `Authorization: Bearer <token>`.
 * SPEC-043.
 */

import type { APIRoute } from 'astro';
import { db, auth } from '../../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../../lib/constants/firestore';

export const prerender = false;

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function authFromRequest(
    request: Request
): Promise<{ uid: string } | null> {
    const authHeader = request.headers.get('authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) return null;
    try {
        const decoded = await auth.verifyIdToken(idToken);
        return { uid: decoded.uid };
    } catch {
        return null;
    }
}

export const GET: APIRoute = async ({ request, url }) => {
    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);
    const limit = Math.max(1, Math.min(100, isNaN(limitParam) ? 20 : limitParam));

    try {
        const ref = db
            .collection(COLLECTIONS.USERS)
            .doc(session.uid)
            .collection('notifications');

        const [listSnap, unreadSnap] = await Promise.all([
            ref.orderBy('createdAt', 'desc').limit(limit).get(),
            ref.where('read', '==', false).count().get(),
        ]);

        const items = listSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const unreadCount = unreadSnap.data().count;

        return jsonResponse(200, { success: true, items, unreadCount });
    } catch (error) {
        console.error('[notifications.GET] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};

/**
 * POST con body { ids?: string[], all?: boolean } — marca como leídas.
 */
export const POST: APIRoute = async ({ request }) => {
    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    let body: { ids?: string[]; all?: boolean };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }

    try {
        const ref = db
            .collection(COLLECTIONS.USERS)
            .doc(session.uid)
            .collection('notifications');

        if (body.all === true) {
            // Marcar todas las unread como read
            const unreadSnap = await ref.where('read', '==', false).limit(500).get();
            const batch = db.batch();
            unreadSnap.docs.forEach((d) => batch.update(d.ref, { read: true }));
            await batch.commit();
            return jsonResponse(200, { success: true, updated: unreadSnap.size });
        }

        if (Array.isArray(body.ids) && body.ids.length > 0) {
            const batch = db.batch();
            for (const id of body.ids.slice(0, 100)) {
                if (typeof id !== 'string' || !id.trim()) continue;
                batch.update(ref.doc(id), { read: true });
            }
            await batch.commit();
            return jsonResponse(200, { success: true, updated: body.ids.length });
        }

        return jsonResponse(400, { error: 'Body debe incluir { ids } o { all: true }' });
    } catch (error) {
        console.error('[notifications.POST] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};
