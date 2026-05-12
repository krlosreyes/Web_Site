import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import { PILLAR_IDS, isValidPillarId } from '../../../lib/constants/pillars';
import { isAuthenticatedFromCookie, parseCookies, enforceProductionSecurity } from '../../../lib/auth';
import { logAdminAction, diffOf } from '../../../lib/auditLog';
import { slugify } from '../../../lib/utils/slugify';

/**
 * Parsea publishedAt del body (SPEC-023). Devuelve:
 *   - string ISO si parsea OK.
 *   - null si está vacío/no provisto (caller debe aplicar default).
 *   - Lanza Error con mensaje útil si no parsea (caller responde 400).
 */
function parsePublishedAt(raw: unknown): string | null {
    if (raw === undefined || raw === null) return null;
    if (typeof raw !== 'string') {
        throw new Error('publishedAt debe ser string ISO (ej. "2026-05-10T14:30:00Z")');
    }
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) {
        throw new Error(`publishedAt inválido: "${trimmed}"`);
    }
    return d.toISOString();
}

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    try {
        // Enforce production security requirements
        enforceProductionSecurity();
        
        // Parse cookies and check authentication
        const cookies = parseCookies(request);
        if (!isAuthenticatedFromCookie(cookies)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const postsRef = db.collection(COLLECTIONS.POSTS);
        // Fetch up to 50 recent posts
        const snapshot = await postsRef.limit(50).get();

        const posts = snapshot.docs.map(doc => {
            const data = doc.data();

            // SPEC-086: vistas/clics reales desde analytics.* del doc. Si el
            // post no tiene tráfico aún, devolvemos 0 (no mocks aleatorios).
            // El admin UI muestra "—" cuando ambos están en 0, así diferenciamos
            // "sin data acumulada" vs "literalmente cero clics tras tener vistas".
            const views = typeof data.analytics?.views === 'number' ? data.analytics.views : 0;
            const clicks = typeof data.analytics?.clicks === 'number' ? data.analytics.clicks : 0;
            const conversions = typeof data.analytics?.conversions === 'number'
                ? data.analytics.conversions
                : 0;

            return {
                id: doc.id,
                ...data, // Incluir todo el contenido original (content, images, etc.)
                title: data.metadata?.title || data.title || 'Untitled',
                slug: data.metadata?.slug || data.slug || doc.id,
                views,
                clicks,
                conversions,
            };
        });

        // Backend sort by views (desc). Posts sin views quedan al final.
        posts.sort((a, b) => b.views - a.views);

        return new Response(JSON.stringify({ success: true, posts }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error fetching posts:", error);
        return new Response(JSON.stringify({ error: 'Error al obtener' }), { status: 500 });
    }
};

export const POST: APIRoute = async ({ request }) => {
    try {
        enforceProductionSecurity();
        const cookies = parseCookies(request);
        if (!isAuthenticatedFromCookie(cookies)) return new Response(null, { status: 401 });

        const body = await request.json();
        const { title, content, images, references, quiz } = body;

        // SPEC-015: status field con default draft. Carlos puede pasar
        // 'published' explícito desde el botón "Publicar ahora".
        const status: 'draft' | 'published' = body.status === 'published' ? 'published' : 'draft';
        const now = new Date().toISOString();

        // SPEC-046: pillar — opcional en draft, OBLIGATORIO al publicar
        const rawPillar = typeof body.pillar === 'string' ? body.pillar.trim() : null;
        const pillar = rawPillar && isValidPillarId(rawPillar) ? rawPillar : null;
        if (status === 'published' && !pillar) {
            return new Response(
                JSON.stringify({
                    error: `Pilar obligatorio al publicar. Válidos: ${PILLAR_IDS.join(', ')}`,
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // SPEC-023: publishedAt manual desde el editor. Si no viene, default existente.
        let manualPublishedAt: string | null;
        try {
            manualPublishedAt = parsePublishedAt(body.publishedAt);
        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // SPEC-062: slug con transliteración correcta del español (tildes y eñes
        // se convierten a ASCII: 'sueño' → 'sueno', 'qué' → 'que'). El generador
        // anterior usaba `replace(/[^\w\-]+/g, '')` que eliminaba esos caracteres
        // mutilando las palabras del slug. Ver lib/utils/slugify.ts.
        const slug = slugify(title);

        const newPost: Record<string, unknown> = {
            title,
            slug,
            content,
            images,
            references,
            quiz,
            metadata: { title, slug },
            analytics: { views: 0, clicks: 0, conversions: 0 },
            status,
            // SPEC-046: pilar oficial. Drafts pueden quedar en null.
            pillar,
            createdAt: now,
            updatedAt: now,
            publishedAt: manualPublishedAt ?? (status === 'published' ? now : null),
        };

        const docRef = await db.collection(COLLECTIONS.POSTS).add(newPost);

        // SPEC-018: log de auditoría (best-effort)
        await logAdminAction({
            action: 'create_post',
            resource: 'post',
            resourceId: docRef.id,
            changes: { title: { before: null, after: title }, status: { before: null, after: status } },
            request,
        });

        return new Response(JSON.stringify({ success: true, id: docRef.id, status }), { status: 201 });
    } catch (error) {
        console.error('[posts.POST] Error:', error);
        return new Response(JSON.stringify({ error: 'Error al crear' }), { status: 500 });
    }
};

export const PUT: APIRoute = async ({ request }) => {
    try {
        enforceProductionSecurity();
        const cookies = parseCookies(request);
        if (!isAuthenticatedFromCookie(cookies)) return new Response(null, { status: 401 });

        const body = await request.json();
        const { id, ...data } = body;
        if (!id) {
            return new Response(JSON.stringify({ error: 'id requerido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const now = new Date().toISOString();
        const update: Record<string, unknown> = { ...data, updatedAt: now };

        // SPEC-046: validar pillar si viene + si pasa a published, exigirlo.
        if (data.pillar !== undefined) {
            const rawPillarUpd = typeof data.pillar === 'string' ? data.pillar.trim() : null;
            update.pillar = rawPillarUpd && isValidPillarId(rawPillarUpd) ? rawPillarUpd : null;
        }
        if (data.status === 'published') {
            // Si el body pasa a published, validar que tenga pillar (en body o en doc existente)
            const existingDoc = (await db.collection(COLLECTIONS.POSTS).doc(id).get()).data() ?? {};
            const finalPillar = (update.pillar as string | null | undefined) ?? (existingDoc as { pillar?: string }).pillar;
            if (!finalPillar || !isValidPillarId(finalPillar)) {
                return new Response(
                    JSON.stringify({
                        error: `Pilar obligatorio al publicar. Válidos: ${PILLAR_IDS.join(', ')}`,
                    }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        // SPEC-023: publishedAt manual del editor. Si viene, gana sobre
        // cualquier lógica automática. Si no viene, aplicamos la lógica
        // SPEC-015 de "marcar la 1ª vez que pasa a published".
        let manualPublishedAt: string | null;
        try {
            manualPublishedAt = parsePublishedAt(data.publishedAt);
        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Snapshot previo para audit log + lógica de publishedAt
        const docSnap = await db.collection(COLLECTIONS.POSTS).doc(id).get();
        const existing = (docSnap.data() ?? {}) as Record<string, unknown>;

        if (manualPublishedAt) {
            // Carlos especificó la fecha — respetarla
            update.publishedAt = manualPublishedAt;
        } else {
            // No vino fecha en el body: preservar la existente o aplicar SPEC-015.
            // Si data.publishedAt era undefined, dejamos el campo del update sin tocar.
            // Pero spread copió `publishedAt: undefined` desde data — limpiar.
            delete update.publishedAt;
            // SPEC-015: si pasa a published por primera vez, marcar publishedAt.
            if (data.status === 'published') {
                if (!(existing as { publishedAt?: string | null }).publishedAt) {
                    update.publishedAt = now;
                }
            }
            // Volver a draft NO borra publishedAt — preserva historia.
        }

        await db.collection(COLLECTIONS.POSTS).doc(id).update(update);

        // SPEC-018: log de auditoría con diff de los campos modificados
        await logAdminAction({
            action: 'update_post',
            resource: 'post',
            resourceId: id,
            changes: diffOf(
                // before: solo los campos del body (no el doc entero) para que el diff sea relevante
                Object.keys(data).reduce<Record<string, unknown>>((acc, k) => {
                    acc[k] = existing[k];
                    return acc;
                }, {}),
                data
            ),
            request,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error('[posts.PUT] Error:', error);
        return new Response(JSON.stringify({ error: 'Error al actualizar' }), { status: 500 });
    }
};

export const DELETE: APIRoute = async ({ url, request }) => {
    try {
        enforceProductionSecurity();
        const cookies = parseCookies(request);
        if (!isAuthenticatedFromCookie(cookies)) return new Response(null, { status: 401 });

        const id = url.searchParams.get('id');
        if (!id) return new Response(null, { status: 400 });

        // Snapshot del title antes de borrar (para que el log tenga contexto)
        const docSnap = await db.collection(COLLECTIONS.POSTS).doc(id).get();
        const titleBefore = (docSnap.data() as { title?: string } | undefined)?.title ?? null;

        await db.collection(COLLECTIONS.POSTS).doc(id).delete();

        // SPEC-018: log de auditoría
        await logAdminAction({
            action: 'delete_post',
            resource: 'post',
            resourceId: id,
            changes: { title: { before: titleBefore, after: null } },
            request,
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        // SPEC-064: log server-side para diagnosticar. Antes el endpoint
        // fallaba silenciosamente y el cliente solo veía 500 genérico.
        console.error('[posts.DELETE] Error:', error);
        const msg = error instanceof Error ? error.message : 'Error al borrar';
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
