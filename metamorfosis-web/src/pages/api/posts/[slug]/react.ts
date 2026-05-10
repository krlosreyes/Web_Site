/**
 * GET/POST /api/posts/[slug]/react — reactions de artículo (SPEC-032).
 *
 * GET: devuelve { userReaction: 'like'|'dislike'|null, counts: { likes, dislikes } }
 *   (para que el cliente sepa el voto actual del user al cargar la página).
 *
 * POST: body { value: 'like'|'dislike'|null }
 *   - null = remover reacción.
 *   - Idempotente: votar lo mismo dos veces no multiplica counters.
 *   - Cambiar voto: transaction atómica que actualiza reaction doc + counters.
 *
 * Auth: Firebase ID token en `Authorization: Bearer <token>`.
 *
 * Notas:
 *   - El cliente NO escribe directo en /reactions/{uid} — todo va por acá.
 *   - Counters denormalizados en metamorfosis_posts/{id}.reactions = { likes, dislikes }.
 *   - Audit log best-effort para detectar abuso.
 */

import type { APIRoute } from 'astro';
import { db, auth, FieldValue } from '../../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../../lib/constants/firestore';
import { logAdminAction } from '../../../../lib/auditLog';

export const prerender = false;

type ReactionValue = 'like' | 'dislike';

interface ReactionsCounter {
    likes: number;
    dislikes: number;
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/** Verifica el ID token y devuelve el uid + email del user, o null si inválido. */
async function authFromRequest(request: Request): Promise<{ uid: string; email: string | null } | null> {
    const authHeader = request.headers.get('authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) return null;
    try {
        const decoded = await auth.verifyIdToken(idToken);
        return { uid: decoded.uid, email: decoded.email ?? null };
    } catch {
        return null;
    }
}

/** Encuentra el post por slug. Devuelve { ref, id } o null si no existe. */
async function findPostBySlug(slug: string) {
    const snap = await db
        .collection(COLLECTIONS.POSTS)
        .where('slug', '==', slug)
        .limit(1)
        .get();
    if (snap.empty) return null;
    return { ref: snap.docs[0].ref, id: snap.docs[0].id, data: snap.docs[0].data() };
}

export const GET: APIRoute = async ({ params, request }) => {
    const slug = params.slug;
    if (!slug) return jsonResponse(400, { error: 'slug requerido' });

    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    const post = await findPostBySlug(slug);
    if (!post) return jsonResponse(404, { error: 'Post no encontrado' });

    const reactionDoc = await post.ref.collection('reactions').doc(session.uid).get();
    const userReaction: ReactionValue | null = reactionDoc.exists
        ? (reactionDoc.data()?.value as ReactionValue) ?? null
        : null;

    const counts: ReactionsCounter = (post.data?.reactions as ReactionsCounter) || {
        likes: 0,
        dislikes: 0,
    };

    return jsonResponse(200, {
        success: true,
        userReaction,
        counts,
    });
};

export const POST: APIRoute = async ({ params, request }) => {
    const slug = params.slug;
    if (!slug) return jsonResponse(400, { error: 'slug requerido' });

    const session = await authFromRequest(request);
    if (!session) return jsonResponse(401, { error: 'Unauthorized' });

    let body: { value?: ReactionValue | null };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }

    const newValue: ReactionValue | null =
        body.value === 'like' || body.value === 'dislike' ? body.value : null;

    const post = await findPostBySlug(slug);
    if (!post) return jsonResponse(404, { error: 'Post no encontrado' });

    const reactionRef = post.ref.collection('reactions').doc(session.uid);
    const now = new Date().toISOString();

    let resultCounts: ReactionsCounter;
    let prevValue: ReactionValue | null = null;

    try {
        await db.runTransaction(async (tx) => {
            const [postSnap, reactionSnap] = await Promise.all([
                tx.get(post.ref),
                tx.get(reactionRef),
            ]);

            const currentCounts: ReactionsCounter = (postSnap.data()?.reactions as ReactionsCounter) || {
                likes: 0,
                dislikes: 0,
            };
            // normalizar (defensa contra docs viejos sin campo reactions)
            currentCounts.likes = Math.max(0, currentCounts.likes || 0);
            currentCounts.dislikes = Math.max(0, currentCounts.dislikes || 0);

            prevValue = reactionSnap.exists ? ((reactionSnap.data()?.value as ReactionValue) ?? null) : null;

            // No-op si el value no cambió
            if (prevValue === newValue) {
                resultCounts = currentCounts;
                return;
            }

            // Decrement el viejo (si había)
            if (prevValue === 'like') currentCounts.likes -= 1;
            if (prevValue === 'dislike') currentCounts.dislikes -= 1;

            // Increment el nuevo (si lo hay)
            if (newValue === 'like') currentCounts.likes += 1;
            if (newValue === 'dislike') currentCounts.dislikes += 1;

            // Clamp final por si quedó algo raro
            currentCounts.likes = Math.max(0, currentCounts.likes);
            currentCounts.dislikes = Math.max(0, currentCounts.dislikes);

            // Escribir/borrar el reaction doc del user
            if (newValue === null) {
                tx.delete(reactionRef);
            } else {
                tx.set(
                    reactionRef,
                    {
                        value: newValue,
                        createdAt: reactionSnap.exists ? reactionSnap.data()?.createdAt ?? now : now,
                        updatedAt: now,
                    },
                    { merge: true }
                );
            }

            // Actualizar counters denormalizados del post
            tx.update(post.ref, { reactions: currentCounts });

            resultCounts = currentCounts;
        });
    } catch (err) {
        console.error('[posts.react.POST] Transaction error:', err);
        return jsonResponse(500, { error: 'Error procesando reacción' });
    }

    // Audit log best-effort
    try {
        if (prevValue !== newValue) {
            await logAdminAction({
                action: 'react_post',
                resource: 'post',
                resourceId: post.id,
                changes: {
                    reaction: { before: prevValue, after: newValue },
                    uid: { before: null, after: session.uid },
                },
                request,
            });
        }
    } catch {
        // No bloqueamos por audit
    }

    return jsonResponse(200, {
        success: true,
        userReaction: newValue,
        counts: resultCounts!,
    });
};
