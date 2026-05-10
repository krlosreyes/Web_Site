/**
 * GET    /api/forum/topics/[id]  — detalle de topic + replies activos. Incrementa views.
 * DELETE /api/forum/topics/[id]  — soft delete propio (auth ID token, valida authorUid).
 *
 * SPEC-036: este archivo reemplaza al viejo `[id]/index.ts`. Astro 6 + Node
 * adapter prioriza `[id].ts` sobre `[id]/index.ts` cuando la URL no tiene
 * trailing slash, lo que rompía el DELETE silenciosamente. El directorio
 * `[id]/` sigue vivo para `[id]/replies.ts`, `[id]/like.ts`, etc.
 *
 * Carlos debe `git rm` el archivo viejo `[id]/index.ts` para evitar
 * coexistencia confusa.
 */

import type { APIRoute } from 'astro';
import { db, auth, FieldValue } from '../../../../lib/firebaseAdmin';
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

export const GET: APIRoute = async ({ params }) => {
    const id = params.id;
    if (!id) return jsonResponse(400, { error: 'id requerido' });

    try {
        const topicRef = db.collection(COLLECTIONS.FORUM_TOPICS).doc(id);
        const snap = await topicRef.get();
        if (!snap.exists) return jsonResponse(404, { error: 'Topic no encontrado' });
        const data = snap.data();
        if (data?.status === 'deleted') {
            return jsonResponse(404, { error: 'Topic eliminado' });
        }

        // Increment views (best-effort, no bloquea respuesta)
        topicRef.update({ views: FieldValue.increment(1) }).catch((e) =>
            console.error('[forum.topics.GET] views increment:', e)
        );

        // Replies activos
        const repliesSnap = await topicRef
            .collection('replies')
            .orderBy('createdAt', 'asc')
            .limit(200)
            .get();
        const replies = repliesSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
            .filter((r) => (r as { status?: string }).status !== 'deleted');

        return jsonResponse(200, {
            success: true,
            topic: { id: snap.id, ...data },
            replies,
        });
    } catch (error) {
        console.error('[forum.topics.GET] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};

export const DELETE: APIRoute = async ({ params, request }) => {
    const id = params.id;
    if (!id) return jsonResponse(400, { error: 'id requerido' });

    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    try {
        const topicRef = db.collection(COLLECTIONS.FORUM_TOPICS).doc(id);
        const snap = await topicRef.get();
        if (!snap.exists) return jsonResponse(404, { error: 'Topic no encontrado' });

        const data = snap.data();
        if (data?.authorUid !== session.uid) {
            return jsonResponse(403, { error: 'Solo el autor puede borrar' });
        }

        await topicRef.update({
            status: 'deleted',
            updatedAt: new Date().toISOString(),
        });

        await logAdminAction({
            action: 'delete_forum_topic',
            resource: 'forum_topic',
            resourceId: id,
            changes: {
                status: { before: 'active', after: 'deleted' },
                authorUid: { before: session.uid, after: session.uid },
            },
            request,
        });

        return jsonResponse(200, { success: true });
    } catch (error) {
        console.error('[forum.topics.DELETE] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};
