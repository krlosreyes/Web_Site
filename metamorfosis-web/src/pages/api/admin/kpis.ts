import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import { isAuthenticatedFromCookie, parseCookies, enforceProductionSecurity } from '../../../lib/auth';

export const prerender = false;

/**
 * KPIs de adherencia / activación / retención de ElenaApp (SPEC-114).
 *
 * GET /api/admin/kpis
 *
 * Fuente de datos: ElenaApp escribe directo a Firestore (comparte proyecto
 * con este sitio). NO usa la subcolección `daily_logs` documentada en
 * `lib/constants/firestore.ts` (esa convención quedó legacy) — usa
 * subcolecciones versionadas por pilar bajo `users/{uid}/`:
 *   - streak_history/{dateKey}   → señal maestra de "día activo" (doc.id
 *     es YYYY-MM-DD, escrito por FirestoreStreakV1Source). Es la fuente
 *     más confiable para retención/DAU-MAU porque ElenaApp la escribe
 *     específicamente para trackear adherencia diaria.
 *   - fasting_history/{autoId}   → campo `startTime` (Timestamp).
 *   - nutrition_history, exercise_history, sleep_history, hydration_history
 *     → mapeo best-effort (doc.id como fecha, o campos comunes de fecha).
 *     Solo se usan para el desglose "pilares tocados" del roster, no para
 *     el cálculo de retención (que se apoya en streak_history).
 *
 * IMPORTANTE — lo que este endpoint NO puede calcular hoy:
 *   - Conversión trial→premium y churn: RevenueCat no tiene webhook hacia
 *     Firestore en este proyecto (verificado: no hay Cloud Function de
 *     RevenueCat en elena_app/functions/src). Sin eso, el estado de
 *     suscripción vive únicamente en el dashboard de RevenueCat.
 *   - coaching_action_followed y demás eventos de Firebase Analytics
 *     (SPEC-193 en ElenaApp): no hay export a BigQuery activado, así que
 *     no son consultables desde Firestore Admin SDK.
 * Ambos se devuelven como `available: false` con una nota explicativa en
 * vez de inventar un número.
 */

type PillarKey = 'fasting' | 'nutrition' | 'exercise' | 'sleep' | 'hydration';

const PILLAR_SUBCOLLECTIONS: Record<PillarKey, string> = {
    fasting: 'fasting_history',
    nutrition: 'nutrition_history',
    exercise: 'exercise_history',
    sleep: 'sleep_history',
    hydration: 'hydration_history',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

/** Normaliza cualquier representación de fecha/Timestamp a un objeto Date, o null. */
function toDate(raw: unknown): Date | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw === 'object' && raw !== null) {
        const ts = raw as { toDate?: () => Date; _seconds?: number; seconds?: number };
        if (typeof ts.toDate === 'function') return ts.toDate();
        if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
        if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
    }
    return null;
}

/** YYYY-MM-DD en UTC. */
function dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
    const da = new Date(`${a}T00:00:00Z`).getTime();
    const db_ = new Date(`${b}T00:00:00Z`).getTime();
    return Math.round((db_ - da) / 86400000);
}

/** Intenta extraer un dayKey de un doc de un pilar "best-effort" (no streak, no fasting). */
function bestEffortDayKey(docId: string, data: Record<string, unknown>): string | null {
    if (DATE_RE.test(docId)) return docId;
    const candidates = ['date', 'day', 'dateKey', 'createdAt', 'timestamp', 'loggedAt', 'startTime', 'start', 'startedAt'];
    for (const field of candidates) {
        const d = toDate(data[field]);
        if (d) return dayKey(d);
    }
    return null;
}

interface UserAgg {
    uid: string;
    email: string;
    signupDate: string | null; // YYYY-MM-DD
    onboardingCompleted: boolean;
    activeDays: Set<string>; // desde streak_history — fuente maestra
    pillarDays: Record<PillarKey, Set<string>>;
}

export const GET: APIRoute = async ({ request }) => {
    const denied = authGate(request);
    if (denied) return denied;

    try {
        const usersSnap = await db.collection(COLLECTIONS.USERS).limit(1000).get();

        const aggs: UserAgg[] = [];

        await Promise.all(
            usersSnap.docs.map(async (userDoc) => {
                const data = userDoc.data();
                const uid = userDoc.id;
                const createdAt = toDate(data.meta?.createdAt);
                const agg: UserAgg = {
                    uid,
                    email: data.email || '(sin email)',
                    signupDate: createdAt ? dayKey(createdAt) : null,
                    onboardingCompleted: data.app?.onboardingCompleted === true,
                    activeDays: new Set(),
                    pillarDays: { fasting: new Set(), nutrition: new Set(), exercise: new Set(), sleep: new Set(), hydration: new Set() },
                };

                // streak_history: doc.id ES el dateKey — fuente maestra de "día activo".
                const streakSnap = await userDoc.ref
                    .collection('streak_history')
                    .limit(500)
                    .get()
                    .catch(() => null);
                streakSnap?.docs.forEach((d) => {
                    if (DATE_RE.test(d.id)) agg.activeDays.add(d.id);
                });

                // Pilares: best-effort, usado solo para el desglose del roster.
                await Promise.all(
                    (Object.keys(PILLAR_SUBCOLLECTIONS) as PillarKey[]).map(async (pillar) => {
                        const snap = await userDoc.ref
                            .collection(PILLAR_SUBCOLLECTIONS[pillar])
                            .limit(500)
                            .get()
                            .catch(() => null);
                        snap?.docs.forEach((d) => {
                            const key = bestEffortDayKey(d.id, d.data());
                            if (key) {
                                agg.pillarDays[pillar].add(key);
                                // Los días con actividad de pilar también cuentan como "activos"
                                // aunque streak_history no lo haya registrado (defensa contra
                                // gaps del motor de streak).
                                agg.activeDays.add(key);
                            }
                        });
                    })
                );

                aggs.push(agg);
            })
        );

        const todayKey = dayKey(new Date());
        const totalUsers = aggs.length;

        // ── Onboarding complete ──
        const onboardingCompleteCount = aggs.filter((a) => a.onboardingCompleted).length;

        // ── Activation: actividad (cualquier pilar) el mismo día calendario del signup ──
        const withSignup = aggs.filter((a) => a.signupDate !== null);
        const activatedCount = withSignup.filter((a) => a.activeDays.has(a.signupDate as string)).length;

        // ── Retención D1/D7/D30 (cohort-based: solo cuenta users con antigüedad suficiente) ──
        function retention(nDays: number) {
            const cohort = withSignup.filter((a) => daysBetween(a.signupDate as string, todayKey) >= nDays);
            if (cohort.length === 0) return { rate: null as number | null, cohortSize: 0, returned: 0 };
            const returned = cohort.filter((a) => {
                const target = new Date(`${a.signupDate}T00:00:00Z`);
                target.setUTCDate(target.getUTCDate() + nDays);
                return a.activeDays.has(dayKey(target));
            }).length;
            return { rate: Number(((returned / cohort.length) * 100).toFixed(1)), cohortSize: cohort.length, returned };
        }
        const d1 = retention(1);
        const d7 = retention(7);
        const d30 = retention(30);

        // ── DAU / MAU ──
        const dauSet = new Set(aggs.filter((a) => a.activeDays.has(todayKey)).map((a) => a.uid));
        const mauSet = new Set<string>();
        for (const a of aggs) {
            for (const d of a.activeDays) {
                if (daysBetween(d, todayKey) >= 0 && daysBetween(d, todayKey) <= 29) {
                    mauSet.add(a.uid);
                    break;
                }
            }
        }
        const dau = dauSet.size;
        const mau = mauSet.size;

        // ── North Star: "semanas con hábito real" — trailing 7 días,
        // ≥3 de 5 pilares en ≥4 días distintos ──
        let habitWeekUsers = 0;
        for (const a of aggs) {
            const dayPillarCount = new Map<string, Set<PillarKey>>();
            (Object.keys(a.pillarDays) as PillarKey[]).forEach((pillar) => {
                a.pillarDays[pillar].forEach((d) => {
                    if (daysBetween(d, todayKey) >= 0 && daysBetween(d, todayKey) <= 6) {
                        if (!dayPillarCount.has(d)) dayPillarCount.set(d, new Set());
                        dayPillarCount.get(d)!.add(pillar);
                    }
                });
            });
            let daysWithThreePlus = 0;
            dayPillarCount.forEach((pillars) => {
                if (pillars.size >= 3) daysWithThreePlus += 1;
            });
            if (daysWithThreePlus >= 4) habitWeekUsers += 1;
        }
        const northStarRate = totalUsers > 0 ? Number(((habitWeekUsers / totalUsers) * 100).toFixed(1)) : null;

        // ── Roster por usuario (para contacto directo — Experimento 1 del informe) ──
        const roster = aggs
            .map((a) => {
                const lastActive = [...a.activeDays].sort().pop() || null;
                const daysSinceLastActive = lastActive ? daysBetween(lastActive, todayKey) : null;
                const pillarsTouched = (Object.keys(a.pillarDays) as PillarKey[]).filter((p) => a.pillarDays[p].size > 0);
                let status: 'activo' | 'en_riesgo' | 'inactivo' | 'nunca_activo';
                if (daysSinceLastActive === null) status = 'nunca_activo';
                else if (daysSinceLastActive <= 2) status = 'activo';
                else if (daysSinceLastActive <= 6) status = 'en_riesgo';
                else status = 'inactivo';
                return {
                    uid: a.uid,
                    email: a.email,
                    signupDate: a.signupDate,
                    onboardingCompleted: a.onboardingCompleted,
                    lastActive,
                    daysSinceLastActive,
                    activeDaysTotal: a.activeDays.size,
                    pillarsTouched,
                    status,
                };
            })
            .sort((x, y) => (y.daysSinceLastActive ?? 9999) - (x.daysSinceLastActive ?? 9999));

        return jsonResponse(200, {
            success: true,
            generatedAt: new Date().toISOString(),
            headline: {
                totalUsers,
                onboardingCompleteRate: totalUsers > 0 ? Number(((onboardingCompleteCount / totalUsers) * 100).toFixed(1)) : null,
                activationRate: withSignup.length > 0 ? Number(((activatedCount / withSignup.length) * 100).toFixed(1)) : null,
                activationCohortSize: withSignup.length,
                d1Retention: d1,
                d7Retention: d7,
                d30Retention: d30,
                dau,
                mau,
                dauMauRate: mau > 0 ? Number(((dau / mau) * 100).toFixed(1)) : null,
                northStarRate,
                habitWeekUsers,
            },
            unavailable: {
                conversionTrialToPremium: {
                    available: false,
                    reason: 'RevenueCat no tiene webhook hacia Firestore en este proyecto — el estado de suscripción vive solo en el dashboard de RevenueCat. Requiere SPEC nueva en ElenaApp (Cloud Function webhook).',
                },
                churn: {
                    available: false,
                    reason: 'Depende de la misma integración de RevenueCat que la conversión.',
                },
                coachingActionFollowed: {
                    available: false,
                    reason: 'Es un evento de Firebase Analytics (SPEC-193 en ElenaApp) sin export a BigQuery activado — no consultable desde Firestore Admin SDK.',
                },
            },
            roster,
        });
    } catch (error) {
        console.error('[kpis.GET] Error:', error);
        return jsonResponse(500, { error: 'Error interno del servidor' });
    }
};
