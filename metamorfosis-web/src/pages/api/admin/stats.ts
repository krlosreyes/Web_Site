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
 * Stats con filtros temporales y series para sparklines (SPEC-019).
 *
 * GET /api/admin/stats?range=7d|30d|90d|all (default: 30d)
 *
 * Devuelve:
 *   - totals: posts publicados, drafts, users totales, users nuevos en rango,
 *     IMR promedio en rango, cantidad de IMRs en rango.
 *   - series: newUsersByDay, postsByDay, imrByDay con buckets diarios
 *     (o mensuales si range='all').
 *
 * SPEC-016b: lee `users` (no `waitlist_leads` legacy) para totales de leads.
 */

type RangeKey = '7d' | '30d' | '90d' | 'all';

const VALID_RANGES: RangeKey[] = ['7d', '30d', '90d', 'all'];

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

/** Convierte el query param `range` a un objeto con startISO y label legibles. */
function resolveRange(range: RangeKey): {
    range: RangeKey;
    startISO: string | null; // null = sin filtro temporal (range='all')
    rangeLabel: string;
    bucketBy: 'day' | 'month';
} {
    const now = new Date();
    if (range === 'all') {
        return {
            range,
            startISO: null,
            rangeLabel: 'Todo el histórico',
            bucketBy: 'month',
        };
    }
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - days + 1);
    start.setUTCHours(0, 0, 0, 0);
    return {
        range,
        startISO: start.toISOString(),
        rangeLabel: `Últimos ${days} días`,
        bucketBy: 'day',
    };
}

/** Normaliza un timestamp a Date. */
function toDate(raw: unknown): Date | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw === 'object' && raw !== null) {
        const ts = raw as { toDate?: () => Date; _seconds?: number };
        if (typeof ts.toDate === 'function') return ts.toDate();
        if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
    }
    return null;
}

/** Bucket key para una fecha: YYYY-MM-DD si day, YYYY-MM si month. */
function bucketKey(d: Date, bucketBy: 'day' | 'month'): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    if (bucketBy === 'month') return `${y}-${m}`;
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Genera todos los buckets entre startISO y now (inclusive). Devuelve array ordenado. */
function generateBuckets(
    startISO: string | null,
    bucketBy: 'day' | 'month'
): string[] {
    const now = new Date();
    if (!startISO) {
        // range=all: arrancamos en el bucket mensual actual y vamos hacia atrás 24 meses
        // (suficiente para visualizar tendencia sin disparar el array a infinito).
        const result: string[] = [];
        const cursor = new Date(now);
        cursor.setUTCDate(1);
        cursor.setUTCHours(0, 0, 0, 0);
        cursor.setUTCMonth(cursor.getUTCMonth() - 23); // 24 buckets totales
        for (let i = 0; i < 24; i++) {
            result.push(bucketKey(cursor, 'month'));
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
        return result;
    }
    const start = new Date(startISO);
    const result: string[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= now.getTime()) {
        result.push(bucketKey(cursor, bucketBy));
        if (bucketBy === 'day') {
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        } else {
            cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        }
    }
    return result;
}

export const GET: APIRoute = async ({ request, url }) => {
    const denied = authGate(request);
    if (denied) return denied;

    const rangeParam = (url.searchParams.get('range') || '30d') as RangeKey;
    const range: RangeKey = VALID_RANGES.includes(rangeParam) ? rangeParam : '30d';
    const { startISO, rangeLabel, bucketBy } = resolveRange(range);

    try {
        const postsRef = db.collection(COLLECTIONS.POSTS);
        const usersRef = db.collection(COLLECTIONS.USERS);

        // ─── Totales globales (count() es barato) ───
        const [allPostsCount, draftsCount, allUsersCount] = await Promise.all([
            postsRef.where('status', '==', 'published').count().get().catch(() =>
                // fallback: si el index no existe o un doc legacy no tiene status,
                // contamos todos como "publicados" para no romper la UI.
                postsRef.count().get()
            ),
            postsRef.where('status', '==', 'draft').count().get().catch(() =>
                ({ data: () => ({ count: 0 }) } as any)
            ),
            usersRef.count().get(),
        ]);

        // ─── Fetches en rango: traemos los docs para poder agrupar y promediar ───
        // Para `range=all` traemos sin filtrar pero con cap; para los otros,
        // intentamos filtro server-side y si falla el índice, in-memory.
        const fetchInRange = async (
            ref: FirebaseFirestore.Query,
            field: string
        ): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> => {
            if (!startISO) {
                const snap = await ref.limit(2000).get();
                return snap.docs;
            }
            try {
                const snap = await ref.where(field, '>=', startISO).limit(2000).get();
                return snap.docs;
            } catch {
                // Falla típica: índice ausente. Fallback in-memory.
                const snap = await ref.limit(2000).get();
                return snap.docs.filter((d) => {
                    const raw = field
                        .split('.')
                        .reduce<any>((acc, k) => (acc ? acc[k] : undefined), d.data());
                    const date = toDate(raw);
                    return !!date && date.toISOString() >= startISO;
                });
            }
        };

        const [usersInRange, postsPublishedInRange] = await Promise.all([
            fetchInRange(usersRef, 'meta.createdAt'),
            fetchInRange(postsRef.where('status', '==', 'published'), 'publishedAt'),
        ]);

        // ─── Buckets vacíos pre-poblados con 0 ───
        const buckets = generateBuckets(startISO, bucketBy);
        const newUsersByBucket = new Map<string, number>(buckets.map((b) => [b, 0]));
        const postsByBucket = new Map<string, number>(buckets.map((b) => [b, 0]));
        const imrSumByBucket = new Map<string, { sum: number; n: number }>(
            buckets.map((b) => [b, { sum: 0, n: 0 }])
        );

        // ─── Agregar users en rango ───
        let imrSum = 0;
        let imrCount = 0;
        for (const doc of usersInRange) {
            const data = doc.data();
            const created = toDate(data.meta?.createdAt);
            if (!created) continue;
            // Si hay startISO y el doc está fuera de rango (defensa contra fallback
            // in-memory que podría incluir extras), saltarlo.
            if (startISO && created.toISOString() < startISO) continue;

            const k = bucketKey(created, bucketBy);
            if (newUsersByBucket.has(k)) {
                newUsersByBucket.set(k, (newUsersByBucket.get(k) || 0) + 1);
            }

            const score = data.imr?.current?.imrScore;
            if (typeof score === 'number' && !isNaN(score)) {
                imrSum += score;
                imrCount += 1;
                if (imrSumByBucket.has(k)) {
                    const cur = imrSumByBucket.get(k)!;
                    imrSumByBucket.set(k, { sum: cur.sum + score, n: cur.n + 1 });
                }
            }
        }

        // ─── Agregar posts publicados en rango ───
        for (const doc of postsPublishedInRange) {
            const data = doc.data();
            const published = toDate(data.publishedAt) || toDate(data.created_at);
            if (!published) continue;
            if (startISO && published.toISOString() < startISO) continue;
            const k = bucketKey(published, bucketBy);
            if (postsByBucket.has(k)) {
                postsByBucket.set(k, (postsByBucket.get(k) || 0) + 1);
            }
        }

        // ─── Construir series ordenadas ───
        const newUsersByDay = buckets.map((date) => ({
            date,
            count: newUsersByBucket.get(date) || 0,
        }));
        const postsByDay = buckets.map((date) => ({
            date,
            count: postsByBucket.get(date) || 0,
        }));
        const imrByDay = buckets.map((date) => {
            const { sum, n } = imrSumByBucket.get(date) || { sum: 0, n: 0 };
            return {
                date,
                avg: n > 0 ? Number((sum / n).toFixed(1)) : null,
                count: n,
            };
        });

        return jsonResponse(200, {
            success: true,
            range,
            rangeLabel,
            bucketBy,
            totals: {
                posts: allPostsCount.data().count,
                drafts: draftsCount.data().count,
                users: allUsersCount.data().count,
                newUsersInRange: usersInRange.filter((d) => {
                    if (!startISO) return true;
                    const c = toDate(d.data().meta?.createdAt);
                    return !!c && c.toISOString() >= startISO;
                }).length,
                imrAvg: imrCount > 0 ? Number((imrSum / imrCount).toFixed(1)) : null,
                imrCount,
            },
            series: {
                newUsersByDay,
                postsByDay,
                imrByDay,
            },
        });
    } catch (error) {
        console.error('[stats.GET] Error:', error);
        return jsonResponse(500, { error: 'Error interno del servidor' });
    }
};
