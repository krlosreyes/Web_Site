/**
 * POST /api/users/onboard
 *
 * Crea o completa el documento canónico `users/{uid}` siguiendo el schema v1
 * (SPEC-005). Lo invoca el cliente tras registrarse en Firebase Auth con los
 * datos capturados en el quiz IMR (bio + habits + imrResult).
 *
 * Auth: Firebase ID token en header `Authorization: Bearer <token>`. El uid
 * sale del token verificado (no del body) para evitar suplantación.
 *
 * Idempotente: correr dos veces con los mismos datos no duplica historia ni
 * rompe el doc. Usa merge + arrayUnion en imr.history.
 *
 * Side effect: si encuentra `waitlist_leads` con el mismo email, los borra
 * (el lead pasó a ser user real con waitlist.status='pending').
 *
 * Ver specs/SPEC-006-onboarding-web-app.md
 */

import type { APIRoute } from 'astro';
import { db, auth, FieldValue } from '../../../lib/firebaseAdmin';
import { COLLECTIONS, SCHEMA_VERSION } from '../../../lib/constants/firestore';
import type { ImrResult, UserDoc } from '../../../lib/types/user';
import { sendWelcomeEmail } from '../../../lib/email';
import { logAdminAction } from '../../../lib/auditLog';

export const prerender = false;

interface OnboardBody {
    /** SPEC-029b: el frontend pasa el nombre acá porque `decoded.name` del
     *  ID token está vacío para cuentas recién creadas (updateProfile aún
     *  no se reflejó en el token cacheado). */
    displayName?: string;
    profile?: Partial<UserDoc['profile']>;
    bio?: Partial<Omit<UserDoc['bio'], 'updatedAt'>>;
    habits?: Partial<Omit<UserDoc['habits'], 'updatedAt' | 'source'>>;
    imrResult?: ImrResult | null;
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export const POST: APIRoute = async ({ request }) => {
    // 1. Validar y decodificar Firebase ID token
    const authHeader = request.headers.get('authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) {
        return jsonResponse(401, { error: 'Missing ID token' });
    }

    let decoded;
    try {
        decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
        console.warn('[onboard] Invalid ID token:', err);
        return jsonResponse(401, { error: 'Invalid ID token' });
    }

    const uid = decoded.uid;
    const email = (decoded.email ?? '').toLowerCase();

    // 2. Parse body
    let body: OnboardBody;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }

    const now = new Date().toISOString();
    const userRef = db.collection(COLLECTIONS.USERS).doc(uid);

    try {
        // 3. Mergear el doc canónico
        // No usamos `set` con doc completo: para preservar history y campos que
        // ElenaApp pueda haber poblado, hacemos merge campo por campo.
        const existing = (await userRef.get()).data() as Partial<UserDoc> | undefined;

        const userPayload: Partial<UserDoc> = {
            uid,
            email: decoded.email ?? '',
            emailLower: email,
            // SPEC-029b: prioridad body.displayName (frontend lo pasa explícito)
            // > decoded.name (Firebase ID token, vacío en cuentas nuevas)
            // > existing.displayName (re-onboard de user existente)
            displayName: body.displayName?.trim() || decoded.name || existing?.displayName || null,
            photoURL: decoded.picture ?? existing?.photoURL ?? null,
            profile: {
                gender: body.profile?.gender ?? existing?.profile?.gender ?? null,
                age: body.profile?.age ?? existing?.profile?.age ?? null,
                goals: body.profile?.goals ?? existing?.profile?.goals ?? [],
                pathologies:
                    body.profile?.pathologies ?? existing?.profile?.pathologies ?? [],
            },
            bio: {
                heightCm: body.bio?.heightCm ?? existing?.bio?.heightCm ?? null,
                weightKg: body.bio?.weightKg ?? existing?.bio?.weightKg ?? null,
                waistCm: body.bio?.waistCm ?? existing?.bio?.waistCm ?? null,
                neckCm: body.bio?.neckCm ?? existing?.bio?.neckCm ?? null,
                hipCm: body.bio?.hipCm ?? existing?.bio?.hipCm ?? null,
                bodyFatPct:
                    body.bio?.bodyFatPct ?? existing?.bio?.bodyFatPct ?? null,
                leanMassPct:
                    body.bio?.leanMassPct ?? existing?.bio?.leanMassPct ?? null,
                updatedAt: now,
            },
            habits: {
                fastingHours:
                    body.habits?.fastingHours ?? existing?.habits?.fastingHours ?? null,
                dinnerHour:
                    body.habits?.dinnerHour ?? existing?.habits?.dinnerHour ?? null,
                exerciseMinutesPerDay:
                    body.habits?.exerciseMinutesPerDay ??
                    existing?.habits?.exerciseMinutesPerDay ??
                    null,
                sleepQuality:
                    body.habits?.sleepQuality ?? existing?.habits?.sleepQuality ?? null,
                hydrationLitresPerDay:
                    body.habits?.hydrationLitresPerDay ??
                    existing?.habits?.hydrationLitresPerDay ??
                    null,
                lastMealHour:
                    body.habits?.lastMealHour ?? existing?.habits?.lastMealHour ?? null,
                source: 'self_report',
                updatedAt: now,
            },
            imr: {
                current: body.imrResult ?? existing?.imr?.current ?? null,
                // history se actualiza después con arrayUnion para no perder entries
                history: existing?.imr?.history ?? [],
            },
            waitlist: existing?.waitlist?.status
                ? existing.waitlist
                : {
                      status: 'pending',
                      joinedAt: now,
                      invitedAt: null,
                      position: null,
                  },
            app: existing?.app ?? {
                protocolId: null,
                onboardingCompleted: false,
                biomarkers: null,
            },
            meta: {
                schemaVersion: SCHEMA_VERSION,
                source: existing?.meta?.source ?? 'web',
                createdAt: existing?.meta?.createdAt ?? now,
                updatedAt: now,
                lastLoginAt: now,
            },
        };

        await userRef.set(userPayload, { merge: true });

        // 4. Push del IMR al historial (solo si vino imrResult nuevo)
        if (body.imrResult) {
            await userRef.update({
                'imr.history': FieldValue.arrayUnion({
                    ...body.imrResult,
                    computedAt: now,
                    engineVersion: 'spec-70.5-v1',
                }),
            });
        }

        // 5. Mergear leads anónimos previos con el mismo email
        if (email) {
            try {
                const leadsSnap = await db
                    .collection(COLLECTIONS.WAITLIST_LEADS)
                    .where('email', '==', email)
                    .get();
                if (!leadsSnap.empty) {
                    const batch = db.batch();
                    leadsSnap.docs.forEach((d) => batch.delete(d.ref));
                    await batch.commit();
                    console.log(
                        `[onboard] Mergeados ${leadsSnap.size} leads anónimos previos para ${email}`
                    );
                }
            } catch (e) {
                // No bloquea el onboard si la limpieza falla
                console.warn('[onboard] Error limpiando leads:', e);
            }
        }

        // SPEC-029: email de bienvenida — best-effort, idempotente.
        // Solo se envía si no se envió antes (campo welcomeEmailSentAt).
        const alreadySent = (existing as { welcomeEmailSentAt?: string } | undefined)
            ?.welcomeEmailSentAt;
        if (!alreadySent && decoded.email) {
            try {
                const result = await sendWelcomeEmail({
                    to: decoded.email,
                    name: userPayload.displayName ?? null,
                });
                if (!result.skipped) {
                    await userRef.update({ welcomeEmailSentAt: now });
                    // Audit log: registrar el envío sin guardar el email completo (PII)
                    await logAdminAction({
                        action: 'send_welcome_email',
                        resource: 'session',
                        resourceId: uid,
                        changes: { messageId: { before: null, after: result.id ?? 'unknown' } },
                        request,
                    });
                }
            } catch (e) {
                // Best-effort: no rompemos el onboard si el email falla.
                console.error('[onboard] Welcome email error:', e);
            }
        }

        return jsonResponse(200, { success: true, uid });
    } catch (error) {
        console.error('[onboard] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};
