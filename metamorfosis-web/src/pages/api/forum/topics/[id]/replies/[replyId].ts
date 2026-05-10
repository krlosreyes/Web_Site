/**
 * DELETE /api/forum/topics/[id]/replies/[replyId] — soft delete propio.
 *
 * Sin decrement de replyCount: preserva el contador histórico (igual que
 * Twitter/Reddit muestran "5 replies" aunque haya 1 borrado). Si en el
 * futuro se quiere strict counters, agregar decrement acá en transaction.
 */

import type { APIRoute } from 'astro';
import { db, auth } from '../../../../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../../../../lib/constants/firestore';
import { logAdminAction } from '../../../../../../lib/auditLog';

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

export const DELETE: APIRoute = async ({ params, request }) => {
    const topicId = params.id;
    const replyId = params.replyId;
    if (!topicId || !replyId) return jsonResponse(400, { error: 'ids requeridos' });

    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    try {
        const replyRef = db
            .collection(COLLECTIONS.FORUM_TOPICS)
            .doc(topicId)
            .collection('replies')
            .doc(replyId);
        const snap = await replyRef.get();
        if (!snap.exists) return jsonResponse(404, { error: 'Reply no encontrada' });

        const data = snap.data();
        if (data?.authorUid !== session.uid) {
            return jsonResponse(403, { error: 'Solo el autor puede borrar' });
        }

        await replyRef.update({ status: 'deleted' });

        await logAdminAction({
            action: 'delete_forum_reply',
            resource: 'forum_reply',
            resourceId: `${topicId}/${replyId}`,
            changes: { status: { before: 'active', after: 'deleted' } },
            request,
        });

        return jsonResponse(200, { success: true });
    } catch (error) {
        console.error('[forum.replies.DELETE] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};
