/**
 * POST /api/forum/topics/[id]/replies — crea reply (auth ID token).
 *
 * Transaction atómica: agrega doc en subcolección + incrementa replyCount
 * en el doc del topic.
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

async function authFromRequest(request: Request): Promise<{ uid: string; name: string | null } | null> {
    const authHeader = request.headers.get('authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) return null;
    try {
        const decoded = await auth.verifyIdToken(idToken);
        return { uid: decoded.uid, name: decoded.name ?? null };
    } catch {
        return null;
    }
}

function avatarColorIdx(uid: string): number {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
    return Math.abs(h) % 8;
}

export const POST: APIRoute = async ({ params, request }) => {
    const topicId = params.id;
    if (!topicId) return jsonResponse(400, { error: 'topic id requerido' });

    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    let body: { content?: string };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }

    const content = String(body.content || '').trim().slice(0, 2000);
    if (content.length < 2) return jsonResponse(400, { error: 'Reply muy corta' });

    const authorName = session.name?.trim() || 'Biohacker';
    const initial = authorName.charAt(0).toUpperCase();
    const colorIdx = avatarColorIdx(session.uid);
    const now = new Date().toISOString();

    try {
        const topicRef = db.collection(COLLECTIONS.FORUM_TOPICS).doc(topicId);
        const replyRef = topicRef.collection('replies').doc();

        let replyId = '';
        await db.runTransaction(async (tx) => {
            const topicSnap = await tx.get(topicRef);
            if (!topicSnap.exists) throw new Error('Topic no existe');
            const data = topicSnap.data();
            if (data?.status === 'deleted') throw new Error('Topic eliminado');

            const currentCount = Number(data?.replyCount || 0);

            tx.set(replyRef, {
                content,
                authorUid: session.uid,
                authorName,
                authorInitial: initial,
                authorColorIdx: colorIdx,
                status: 'active',
                createdAt: now,
            });
            tx.update(topicRef, {
                replyCount: currentCount + 1,
                updatedAt: now,
            });
            replyId = replyRef.id;
        });

        await logAdminAction({
            action: 'create_forum_reply',
            resource: 'forum_reply',
            resourceId: `${topicId}/${replyId}`,
            changes: {
                contentLength: { before: 0, after: content.length },
                authorUid: { before: null, after: session.uid },
            },
            request,
        });

        return jsonResponse(201, { success: true, id: replyId });
    } catch (error: any) {
        console.error('[forum.replies.POST] Error:', error);
        const msg = error?.message?.includes('Topic') ? error.message : 'Error creando reply';
        return jsonResponse(500, { error: msg });
    }
};
