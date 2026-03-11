import type { APIRoute } from 'astro';
import { updatePostBodyInFirestore } from '../../lib/firebase/posts-service';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const payload = await request.json();

        const { slug, body } = payload;

        if (!slug || typeof body !== 'string') {
            return new Response(JSON.stringify({
                success: false,
                error: `Validation Error: Missing slug or body content`
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        console.log(`[Visual Resync] Initiating atomic body update for ID: ${slug}`);

        await updatePostBodyInFirestore(slug, body);

        console.log(`[Visual Resync] Success. Document ${slug} body updated atomically.`);

        return new Response(JSON.stringify({ success: true, slug }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Detalle del error en Visual Resync:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown network/server error'
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
