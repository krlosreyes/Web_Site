/**
 * GET /api/forum/topics  — lista paginada de topics activos (SPEC-033)
 * POST /api/forum/topics — crea topic (auth ID token)
 *
 * Filtros opcionales en GET: ?category=ayuno&search=keto
 * Limit hardcoded a 100; cuando crezca se agrega cursor.
 */

import type { APIRoute } from 'astro';
import { db, auth } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import { logAdminAction } from '../../../lib/auditLog';
import { getDisplayName } from '../../../lib/userHelpers';

export const prerender = false;

const VALID_CATEGORIES = ['ayuno', 'bio', 'longevity', 'mind', 'general'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function authFromRequest(request: Request): Promise<{ uid: string; name: string | null } | null> {
    const authHeader = request.headers.get('authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) return null;
    try {
        const decoded = await auth.verifyIdToken(idToken);
        return { uid: decoded.uid, name: decoded.name ?? null };
    } catch {
        return null;
    }
}

/** Hash determinista del uid → 0..7 (índice de paleta de colores del avatar). */
function avatarColorIdx(uid: string): number {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
    return Math.abs(h) % 8;
}

export const GET: APIRoute = async ({ url }) => {
    const category = url.searchParams.get('category');
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();

    try {
        let query: FirebaseFirestore.Query = db
            .collection(COLLECTIONS.FORUM_TOPICS)
            .orderBy('createdAt', 'desc')
            .limit(100);
        if (category && VALID_CATEGORIES.includes(category as Category)) {
            // Si hay filtro de categoría, podemos filtrar en query (no necesita índice
            // compuesto cuando se filtra por igualdad + orden por otro campo).
            query = db
                .collection(COLLECTIONS.FORUM_TOPICS)
                .where('category', '==', category)
                .orderBy('createdAt', 'desc')
                .limit(100);
        }

        let snapshot;
        try {
            snapshot = await query.get();
        } catch {
            // Falla típica: índice compuesto no existe. Fallback sin orderBy.
            snapshot = await db
                .collection(COLLECTIONS.FORUM_TOPICS)
                .where('category', '==', category || '')
                .limit(100)
                .get();
        }

        const topics = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))
            .filter((t) => (t as { status?: string }).status !== 'deleted')
            .filter((t) => {
                if (!search) return true;
                const title = String((t as { title?: string }).title || '').toLowerCase();
                const content = String((t as { content?: string }).content || '').toLowerCase();
                return title.includes(search) || content.includes(search);
            });

        return jsonResponse(200, { success: true, topics });
    } catch (error) {
        console.error('[forum.topics.GET] Error:', error);
        return jsonResponse(500, { error: 'Error interno' });
    }
};

export const POST: APIRoute = async ({ request }) => {
    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    let body: { title?: string; content?: string; category?: string };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }

    const title = String(body.title || '').trim().slice(0, 200);
    const content = String(body.content || '').trim().slice(0, 5000);
    const category = (body.category && VALID_CATEGORIES.includes(body.category as Category)
        ? body.category
        : 'general') as Category;

    if (title.length < 3) return jsonResponse(400, { error: 'Título muy corto' });
    if (content.length < 5) return jsonResponse(400, { error: 'Contenido muy corto' });

    // SPEC-036: el ID token cacheado de cuentas nuevas no trae displayName.
    // El helper cae a Firestore (users/{uid}.displayName) que SÍ se persiste
    // explícito en SPEC-029b.
    const authorName = await getDisplayName(session.uid, session.name);
    const initial = authorName.charAt(0).toUpperCase();
    const colorIdx = avatarColorIdx(session.uid);
    const now = new Date().toISOString();

    try {
        const docRef = await db.collection(COLLECTIONS.FORUM_TOPICS).add({
            title,
            content,
            category,
            tags: [category],
            authorUid: session.uid,
            authorName,
            authorInitial: initial,
            authorColorIdx: colorIdx,
            replyCount: 0,
            likeCount: 0,
            views: 0,
            status: 'active',
            createdAt: now,
            updatedAt: now,
        });

        await logAdminAction({
            action: 'create_forum_topic',
            resource: 'forum_topic',
            resourceId: docRef.id,
            changes: {
                title: { before: null, after: title },
                category: { before: null, after: category },
                authorUid: { before: null, after: session.uid },
            },
            request,
        });

        return jsonResponse(201, { success: true, id: docRef.id });
    } catch (error) {
        console.error('[forum.topics.POST] Error:', error);
        return jsonResponse(500, { error: 'Error creando topic' });
    }
};
