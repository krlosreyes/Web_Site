/**
 * DELETE /api/admin/forum/delete?type=topic&topic=ID
 * DELETE /api/admin/forum/delete?type=reply&topic=ID&reply=RID
 *
 * Force soft-delete por admin (cookie auth). Bypasa la validación de
 * authorUid del endpoint propio.
 */

import type { APIRoute } from 'astro';
import { db } from '../../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../../lib/constants/firestore';
import {
    isAuthenticatedFromCookie,
    parseCookies,
    enforceProductionSecurity,
} from '../../../../lib/auth';
import { logAdminAction } from '../../../../lib/auditLog';

export const prerender = false;

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export const DELETE: APIRoute = async ({ url, request }) => {
    enforceProductionSecurity();
    const cookies = parseCookies(request);
    if (!isAuthenticatedFromCookie(cookies)) {
        return jsonResponse(401, { error: 'Unauthorized' });
    }

    const type = url.searchParams.get('type');
    const topicId = url.searchParams.get('topic');
    const replyId = url.searchParams.get('reply');

    if (!topicId) return jsonResponse(400, { error: 'topic id requerido' });
    if (type !== 'topic' && type !== 'reply') {
        return jsonResponse(400, { error: 'type debe ser topic o reply' });
    }
    if (type === 'reply' && !replyId) {
        return jsonResponse(400, { error: 'reply id requerido' });
    }

    try {
        const topicRef = db.collection(COLLECTIONS.FORUM_TOPICS).doc(topicId);

        if (type === 'topic') {
            const snap = await topicRef.get();
            if (!snap.exists) return jsonResponse(404, { error: 'Topic no encontrado' });
            await topicRef.update({
                status: 'deleted',
                updatedAt: new Date().toISOString(),
            });
            await logAdminAction({
                action: 'admin_delete_forum_topic',
                resource: 'forum_topic',
                resourceId: topicId,
                changes: {
                    status: { before: snap.data()?.status || 'active', after: 'deleted' },
                    title: { before: snap.data()?.title || null, after: null },
                },
                request,
            });
        } else {
            const replyRef = topicRef.collection('replies').doc(replyId!);
            const snap = await replyRef.get();
            if (!snap.exists) return jsonResponse(404, { error: 'Reply no encontrada' });
            await replyRef.update({ status: 'deleted' });
            await logAdminAction({
                action: 'admin_delete_forum_reply',
                resource: 'forum_reply',
                resourceId: `${topicId}/${replyId}`,
                changes: {
                    status: { before: snap.data()?.status || 'active', after: 'deleted' },
                },
                request,
            });
        }

        return jsonResponse(200, { success: true });
    } catch (error) {
        console.error('[admin.forum.delete] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};
