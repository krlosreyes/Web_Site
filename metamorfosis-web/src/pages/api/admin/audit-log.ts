/**
 * GET /api/admin/audit-log?limit=100&action=update_lead
 *
 * Devuelve los últimos N entries del audit log (SPEC-018), ordenados por
 * performedAt desc. Filtros opcionales por action.
 */

import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import {
    isAuthenticatedFromCookie,
    parseCookies,
    enforceProductionSecurity,
} from '../../../lib/auth';

export const prerender = false;

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export const GET: APIRoute = async ({ request, url }) => {
    enforceProductionSecurity();
    const cookies = parseCookies(request);
    if (!isAuthenticatedFromCookie(cookies)) {
        return jsonResponse(401, { error: 'Unauthorized' });
    }

    const limitParam = parseInt(url.searchParams.get('limit') || '100', 10);
    const limit = Math.max(1, Math.min(500, isNaN(limitParam) ? 100 : limitParam));
    const actionFilter = url.searchParams.get('action');

    try {
        let query = db
            .collection(COLLECTIONS.ADMIN_AUDIT_LOG)
            .orderBy('performedAt', 'desc')
            .limit(limit) as FirebaseFirestore.Query;

        if (actionFilter) {
            query = query.where('action', '==', actionFilter);
        }

        const snapshot = await query.get();
        const entries = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return jsonResponse(200, { success: true, entries, limit });
    } catch (error) {
        console.error('[audit-log.GET] Error:', error);
        return jsonResponse(500, { error: 'Error interno del servidor' });
    }
};
