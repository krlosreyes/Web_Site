/**
 * POST /api/forum/topics/[id]/save — guardar/quitar bookmark del user (SPEC-042).
 * GET  /api/forum/topics/[id]/save — devuelve { saved: boolean } del user actual.
 *
 * Body POST: { saved: boolean }
 * Auth: Firebase ID token.
 *
 * Escribe en `users/{uid}/savedTopics/{topicId}` con metadata cached del topic
 * (title, category) para que el listing en el dashboard sea O(N) sin joins.
 */

import type { APIRoute } from 'astro';
import { db, auth } from '../../../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../../../lib/constants/firestore';
import { logAdminAction } from '../../../../../lib/auditLog';

export const prerender = false;

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function authFromRequest(request: Request): Promise<{ uid: string } | null> {
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

export const GET: APIRoute = async ({ params, request }) => {
    const topicId = params.id;
    if (!topicId) return jsonResponse(400, { error: 'topic id requerido' });

    const session = await authFromRequest(request);
    if (!session) return jsonResponse(200, { success: true, saved: false });

    try {
        const snap = await db
            .collection(COLLECTIONS.USERS)
            .doc(session.uid)
            .collection('savedTopics')
            .doc(topicId)
            .get();
        return jsonResponse(200, { success: true, saved: snap.exists });
    } catch (error) {
        console.error('[forum.save.GET] Error:', error);
        return jsonResponse(200, { success: true, saved: false });
    }
};

export const POST: APIRoute = async ({ params, request }) => {
    const topicId = params.id;
    if (!topicId) return jsonResponse(400, { error: 'topic id requerido' });

    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    let body: { saved?: boolean };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }
    const wantSaved = body.saved === true;

    try {
        const topicRef = db.collection(COLLECTIONS.FORUM_TOPICS).doc(topicId);
        const topicSnap = await topicRef.get();
        if (!topicSnap.exists) return jsonResponse(404, { error: 'Topic no encontrado' });
        const tdata = topicSnap.data();
        if (tdata?.status === 'deleted') return jsonResponse(404, { error: 'Topic eliminado' });

        const saveRef = db
            .collection(COLLECTIONS.USERS)
            .doc(session.uid)
            .collection('savedTopics')
            .doc(topicId);

        if (wantSaved) {
            await saveRef.set({
                savedAt: new Date().toISOString(),
                // Metadata cached para listing rápido del dashboard
                topicTitle: String(tdata?.title || '').slice(0, 200),
                topicCategory: String(tdata?.category || 'general'),
            });
        } else {
            await saveRef.delete();
        }

        await logAdminAction({
            action: 'save_forum_topic',
            resource: 'forum_topic',
            resourceId: topicId,
            changes: {
                saved: { before: !wantSaved, after: wantSaved },
                uid: { before: null, after: session.uid },
            },
            request,
        });

        return jsonResponse(200, { success: true, saved: wantSaved });
    } catch (error) {
        console.error('[forum.save.POST] Error:', error);
        return jsonResponse(500, { error: 'Error procesando guardado' });
    }
};
