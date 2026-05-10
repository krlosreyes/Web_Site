/**
 * POST /api/forum/replies/like — toggle like de una reply (auth ID token).
 * GET  /api/forum/replies/like?topicId=X&replyId=Y — estado del like del user.
 *
 * Body POST: { topicId, replyId, liked: boolean }
 *
 * SPEC-036: ruta plana en lugar de `topics/[id]/replies/[replyId]/like.ts`
 * para evitar el conflicto de routing de Astro 6 con archivos vs directorios
 * homónimos (mismo gotcha del Bug 2 de SPEC-036).
 */

import type { APIRoute } from 'astro';
import { db, auth } from '../../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../../lib/constants/firestore';
import { logAdminAction } from '../../../../lib/auditLog';

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

export const GET: APIRoute = async ({ url, request }) => {
    const topicId = url.searchParams.get('topicId');
    const replyId = url.searchParams.get('replyId');
    if (!topicId || !replyId) return jsonResponse(400, { error: 'topicId y replyId requeridos' });

    const session = await authFromRequest(request);
    if (!session) return jsonResponse(200, { success: true, liked: false });

    try {
        const likeSnap = await db
            .collection(COLLECTIONS.FORUM_TOPICS)
            .doc(topicId)
            .collection('replies')
            .doc(replyId)
            .collection('likes')
            .doc(session.uid)
            .get();
        return jsonResponse(200, { success: true, liked: likeSnap.exists });
    } catch (error) {
        console.error('[forum.replies.like.GET] Error:', error);
        return jsonResponse(200, { success: true, liked: false });
    }
};

export const POST: APIRoute = async ({ request }) => {
    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    let body: { topicId?: string; replyId?: string; liked?: boolean };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }
    if (!body.topicId || !body.replyId) {
        return jsonResponse(400, { error: 'topicId y replyId requeridos' });
    }
    const wantLiked = body.liked === true;

    const replyRef = db
        .collection(COLLECTIONS.FORUM_TOPICS)
        .doc(body.topicId)
        .collection('replies')
        .doc(body.replyId);
    const likeRef = replyRef.collection('likes').doc(session.uid);

    let resultCount = 0;
    let prevLiked = false;
    try {
        await db.runTransaction(async (tx) => {
            const [replySnap, likeSnap] = await Promise.all([tx.get(replyRef), tx.get(likeRef)]);
            if (!replySnap.exists) throw new Error('Reply no existe');
            const data = replySnap.data();
            if (data?.status === 'deleted') throw new Error('Reply eliminada');

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
            tx.update(replyRef, { likeCount: count });
            resultCount = count;
        });
    } catch (error: any) {
        console.error('[forum.replies.like.POST] Error:', error);
        const msg = error?.message?.includes('Reply') ? error.message : 'Error procesando like';
        return jsonResponse(500, { error: msg });
    }

    if (prevLiked !== wantLiked) {
        await logAdminAction({
            action: 'like_forum_topic', // reusamos el action; resourceId distingue topic vs reply
            resource: 'forum_reply',
            resourceId: `${body.topicId}/${body.replyId}`,
            changes: {
                liked: { before: prevLiked, after: wantLiked },
                uid: { before: null, after: session.uid },
            },
            request,
        });
    }

    return jsonResponse(200, { success: true, liked: wantLiked, likeCount: resultCount });
};
