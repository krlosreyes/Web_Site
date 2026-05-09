import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import {
    isAuthenticatedFromCookie,
    parseCookies,
    enforceProductionSecurity,
} from '../../../lib/auth';

export const prerender = false;

/**
 * Status pipeline de un lead (SPEC-016):
 *   new        — capturado, sin contacto aún (default para nuevos)
 *   contacted  — admin se comunicó (email, llamada, etc.)
 *   qualified  — interesado real, alto fit con producto
 *   converted  — usuario activo en ElenaApp / lista de espera invitada
 *   archived   — descartado, no convirtió, fuera del pipeline
 */
const VALID_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'archived'] as const;
type LeadStatus = (typeof VALID_STATUSES)[number];

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
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

/**
 * Normaliza un timestamp de Firestore (Timestamp, string ISO o seconds-based)
 * a un string ISO consistente. Devuelve null si no se puede determinar.
 */
function normalizeTimestamp(raw: unknown): string | null {
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null) {
        // Firestore Timestamp tiene .toDate()
        const ts = raw as { toDate?: () => Date; _seconds?: number };
        if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
        if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000).toISOString();
    }
    return null;
}

export const GET: APIRoute = async ({ request }) => {
    const denied = authGate(request);
    if (denied) return denied;

    try {
        const leadsRef = db.collection(COLLECTIONS.WAITLIST_LEADS);
        const snapshot = await leadsRef.orderBy('created_at', 'desc').limit(200).get();

        const leads = snapshot.docs.map((doc) => {
            const data = doc.data();
            const createdAtIso = normalizeTimestamp(data.created_at);
            const dateStr = createdAtIso
                ? new Date(createdAtIso).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                  })
                : 'Reciente';

            return {
                id: doc.id,
                name: data.name || 'Desconocido',
                email: data.email || 'N/A',
                imr_score: data.estimated_imr ?? 'N/A',
                quiz_type: data.quiz_type || 'N/A',
                dateCompleted: dateStr,
                createdAtIso,
                // Campos CRM (SPEC-016) — pueden no existir en leads viejos
                status: (data.status as LeadStatus) || 'new',
                notes: typeof data.notes === 'string' ? data.notes : '',
                tags: Array.isArray(data.tags) ? data.tags : [],
                contactedAt: normalizeTimestamp(data.contactedAt),
                lastUpdatedAt: normalizeTimestamp(data.lastUpdatedAt),
                // Información extra del quiz
                proxy_scores: data.proxy_scores ?? {},
            };
        });

        return jsonResponse(200, { success: true, leads });
    } catch (error) {
        console.error('[leads.GET] Error:', error);
        return jsonResponse(500, { error: 'Error interno del servidor' });
    }
};

/**
 * PUT /api/admin/leads
 * Body: { id: string, status?, notes?, tags? }
 *
 * Actualiza solo los campos enviados. Si `status` cambia de algo distinto a
 * 'contacted' a 'contacted' por primera vez, marca `contactedAt` con la fecha.
 * Siempre actualiza `lastUpdatedAt`.
 */
export const PUT: APIRoute = async ({ request }) => {
    const denied = authGate(request);
    if (denied) return denied;

    let body: {
        id?: string;
        status?: string;
        notes?: string;
        tags?: string[];
    };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }

    if (!body.id) {
        return jsonResponse(400, { error: 'id requerido' });
    }

    if (body.status && !VALID_STATUSES.includes(body.status as LeadStatus)) {
        return jsonResponse(400, {
            error: `status inválido. Permitidos: ${VALID_STATUSES.join(', ')}`,
        });
    }

    if (body.tags && !Array.isArray(body.tags)) {
        return jsonResponse(400, { error: 'tags debe ser array de strings' });
    }

    try {
        const docRef = db.collection(COLLECTIONS.WAITLIST_LEADS).doc(body.id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return jsonResponse(404, { error: 'Lead no encontrado' });
        }

        const now = new Date().toISOString();
        const update: Record<string, unknown> = { lastUpdatedAt: now };

        if (body.status !== undefined) {
            update.status = body.status;
            // Marcar contactedAt la primera vez que pasa a contacted
            if (body.status === 'contacted') {
                const existing = docSnap.data() as { contactedAt?: unknown };
                if (!normalizeTimestamp(existing.contactedAt)) {
                    update.contactedAt = now;
                }
            }
        }
        if (body.notes !== undefined) {
            update.notes = String(body.notes).slice(0, 5000); // límite razonable
        }
        if (body.tags !== undefined) {
            update.tags = body.tags
                .map((t) => String(t).trim())
                .filter((t) => t.length > 0)
                .slice(0, 20); // máx 20 tags por lead
        }

        await docRef.update(update);
        return jsonResponse(200, { success: true });
    } catch (error) {
        console.error('[leads.PUT] Error:', error);
        return jsonResponse(500, { error: 'Error interno del servidor' });
    }
};
