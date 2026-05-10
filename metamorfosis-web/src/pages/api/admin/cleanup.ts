import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import {
    isAuthenticatedFromCookie,
    parseCookies,
    enforceProductionSecurity,
} from '../../../lib/auth';
import { logAdminAction } from '../../../lib/auditLog';

export const prerender = false;

/**
 * POST /api/admin/cleanup
 * Borra documentos corruptos de `metamorfosis_posts` (slug.length > 200).
 * Requiere sesión admin válida; rechaza con 401 en otro caso.
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        enforceProductionSecurity();

        const cookies = parseCookies(request);
        if (!isAuthenticatedFromCookie(cookies)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const postsRef = db.collection(COLLECTIONS.POSTS);
        const snapshot = await postsRef.get();

        let deletedCount = 0;
        const batch = db.batch();
        for (const doc of snapshot.docs) {
            const data = doc.data();
            // Heurística: artículos corruptos por slug exageradamente largo
            if (data.slug && data.slug.length > 200) {
                batch.delete(doc.ref);
                deletedCount++;
            }
        }
        if (deletedCount > 0) await batch.commit();

        // SPEC-018: log de auditoría
        await logAdminAction({
            action: 'cleanup',
            resource: 'system',
            resourceId: null,
            changes: { deletedCount: { before: 0, after: deletedCount } },
            request,
        });

        return new Response(JSON.stringify({ success: true, deletedCount }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('[cleanup] Error:', error);
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
