/**
 * POST /api/admin/diagnose-click — smoke test del pipeline de clicks (SPEC-092).
 *
 * Permite a Carlos validar end-to-end que el flujo de tracking de
 * clicks funciona en producción, sin tener que abrir DevTools manual.
 *
 * Flow:
 *   1. Verifica admin cookie.
 *   2. Lee `analytics.clicks` actual.
 *   3. Hace fetch interno al endpoint público `/api/posts/{slug}/click`
 *      sin propagar cookies (para que NO se filtre por self-exclusion).
 *   4. Lee `analytics.clicks` nuevo.
 *   5. Restaura el counter con FieldValue.increment(-diff) para que
 *      el test sea idempotente.
 *   6. Reporta status OK/FAIL.
 *
 * Uso:
 *   curl -X POST 'https://metamorfosisvital.com.co/api/admin/diagnose-click' \
 *     -H 'Content-Type: application/json' \
 *     -H 'Cookie: admin_session=...' \
 *     -d '{"slug":"mi-slug"}'
 */

import type { APIRoute } from 'astro';
import { db, FieldValue } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import {
    isAuthenticatedFromCookie,
    parseCookies,
    enforceProductionSecurity,
} from '../../../lib/auth';

export const prerender = false;

interface DiagnoseResponse {
    slug: string;
    before: number;
    after: number;
    diff: number;
    status: 'OK' | 'FAIL';
    publicEndpointStatus: number;
    message: string;
    /** Cuando hubo concurrencia real, no restauramos para no dañar al user. */
    restored: boolean;
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body, null, 2), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export const POST: APIRoute = async ({ request, url }) => {
    try {
        enforceProductionSecurity();

        const cookies = parseCookies(request);
        if (!isAuthenticatedFromCookie(cookies)) {
            return jsonResponse(401, { error: 'Unauthorized' });
        }

        let body: { slug?: string };
        try {
            body = await request.json();
        } catch {
            return jsonResponse(400, { error: 'Body JSON inválido' });
        }
        const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
        if (!slug) {
            return jsonResponse(400, { error: 'Falta `slug` en el body' });
        }

        // Localizar el doc del post por slug.
        const snap = await db
            .collection(COLLECTIONS.POSTS)
            .where('slug', '==', slug)
            .limit(1)
            .get();
        if (snap.empty) {
            return jsonResponse(404, { error: `No existe post con slug '${slug}'` });
        }
        const postDoc = snap.docs[0];
        const docRef = postDoc.ref;

        const readClicks = async (): Promise<number> => {
            const fresh = await docRef.get();
            const data = fresh.data() as { analytics?: { clicks?: number } } | undefined;
            return typeof data?.analytics?.clicks === 'number'
                ? data.analytics.clicks
                : 0;
        };

        const before = await readClicks();

        // Fetch interno al endpoint público. Importante: SIN cookies.
        // Node 18+ fetch nativo no propaga cookies por default.
        const publicUrl = `${url.origin}/api/posts/${encodeURIComponent(slug)}/click`;
        let publicEndpointStatus = 0;
        try {
            const res = await fetch(publicUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            });
            publicEndpointStatus = res.status;
        } catch (fetchErr) {
            return jsonResponse(500, {
                error: 'Fetch al endpoint público falló',
                detail: String(fetchErr),
            });
        }

        // Pequeño delay para que Firestore propague el write.
        await new Promise((r) => setTimeout(r, 500));

        const after = await readClicks();
        const diff = after - before;

        let restored = false;
        let status: 'OK' | 'FAIL';
        let message: string;

        if (diff === 1) {
            // Pipeline funciona. Restauramos al estado original para
            // mantener idempotencia.
            try {
                await docRef.set(
                    { analytics: { clicks: FieldValue.increment(-1) } },
                    { merge: true },
                );
                restored = true;
            } catch (restoreErr) {
                console.error('[diagnose-click] restore failed:', restoreErr);
            }
            status = 'OK';
            message = 'Pipeline funciona correctamente. Counter restaurado.';
        } else if (diff === 0) {
            status = 'FAIL';
            message =
                'El endpoint público respondió pero el counter no se incrementó. ' +
                'Revisar lib/postAnalytics.incrementClick y permisos Firestore.';
        } else if (diff > 1) {
            // Concurrencia real: otro visitante clickeó durante el test.
            // No restauramos para no dañar la métrica del usuario real.
            status = 'OK';
            message = `Diff fue ${diff} (esperado 1). Hubo otro visitante real durante el test; no restauramos para preservar su click.`;
        } else {
            // diff < 0 — caso patológico
            status = 'FAIL';
            message = `Diff fue ${diff} (esperado 1 o ≥1). Caso patológico.`;
        }

        const response: DiagnoseResponse = {
            slug,
            before,
            after,
            diff,
            status,
            publicEndpointStatus,
            message,
            restored,
        };
        return jsonResponse(200, response);
    } catch (err) {
        console.error('[diagnose-click] error:', err);
        return jsonResponse(500, { error: 'Error interno', detail: String(err) });
    }
};
