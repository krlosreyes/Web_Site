/**
 * POST /api/forum/topics/[id]/like — toggle like del user (auth ID token).
 *
 * Body: { liked: boolean }
 * Idempotente: enviar `liked: true` cuando ya está liked es no-op.
 * Transaction atómica: like doc + likeCount sincronizados.
 *
 * Devuelve { likeCount, liked } actualizados.
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

export const POST: APIRoute = async ({ params, request }) => {
    const topicId = params.id;
    if (!topicId) return jsonResponse(400, { error: 'topic id requerido' });

    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    let body: { liked?: boolean };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }
    const wantLiked = body.liked === true;

    const topicRef = db.collection(COLLECTIONS.FORUM_TOPICS).doc(topicId);
    const likeRef = topicRef.collection('likes').doc(session.uid);

    let resultCount = 0;
    let prevLiked = false;
    try {
        await db.runTransaction(async (tx) => {
            const [topicSnap, likeSnap] = await Promise.all([tx.get(topicRef), tx.get(likeRef)]);
            if (!topicSnap.exists) throw new Error('Topic no existe');
            const data = topicSnap.data();
            if (data?.status === 'deleted') throw new Error('Topic eliminado');

            prevLiked = likeSnap.exists;
            let count = Math.max(0, Number(data?.likeCount || 0));

            if (wantLiked && !prevLiked) {
                tx.set(likeRef, { createdAt: new Date().toISOString() });
                count += 1;
            } else if (!wantLiked && prevLiked) {
                tx.delete(likeRef);
                count -= 1;
            }
            count = Math.max(0, count);
            tx.update(topicRef, { likeCount: count });
            resultCount = count;
        });
    } catch (error: any) {
        console.error('[forum.like.POST] Error:', error);
        const msg = error?.message?.includes('Topic') ? error.message : 'Error procesando like';
        return jsonResponse(500, { error: msg });
    }

    if (prevLiked !== wantLiked) {
        await logAdminAction({
            action: 'like_forum_topic',
            resource: 'forum_topic',
            resourceId: topicId,
            changes: {
                liked: { before: prevLiked, after: wantLiked },
                uid: { before: null, after: session.uid },
            },
            request,
        });
    }

    return jsonResponse(200, { success: true, liked: wantLiked, likeCount: resultCount });
};

/** GET para que el cliente sepa si el user actual likeó el topic. */
export const GET: APIRoute = async ({ params, request }) => {
    const topicId = params.id;
    if (!topicId) return jsonResponse(400, { error: 'topic id requerido' });
    const session = await authFromRequest(request);
    if (!session) return jsonResponse(200, { success: true, liked: false });

    try {
        const likeSnap = await db
            .collection(COLLECTIONS.FORUM_TOPICS)
            .doc(topicId)
            .collection('likes')
            .doc(session.uid)
            .get();
        return jsonResponse(200, { success: true, liked: likeSnap.exists });
    } catch (error) {
        console.error('[forum.like.GET] Error:', error);
        return jsonResponse(200, { success: true, liked: false });
    }
};
