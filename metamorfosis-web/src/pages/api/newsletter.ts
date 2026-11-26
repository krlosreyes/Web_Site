/**
 * SPEC-119: suscripción al boletín quincenal.
 *
 * - Requiere autorización explícita (Ley 1581 de 2012); se guarda la versión
 *   del texto aceptado y la fecha.
 * - El id del documento es un hash del correo: suscribirse dos veces no
 *   duplica, y la respuesta es la misma (no revela si el correo ya existía).
 * - Honeypot `_website` y límite de 5 intentos por hora por IP.
 * - Solo el Admin SDK escribe en la colección.
 * - El envío es manual por ahora; la baja se atiende respondiendo al correo.
 */
import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { db, FieldValue } from '../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../lib/constants/firestore';
import { validateNewsletter } from '../../lib/newsletter/validate';

export const prerender = false;

const HASH_SALT = 'mr-spec119-newsletter-v1';
const hash = (...parts: string[]) =>
    crypto.createHash('sha256').update(HASH_SALT + '|' + parts.join('|')).digest('hex').slice(0, 32);

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const attempts = new Map<string, number[]>();

function allow(key: string): boolean {
    const now = Date.now();
    const list = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    if (list.length >= MAX_PER_WINDOW) {
        attempts.set(key, list);
        return false;
    }
    list.push(now);
    attempts.set(key, list);
    return true;
}

export const POST: APIRoute = async ({ request }) => {
    if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
        return json(415, { error: 'Formato no soportado.' });
    }
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json(400, { error: 'Solicitud inválida.' });
    }
    if (typeof body?._website === 'string' && body._website.trim()) {
        return json(200, { ok: true });
    }

    const ip = (request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown')
        .split(',')[0]
        .trim();
    if (!allow(hash('ip', ip))) {
        return json(429, { error: 'Demasiados intentos. Prueba de nuevo en un rato.' });
    }

    const v = validateNewsletter(body);
    if (!v.ok) return json(400, { error: v.error });

    try {
        const ref = db.collection(COLLECTIONS.NEWSLETTER_SUBSCRIBERS).doc(hash('email', v.value.email));
        const snap = await ref.get();
        if (!snap.exists || snap.data()?.status !== 'active') {
            await ref.set(
                {
                    email: v.value.email,
                    status: 'active',
                    source: v.value.source,
                    consentVersion: v.value.consentVersion,
                    consentAt: FieldValue.serverTimestamp(),
                    ipHash: hash('ip', ip),
                    createdAt: snap.exists ? snap.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
        }
        return json(200, { ok: true });
    } catch (e) {
        console.error('[newsletter] error al guardar', e);
        return json(500, { error: 'No pudimos guardar tu suscripción. Intenta de nuevo.' });
    }
};
