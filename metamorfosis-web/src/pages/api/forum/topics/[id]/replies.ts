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
import { getDisplayName } from '../../../../../lib/userHelpers';

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

    let body: { content?: string; parentReplyId?: string | null };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }

    const content = String(body.content || '').trim().slice(0, 2000);
    if (content.length < 2) return jsonResponse(400, { error: 'Reply muy corta' });

    // SPEC-036: helper con fallback a users/{uid}.displayName para cuentas nuevas
    const authorName = await getDisplayName(session.uid, session.name);
    const initial = authorName.charAt(0).toUpperCase();
    const colorIdx = avatarColorIdx(session.uid);
    const now = new Date().toISOString();

    // SPEC-038: replies anidadas. Si viene parentReplyId, validamos lookup +
    // status + pertenencia al mismo topic. depth se calcula con cap en 2
    // (3 niveles totales: 0, 1, 2) para mantener legibilidad mobile.
    const rawParent = body.parentReplyId;
    const parentReplyId: string | null =
        typeof rawParent === 'string' && rawParent.trim() ? rawParent.trim() : null;

    try {
        const topicRef = db.collection(COLLECTIONS.FORUM_TOPICS).doc(topicId);
        const replyRef = topicRef.collection('replies').doc();

        // SPEC-038: si hay parentReplyId, lookup + cálculo de depth.
        let depth = 0;
        if (parentReplyId) {
            const parentSnap = await topicRef.collection('replies').doc(parentReplyId).get();
            if (!parentSnap.exists) {
                return jsonResponse(404, { error: 'Reply padre no encontrada' });
            }
            const parentData = parentSnap.data();
            if (parentData?.status === 'deleted') {
                return jsonResponse(400, { error: 'No se puede responder a una reply eliminada' });
            }
            // SPEC-039: cap a 1 (estilo Instagram). Si respondés a una reply
            // (nivel 1), tu reply queda al mismo nivel 1. parentReplyId se
            // mantiene apuntando al reply real para que el frontend pueda
            // mostrar `@autor` y conservar el lineage de la conversación.
            depth = Math.min(1, Number(parentData?.depth ?? 0) + 1);
        }

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
                // SPEC-038: campos para árbol de replies anidados
                parentReplyId: parentReplyId,
                depth,
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
