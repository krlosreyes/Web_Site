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
import {
    sendFounderWelcomeEmail,
    sendStandardWelcomeEmail,
} from '../../../lib/email';
import { logAdminAction } from '../../../lib/auditLog';
import { assignFounderIfEligible } from '../../../lib/founders';

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
                // SPEC-089: birthDate es source-of-truth. Si viene, age se
                // deriva al vuelo (mantenido para compat con docs legacy de
                // ElenaApp que solo escriben age). Defensa: si frontend
                // mandó ambos, respetamos el age que mandó (ya derivado
                // con la misma función calculateAge).
                birthDate:
                    body.profile?.birthDate ?? existing?.profile?.birthDate ?? null,
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
            // SPEC-056: NO seteamos el bloque `founder` acá. Lo asigna
            // `assignFounderIfEligible` con una runTransaction después de
            // este `set merge`. Si el user ya tenía `founder` definido
            // (re-onboarding), la transacción detecta idempotencia y no
            // toca el counter ni el doc.
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

        // SPEC-056: asignar cohorte fundador atómicamente.
        // Idempotente: si el user ya tiene founder.isFounder seteado, retorna
        // el estado actual sin tocar el counter. Si todavía no, lee el
        // counter actual de `system/counters.founderCount` y decide:
        //   - currentCount < 1000 → fundador (incrementa counter)
        //   - currentCount >= 1000 → user normal
        // Si la transaction falla (raro), logueamos pero NO fallamos el
        // onboard — el user todavía está creado correctamente. El bloque
        // `founder` queda vacío y un reintento del onboard lo asignará.
        let founderAssignment: Awaited<ReturnType<typeof assignFounderIfEligible>> | null = null;
        try {
            founderAssignment = await assignFounderIfEligible(uid, now);
        } catch (e) {
            console.error('[onboard] founder assignment failed:', e);
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
                }
            } catch (e) {
                // No bloquea el onboard si la limpieza falla
                console.warn('[onboard] Error limpiando leads:', e);
            }
        }

        // SPEC-029: email de bienvenida — best-effort, idempotente.
        // SPEC-057: si el user fue marcado fundador (founderAssignment.isFounder),
        // mandamos el email de fundador con su número y los 2 beneficios. Si no,
        // el welcome estándar (post-1000 o casos donde la asignación falló).
        // Solo se envía si no se envió antes (campo welcomeEmailSentAt).
        const alreadySent = (existing as { welcomeEmailSentAt?: string } | undefined)
            ?.welcomeEmailSentAt;
        if (!alreadySent && decoded.email) {
            try {
                const isFounder =
                    founderAssignment?.isFounder === true &&
                    typeof founderAssignment.number === 'number';
                const result = isFounder
                    ? await sendFounderWelcomeEmail({
                          to: decoded.email,
                          name: userPayload.displayName ?? null,
                          founderNumber: founderAssignment!.number!,
                      })
                    : await sendStandardWelcomeEmail({
                          to: decoded.email,
                          name: userPayload.displayName ?? null,
                      });
                if (!result.skipped) {
                    await userRef.update({ welcomeEmailSentAt: now });
                    // Audit log: registrar el envío sin guardar el email completo (PII)
                    await logAdminAction({
                        action: isFounder
                            ? 'send_founder_welcome_email'
                            : 'send_welcome_email',
                        resource: 'session',
                        resourceId: uid,
                        changes: {
                            messageId: { before: null, after: result.id ?? 'unknown' },
                            founderNumber: isFounder
                                ? { before: null, after: founderAssignment!.number }
                                : { before: null, after: null },
                        },
                        request,
                    });
                }
            } catch (e) {
                // Best-effort: no rompemos el onboard si el email falla.
                // Fallback: el dashboard del user muestra el badge fundador
                // igual aunque el email no haya llegado (SPEC-057).
                console.error('[onboard] Welcome email error:', e);
            }
        }

        // SPEC-056: exponer asignación fundador al frontend para badges
        // inmediatos en el dashboard ("Eres fundador #42"). Si la asignación
        // falló (catch arriba), retornamos null y el frontend cae a UI por defecto.
        return jsonResponse(200, {
            success: true,
            uid,
            founder: founderAssignment
                ? {
                      isFounder: founderAssignment.isFounder,
                      number: founderAssignment.number,
                  }
                : null,
        });
    } catch (error) {
        console.error('[onboard] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};
