/**
 * GET /api/admin/article-analytics — métricas editoriales agregadas (SPEC-090).
 *
 * Requiere cookie admin válida. Lee `metamorfosis_posts` y `users` enteros
 * y delega la agregación a funciones puras de `lib/admin/articleAnalytics`.
 *
 * Carga: O(posts) + O(users * completedQuizzes). Hoy es manejable
 * (<100 posts, <1000 users). Si crecemos, considerar caché o mover a
 * Cloud Function con índices invertidos.
 */

import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import {
    isAuthenticatedFromCookie,
    parseCookies,
    enforceProductionSecurity,
} from '../../../lib/auth';
import {
    buildAnalyticsResponse,
    type RawPost,
    type RawUser,
} from '../../../lib/admin/articleAnalytics';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    try {
        enforceProductionSecurity();

        const cookies = parseCookies(request);
        if (!isAuthenticatedFromCookie(cookies)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const [postsSnap, usersSnap] = await Promise.all([
            db.collection(COLLECTIONS.POSTS).limit(500).get(),
            db.collection(COLLECTIONS.USERS).limit(2000).get(),
        ]);

        const posts: RawPost[] = postsSnap.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Record<string, unknown>),
        }));

        const users: RawUser[] = usersSnap.docs.map((doc) => {
            const data = doc.data() as Record<string, unknown>;
            return {
                uid: doc.id,
                email: typeof data.email === 'string' ? data.email : '',
                displayName:
                    typeof data.displayName === 'string'
                        ? data.displayName
                        : null,
                completedQuizzes: Array.isArray(data.completedQuizzes)
                    ? (data.completedQuizzes as RawUser['completedQuizzes'])
                    : [],
            };
        });

        const payload = buildAnalyticsResponse(posts, users);

        return new Response(JSON.stringify({ success: true, ...payload }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[article-analytics] error:', err);
        return new Response(JSON.stringify({ error: 'Error interno' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
