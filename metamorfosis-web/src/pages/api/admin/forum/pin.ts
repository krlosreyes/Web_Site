/**
 * POST /api/admin/forum/pin — destacar / quitar destaque de un topic (SPEC-041).
 *
 * Body: { topicId: string, pinned: boolean }
 * Auth: cookie admin.
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

export const POST: APIRoute = async ({ request }) => {
    enforceProductionSecurity();
    const cookies = parseCookies(request);
    if (!isAuthenticatedFromCookie(cookies)) {
        return jsonResponse(401, { error: 'Unauthorized' });
    }

    let body: { topicId?: string; pinned?: boolean };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }
    if (!body.topicId) return jsonResponse(400, { error: 'topicId requerido' });

    const pinned = body.pinned === true;

    try {
        const topicRef = db.collection(COLLECTIONS.FORUM_TOPICS).doc(body.topicId);
        const snap = await topicRef.get();
        if (!snap.exists) return jsonResponse(404, { error: 'Topic no encontrado' });

        await topicRef.update({
            pinned,
            pinnedAt: pinned ? new Date().toISOString() : null,
        });

        await logAdminAction({
            action: 'pin_forum_topic',
            resource: 'forum_topic',
            resourceId: body.topicId,
            changes: {
                pinned: { before: snap.data()?.pinned ?? false, after: pinned },
            },
            request,
        });

        return jsonResponse(200, { success: true, pinned });
    } catch (error) {
        console.error('[admin.forum.pin] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};
