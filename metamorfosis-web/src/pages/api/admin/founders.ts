/**
 * GET /api/admin/founders — listado de fundadores (SPEC-058).
 *
 * Devuelve los usuarios con `founder.isFounder = true` ordenados por
 * `founder.number` ASC, junto con el counter actual del cohorte y el cap.
 * Sirve al tab "Fundadores" del dashboard admin con polling 30s.
 *
 * Auth: cookie admin (`isAuthenticatedFromCookie`). Sin sesión retorna 401.
 *
 * Sin paginación server-side por ahora: el cap es 1000 docs, el response
 * comprimido pesa ~80-150 KB, aceptable para un dashboard interno. Si en
 * el futuro se escala, agregar `?limit=&offset=` y filtros por rango.
 */

import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import {
    FOUNDER_CAP,
    FOUNDER_COUNTER_DOC,
    FOUNDER_COUNTER_FIELD,
} from '../../../lib/constants/founders';
import {
    isAuthenticatedFromCookie,
    parseCookies,
    enforceProductionSecurity,
} from '../../../lib/auth';

export const prerender = false;

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            // Polling cada 30s desde el cliente; evitamos cache intermedio.
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

interface FounderRow {
    uid: string;
    number: number;
    displayName: string | null;
    email: string;
    assignedAt: string | null;
    imrScore: number | null;
    waitlistStatus: string | null;
    welcomeEmailSent: boolean;
    createdAt: string | null;
}

export const GET: APIRoute = async ({ request }) => {
    const guard = authGate(request);
    if (guard) return guard;

    try {
        // 1. Counter del cohorte (cap total asignado hasta el momento).
        const counterRef = db
            .collection(FOUNDER_COUNTER_DOC.collection)
            .doc(FOUNDER_COUNTER_DOC.doc);
        const counterSnap = await counterRef.get();
        const founderCount =
            (counterSnap.data()?.[FOUNDER_COUNTER_FIELD] as number | undefined) ?? 0;

        // 2. Query: users donde founder.isFounder == true.
        // SPEC-058 original usaba `.where(...).orderBy('founder.number', 'asc')`,
        // pero Firestore exige índice compuesto MANUAL para combinar `where`
        // con `orderBy` en campos anidados — devuelve 500 si no existe (con
        // un link para crearlo en consola). El comentario original decía
        // "Firestore lo crea automático" lo cual es falso.
        //
        // Fix: traer todos los docs con `where` solo y ordenar in-memory.
        // Patrón consistente con el resto del proyecto (biblioteca, stats).
        // Cap = 1000 docs, sort in-memory es trivial.
        const snap = await db
            .collection(COLLECTIONS.USERS)
            .where('founder.isFounder', '==', true)
            .get();

        const founders: FounderRow[] = snap.docs
            .map((doc) => {
                const data = doc.data();
                return {
                    uid: doc.id,
                    number: Number(data.founder?.number ?? 0),
                    displayName: data.displayName ?? null,
                    email: data.email ?? '',
                    assignedAt: data.founder?.assignedAt ?? null,
                    imrScore:
                        typeof data.imr?.current?.imrScore === 'number'
                            ? data.imr.current.imrScore
                            : null,
                    waitlistStatus: data.waitlist?.status ?? null,
                    welcomeEmailSent: Boolean(data.welcomeEmailSentAt),
                    createdAt: data.meta?.createdAt ?? null,
                };
            })
            // Ordenar por número de fundador ASC in-memory.
            .sort((a, b) => a.number - b.number);

        return jsonResponse(200, {
            cap: FOUNDER_CAP,
            count: founderCount,
            remaining: Math.max(0, FOUNDER_CAP - founderCount),
            founders,
        });
    } catch (error) {
        console.error('[admin.founders.GET] Error:', error);
        const msg = error instanceof Error ? error.message : 'Error obteniendo fundadores';
        return jsonResponse(500, { error: msg });
    }
};
