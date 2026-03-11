import type { APIRoute } from 'astro';
import { savePostToFirestore } from '../../lib/firebase/posts-service';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const payload = await request.json();

        // Server-side strict validation
        const requiredKeys = ['app_integration', 'content', 'metadata', 'quiz'];
        for (const key of requiredKeys) {
            if (!payload[key]) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `Validation Error: Missing root node '${key}'`
                }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        }

        const slug = payload.metadata.slug;
        if (!slug) {
            return new Response(JSON.stringify({
                success: false,
                error: `Validation Error: Missing 'metadata.slug'`
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const status = payload.metadata.status;
        if (!status) {
            payload.metadata.status = 'pending_verification';
        }

        let bodyRaw = payload.content?.body || '';
        // Proteccion Antifallos: Autocorregir attrs HTML con comillas dobles en vez de lanzar Error 400
        if (bodyRaw.includes('="')) {
            bodyRaw = bodyRaw.replace(/="([^"]*)"/g, "='$1'");
        }

        // Reemplazar fallos visuales / placeholders con el URL de emergencia exacto requerido para re-synchronización
        if (bodyRaw.includes('https://placehold.co/')) {
            bodyRaw = bodyRaw.replace(/https:\/\/placehold\.co\/[^\s'"]+/g, 'https://placehold.co/600x400?text=Metamorfosis+Real');
            payload.metadata.status = 'pending_verification';
        }

        payload.content.body = bodyRaw;

        console.log(`[Manual Injector] Initiating emergency database injection for ID: ${slug} with status ${payload.metadata.status}`);

        await savePostToFirestore(slug, payload);

        console.log(`[Manual Injector] Success. Inserted document ID: ${slug}`);

        return new Response(JSON.stringify({ success: true, slug }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Detalle del error al inyectar manual en Firestore:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown network/server error'
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
