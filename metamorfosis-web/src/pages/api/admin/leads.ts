import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import type { UserDoc } from '../../../lib/types/user';
import {
    isAuthenticatedFromCookie,
    parseCookies,
    enforceProductionSecurity,
} from '../../../lib/auth';
import { logAdminAction, diffOf } from '../../../lib/auditLog';

export const prerender = false;

/**
 * Status pipeline de un lead (SPEC-016 / SPEC-016b):
 *   new        — capturado, sin contacto aún (default para nuevos)
 *   contacted  — admin se comunicó (email, llamada, etc.)
 *   qualified  — interesado real, alto fit con producto
 *   converted  — usuario activo en ElenaApp / lista de espera invitada
 *   archived   — descartado, no convirtió, fuera del pipeline
 *
 * SPEC-016b: el CRM lee `users` (no `waitlist_leads`, que quedó legacy
 * post-SPEC-006). Los campos CRM viven en `users/{uid}.crm.*` para no
 * contaminar el schema canónico — ElenaApp ignora ese sub-objeto.
 */
const VALID_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'archived'] as const;
type LeadStatus = (typeof VALID_STATUSES)[number];

interface UserCrm {
    status?: LeadStatus;
    notes?: string;
    tags?: string[];
    contactedAt?: string | null;
    lastUpdatedAt?: string | null;
}

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

/**
 * Construye un objeto compacto con los proxy_scores derivados del UserDoc:
 * sirven al admin para tener contexto del lead sin abrir Firebase Console.
 */
function buildProxyScores(user: Partial<UserDoc>): Record<string, number | string | null> {
    const out: Record<string, number | string | null> = {};
    if (user.bio) {
        if (user.bio.heightCm != null) out.heightCm = user.bio.heightCm;
        if (user.bio.weightKg != null) out.weightKg = user.bio.weightKg;
        if (user.bio.waistCm != null) out.waistCm = user.bio.waistCm;
        if (user.bio.bodyFatPct != null) out.bodyFatPct = Number(user.bio.bodyFatPct.toFixed(1));
    }
    if (user.profile) {
        if (user.profile.age != null) out.age = user.profile.age;
        if (user.profile.gender) out.gender = user.profile.gender;
        if (user.profile.goals?.length) out.goals = user.profile.goals.join(', ');
        if (user.profile.pathologies?.length) out.pathologies = user.profile.pathologies.join(', ');
    }
    if (user.habits) {
        if (user.habits.fastingHours != null) out.fastingHours = user.habits.fastingHours;
        if (user.habits.sleepQuality != null) out.sleepQuality = Number(user.habits.sleepQuality.toFixed(2));
        if (user.habits.exerciseMinutesPerDay != null) {
            out.exerciseMinutesPerDay = user.habits.exerciseMinutesPerDay;
        }
    }
    if (user.imr?.current) {
        out.imc = Number(user.imr.current.imc.toFixed(1));
        out.ica = Number(user.imr.current.ica.toFixed(2));
        out.metabolicAge = user.imr.current.metabolicAge;
        out.label = user.imr.current.label;
    }
    if (user.waitlist?.status) out.waitlistStatus = user.waitlist.status;
    return out;
}

export const GET: APIRoute = async ({ request }) => {
    const denied = authGate(request);
    if (denied) return denied;

    try {
        // SPEC-016b: leemos `users` ordenado por createdAt desc, con tope alto
        // para no perder leads en cuentas con histórico considerable.
        const usersRef = db.collection(COLLECTIONS.USERS);
        // Algunos docs legacy podrían no tener `meta.createdAt`; usamos un
        // fallback in-memory si la query nativa devuelve menos de lo esperado.
        let snapshot;
        try {
            snapshot = await usersRef.orderBy('meta.createdAt', 'desc').limit(500).get();
        } catch {
            // Si Firestore se queja por falta de índice o doc sin el campo,
            // cae a un fetch sin orden y se ordena client-side.
            snapshot = await usersRef.limit(500).get();
        }

        const leads = snapshot.docs.map((doc) => {
            const data = doc.data() as Partial<UserDoc> & { crm?: UserCrm };
            const createdAtIso = normalizeTimestamp(data.meta?.createdAt);
            const dateStr = createdAtIso
                ? new Date(createdAtIso).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                  })
                : 'Reciente';

            const crm = data.crm ?? {};
            const fallbackName =
                (data.displayName && data.displayName.trim()) ||
                (data.email ? data.email.split('@')[0] : null) ||
                'Sin nombre';

            return {
                id: doc.id,
                name: fallbackName,
                email: data.email || 'N/A',
                imr_score: data.imr?.current?.imrScore ?? 'N/A',
                quiz_type: data.meta?.source || 'web',
                dateCompleted: dateStr,
                createdAtIso,
                // Campos CRM (SPEC-016 / 016b) — viven en users/{uid}.crm
                status: (crm.status as LeadStatus) || 'new',
                notes: typeof crm.notes === 'string' ? crm.notes : '',
                tags: Array.isArray(crm.tags) ? crm.tags : [],
                contactedAt: normalizeTimestamp(crm.contactedAt),
                lastUpdatedAt: normalizeTimestamp(crm.lastUpdatedAt),
                // Información extra derivada del UserDoc canónico
                proxy_scores: buildProxyScores(data),
            };
        });

        // Si la query original no devolvió ordenado (catch), lo ordenamos acá
        leads.sort((a, b) => {
            if (!a.createdAtIso && !b.createdAtIso) return 0;
            if (!a.createdAtIso) return 1;
            if (!b.createdAtIso) return -1;
            return b.createdAtIso.localeCompare(a.createdAtIso);
        });

        return jsonResponse(200, { success: true, leads });
    } catch (error) {
        console.error('[leads.GET] Error:', error);
        return jsonResponse(500, { error: 'Error interno del servidor' });
    }
};

/**
 * PUT /api/admin/leads
 * Body: { id: string (uid), status?, notes?, tags? }
 *
 * Actualiza `crm.*` en el doc `users/{uid}` (SPEC-016b).
 * Si `status` cambia a 'contacted' por primera vez (no había contactedAt),
 * marca crm.contactedAt con la fecha. Siempre actualiza crm.lastUpdatedAt.
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
        const docRef = db.collection(COLLECTIONS.USERS).doc(body.id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return jsonResponse(404, { error: 'Lead (user) no encontrado' });
        }

        const now = new Date().toISOString();
        // Construimos el patch con notación dot-path para no pisar otros campos
        // de crm que no estamos editando.
        const update: Record<string, unknown> = { 'crm.lastUpdatedAt': now };

        if (body.status !== undefined) {
            update['crm.status'] = body.status;
            // Marcar contactedAt la primera vez que pasa a contacted
            if (body.status === 'contacted') {
                const existing = docSnap.data() as { crm?: UserCrm };
                if (!normalizeTimestamp(existing?.crm?.contactedAt)) {
                    update['crm.contactedAt'] = now;
                }
            }
        }
        if (body.notes !== undefined) {
            update['crm.notes'] = String(body.notes).slice(0, 5000); // límite razonable
        }
        if (body.tags !== undefined) {
            update['crm.tags'] = body.tags
                .map((t) => String(t).trim())
                .filter((t) => t.length > 0)
                .slice(0, 20); // máx 20 tags por lead
        }

        await docRef.update(update);

        // SPEC-018: log de auditoría con diff de los campos del body
        const existingCrm = (docSnap.data() as { crm?: UserCrm })?.crm ?? {};
        const beforeForDiff: Record<string, unknown> = {};
        const afterForDiff: Record<string, unknown> = {};
        if (body.status !== undefined) {
            beforeForDiff.status = existingCrm.status ?? 'new';
            afterForDiff.status = body.status;
        }
        if (body.notes !== undefined) {
            beforeForDiff.notes = existingCrm.notes ?? '';
            afterForDiff.notes = body.notes;
        }
        if (body.tags !== undefined) {
            beforeForDiff.tags = existingCrm.tags ?? [];
            afterForDiff.tags = body.tags;
        }
        await logAdminAction({
            action: 'update_lead',
            resource: 'lead',
            resourceId: body.id,
            changes: diffOf(beforeForDiff, afterForDiff),
            request,
        });

        return jsonResponse(200, { success: true });
    } catch (error) {
        console.error('[leads.PUT] Error:', error);
        return jsonResponse(500, { error: 'Error interno del servidor' });
    }
};
