import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import { isAuthenticatedFromCookie, parseCookies, enforceProductionSecurity } from '../../../lib/auth';
import { logAdminAction, diffOf } from '../../../lib/auditLog';

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
            
            // Mocking metrics similarly to before if they don't exist
            const mockViews = Math.floor(Math.random() * 5000) + 500;
            const mockClicks = Math.floor(mockViews * (Math.random() * 0.3 + 0.1));
            const mockConversions = Math.floor(mockClicks * (Math.random() * 0.1 + 0.02));

            return {
                id: doc.id,
                ...data, // Incluir todo el contenido original (content, images, etc.)
                title: data.metadata?.title || data.title || 'Untitled',
                slug: data.metadata?.slug || data.slug || doc.id,
                views: data.analytics?.views || mockViews,
                clicks: data.analytics?.clicks || mockClicks,
                conversions: data.analytics?.conversions || mockConversions,
            };
        });

        // Backend sort by views
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

        // Slug ultra-seguro y truncado
        let slug = title.toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .substring(0, 100);

        if (slug.endsWith('-')) slug = slug.slice(0, -1);

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
            createdAt: now,
            updatedAt: now,
            publishedAt: status === 'published' ? now : null,
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

        // Snapshot previo para audit log + lógica de publishedAt
        const docSnap = await db.collection(COLLECTIONS.POSTS).doc(id).get();
        const existing = (docSnap.data() ?? {}) as Record<string, unknown>;

        // SPEC-015: si pasa a published por primera vez, marcar publishedAt.
        // Si ya tenía publishedAt, lo dejamos (no reseteamos al re-editar).
        if (data.status === 'published') {
            if (!(existing as { publishedAt?: string | null }).publishedAt) {
                update.publishedAt = now;
            }
        } else if (data.status === 'draft') {
            // Volver a draft no borra publishedAt — preserva historia.
            // Si querés "despublicar" del feed, basta con cambiar status; el
            // filtro de biblioteca/posts respeta status.
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
        return new Response(JSON.stringify({ error: 'Error al borrar' }), { status: 500 });
    }
};
