/**
 * POST /api/admin/forum/recategorize — re-categoriza un topic existente.
 *
 * Body: { topicId, category }
 * Auth: cookie admin.
 *
 * SPEC-046: para que Carlos migre topics legacy con category vieja
 * (`bio`, `longevity`, `mind`) a los pilares oficiales.
 */

import type { APIRoute } from 'astro';
import { db } from '../../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../../lib/constants/firestore';
import { isValidForumCategory } from '../../../../lib/constants/pillars';
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

    let body: { topicId?: string; category?: string };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }
    if (!body.topicId) return jsonResponse(400, { error: 'topicId requerido' });
    if (!body.category || !isValidForumCategory(body.category)) {
        return jsonResponse(400, { error: 'Categoría inválida' });
    }

    try {
        const topicRef = db.collection(COLLECTIONS.FORUM_TOPICS).doc(body.topicId);
        const snap = await topicRef.get();
        if (!snap.exists) return jsonResponse(404, { error: 'Topic no encontrado' });
        const previousCategory = snap.data()?.category ?? null;

        await topicRef.update({
            category: body.category,
            tags: [body.category],
            updatedAt: new Date().toISOString(),
        });

        await logAdminAction({
            action: 'pin_forum_topic', // reusamos action existente; el changes detalla qué cambió
            resource: 'forum_topic',
            resourceId: body.topicId,
            changes: {
                category: { before: previousCategory, after: body.category },
            },
            request,
        });

        return jsonResponse(200, { success: true });
    } catch (error) {
        console.error('[admin.forum.recategorize] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};
