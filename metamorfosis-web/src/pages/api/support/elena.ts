/**
 * POST /api/support/elena — Tickets de soporte de ElenaApp (SPEC-112)
 *
 * Flujo:
 *   1. Content-Type: application/json (regla Astro 6 CSRF — CLAUDE.md #4).
 *   2. Parse + validación de campos.
 *   3. Honeypot (`_website` field): si viene con valor, respondemos 200
 *      falso sin persistir. No damos señal al bot.
 *   4. Rate limit por hash(email + ip): 3 tickets / hora, en memoria del módulo.
 *   5. Bearer token opcional: si viene y es válido, `source='authenticated'`
 *      con uid autoritativo del token. Si no, `source='anonymous'`.
 *   6. Persistir en `elena_support_tickets` (Admin SDK bypasses rules).
 *   7. Email a Carlos vía Resend (best-effort — si falla, ticket ya está persistido).
 *   8. Response: { ok: true, ticketId }.
 *
 * Auth ideológico: NUNCA confiar en el `email`/`uid` del body cuando hay Bearer;
 * los tomamos del token verificado. Si no hay Bearer, el body es fuente única.
 */

import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { db, auth, FieldValue } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import { sendSupportTicketEmail } from '../../../lib/email';

export const prerender = false;

// ---------------------------------------------------------------------------
// Constantes y helpers
// ---------------------------------------------------------------------------

const MAX_MESSAGE_LEN = 2000;
const MIN_MESSAGE_LEN = 20;
const MAX_NAME_LEN = 100;

const ALLOWED_CATEGORIES = new Set([
    'tecnico',
    'cuenta',
    'contenido',
    'feedback',
    'otro',
]);

// Salt fijo para hashear ip+email. NO es criptografía perfecta pero suficiente
// para no exponer IPs en cleartext en la collection. Si se filtra el salt, un
// attacker puede correlacionar tickets — riesgo aceptable para el use case.
const HASH_SALT = 'mr-spec112-support-salt-v1';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function hashKey(...parts: string[]): string {
    return crypto
        .createHash('sha256')
        .update(HASH_SALT + '|' + parts.join('|'))
        .digest('hex')
        .slice(0, 32);
}

function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const real = request.headers.get('x-real-ip');
    if (real) return real.trim();
    return 'unknown';
}

// ---------------------------------------------------------------------------
// Rate limit en memoria del módulo
// ---------------------------------------------------------------------------
// Se resetea al restart del server (cada deploy en Hostinger). Aceptable para
// el volumen esperado. Si escala, mover a Firestore (`system/rate_limits/{key}`).

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h
const RATE_LIMIT_MAX = 3;
const rateLimitStore = new Map<string, number[]>();

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const timestamps = (rateLimitStore.get(key) ?? []).filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS
    );
    if (timestamps.length >= RATE_LIMIT_MAX) {
        rateLimitStore.set(key, timestamps);
        return false;
    }
    timestamps.push(now);
    rateLimitStore.set(key, timestamps);
    return true;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

interface TicketBody {
    name?: unknown;
    email?: unknown;
    category?: unknown;
    message?: unknown;
    _website?: unknown; // honeypot
}

export const POST: APIRoute = async ({ request }) => {
    // 1. Content-Type — Astro 6 ya lo valida antes (CSRF), pero defense-in-depth
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        return jsonResponse(415, {
            error: 'Content-Type debe ser application/json',
        });
    }

    // 2. Parse body
    let body: TicketBody;
    try {
        body = (await request.json()) as TicketBody;
    } catch {
        return jsonResponse(400, { error: 'Body inválido' });
    }

    // 3. Honeypot: si el bot llenó el campo oculto, respondemos éxito falso.
    if (typeof body._website === 'string' && body._website.trim().length > 0) {
        return jsonResponse(200, {
            ok: true,
            ticketId: 'honeypot-' + Date.now(),
        });
    }

    // 4. Validación de campos
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (name.length === 0 || name.length > MAX_NAME_LEN) {
        return jsonResponse(400, { error: 'Nombre inválido' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return jsonResponse(400, { error: 'Email inválido' });
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
        return jsonResponse(400, { error: 'Categoría inválida' });
    }
    if (message.length < MIN_MESSAGE_LEN || message.length > MAX_MESSAGE_LEN) {
        return jsonResponse(400, {
            error: `El mensaje debe tener entre ${MIN_MESSAGE_LEN} y ${MAX_MESSAGE_LEN} caracteres`,
        });
    }

    // 5. Bearer token opcional (autenticación)
    let uid: string | null = null;
    let authoritativeEmail = emailRaw;
    let source: 'authenticated' | 'anonymous' = 'anonymous';

    const authHeader = request.headers.get('authorization') ?? '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (idToken) {
        try {
            const decoded = await auth.verifyIdToken(idToken);
            uid = decoded.uid;
            authoritativeEmail = (decoded.email ?? emailRaw).toLowerCase();
            source = 'authenticated';
        } catch (err) {
            // Token inválido → tratamos como anónimo. No bloqueamos.
            console.warn('[support] Bearer inválido, fallback a anónimo:', err);
        }
    }

    // 6. Rate limit por hash(email + ip)
    const ip = getClientIp(request);
    const rlKey = hashKey('rl', authoritativeEmail, ip);
    if (!checkRateLimit(rlKey)) {
        return jsonResponse(429, {
            error: 'Demasiadas solicitudes. Intenta de nuevo en una hora.',
        });
    }

    // 7. Persistir ticket en Firestore
    const userAgent = request.headers.get('user-agent') ?? null;
    const ipHash = hashKey('ip', ip);
    const now = new Date().toISOString();

    let ticketId: string;
    try {
        const docRef = await db
            .collection(COLLECTIONS.ELENA_SUPPORT_TICKETS)
            .add({
                createdAt: now,
                createdAtServer: FieldValue.serverTimestamp(),
                source,
                uid,
                name,
                email: authoritativeEmail,
                category,
                message,
                userAgent,
                ipHash,
                status: 'open',
                adminNotes: null,
                respondedAt: null,
            });
        ticketId = docRef.id;
    } catch (err) {
        console.error('[support] Persist failed:', err);
        return jsonResponse(500, {
            error: 'No pudimos guardar tu ticket. Intenta de nuevo en un momento.',
        });
    }

    // 8. Email a Carlos (best-effort)
    try {
        await sendSupportTicketEmail({
            ticketId,
            source,
            uid,
            name,
            email: authoritativeEmail,
            category,
            message,
            userAgent,
        });
    } catch (err) {
        console.error('[support] Email failed (ticket ya persistido):', err);
        // No bloqueamos — el ticket ya está guardado.
    }

    return jsonResponse(200, { ok: true, ticketId });
};
