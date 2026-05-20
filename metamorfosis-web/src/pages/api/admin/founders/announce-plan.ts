/**
 * POST /api/admin/founders/announce-plan — SPEC-104.
 *
 * Envía el email "Tu Plan IMR de 14 días está listo" a TODOS los
 * fundadores que aún no lo recibieron. Idempotente: si un fundador
 * ya tiene `founder.planAnnouncementSentAt`, se omite.
 *
 * Flujo por fundador pendiente:
 *   1. Resend.send vía sendFounderPlanAnnouncementEmail.
 *   2. Si éxito: actualiza users/{uid}.founder.planAnnouncementSentAt = nowIso.
 *   3. Si fallo: lo registra en failures[] y continúa con el siguiente.
 *   4. Audit log por user enviado.
 *
 * NO usa transaction porque cada envío es independiente — un fallo en
 * el N-ésimo no debe revertir los anteriores. La idempotencia la
 * garantiza el campo `planAnnouncementSentAt` (si quedó sin set, el
 * próximo run reintenta).
 *
 * Auth: cookie admin (igual que el resto de /api/admin/*).
 */

import type { APIRoute } from 'astro';
import { db } from '../../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../../lib/constants/firestore';
import { sendFounderPlanAnnouncementEmail } from '../../../../lib/email';
import { logAdminAction } from '../../../../lib/auditLog';
import {
    isAuthenticatedFromCookie,
    parseCookies,
    enforceProductionSecurity,
} from '../../../../lib/auth';

export const prerender = false;

interface AnnouncePlanFailure {
    uid: string;
    email: string;
    error: string;
}

interface AnnouncePlanResponse {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    failures: AnnouncePlanFailure[];
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0',
        },
    });
}

function authGate(request: Request): Response | null {
    enforceProductionSecurity();
    const cookies = parseCookies(request);
    if (!isAuthenticatedFromCookie(cookies)) {
        return jsonResponse(401, { error: 'Unauthorized' });
    }
    return null;
}

export const POST: APIRoute = async ({ request }) => {
    const guard = authGate(request);
    if (guard) return guard;

    try {
        // 1. Traer todos los founders activos.
        const snap = await db
            .collection(COLLECTIONS.USERS)
            .where('founder.isFounder', '==', true)
            .get();

        const allFounders = snap.docs.map((doc) => {
            const data = doc.data();
            return {
                uid: doc.id,
                email: (data.email as string | undefined) ?? '',
                displayName: (data.displayName as string | undefined) ?? null,
                planAnnouncementSentAt:
                    (data.founder?.planAnnouncementSentAt as string | null | undefined) ?? null,
            };
        });

        // 2. Filtrar los que NO tienen el email enviado.
        const pending = allFounders.filter(
            (f) => !f.planAnnouncementSentAt && f.email,
        );

        const failures: AnnouncePlanFailure[] = [];
        let sent = 0;

        // 3. Procesar secuencialmente. Bulk de 6-1000 emails en serie es trivial
        //    para Resend y mantiene el audit log ordenado.
        for (const founder of pending) {
            try {
                const result = await sendFounderPlanAnnouncementEmail({
                    to: founder.email,
                    name: founder.displayName,
                });

                // Si el sandbox dev no tiene RESEND_API_KEY, sendEmail retorna
                // { skipped: true }. En ese caso NO marcamos como enviado,
                // así un re-run en prod sí los procesa.
                if (result.skipped) {
                    failures.push({
                        uid: founder.uid,
                        email: founder.email,
                        error: 'RESEND_API_KEY no configurada en runtime — envío saltado',
                    });
                    continue;
                }

                // Marcar como enviado en Firestore.
                const nowIso = new Date().toISOString();
                await db
                    .collection(COLLECTIONS.USERS)
                    .doc(founder.uid)
                    .update({
                        'founder.planAnnouncementSentAt': nowIso,
                    });

                // Audit log (best-effort — si falla, no rompemos el flujo).
                await logAdminAction({
                    action: 'announce_plan_to_founder',
                    resource: 'user',
                    resourceId: founder.uid,
                    changes: {
                        'founder.planAnnouncementSentAt': {
                            before: null,
                            after: nowIso,
                        },
                    },
                    request,
                });

                sent++;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(
                    `[announce-plan] Falló envío a ${founder.email} (${founder.uid}):`,
                    msg,
                );
                failures.push({
                    uid: founder.uid,
                    email: founder.email,
                    error: msg.slice(0, 240),
                });
            }
        }

        const response: AnnouncePlanResponse = {
            total: allFounders.length,
            pending: pending.length,
            sent,
            failed: failures.length,
            failures,
        };
        return jsonResponse(200, response);
    } catch (error) {
        console.error('[announce-plan.POST] Error fatal:', error);
        const msg = error instanceof Error ? error.message : 'Error procesando anuncios';
        return jsonResponse(500, { error: msg });
    }
};
