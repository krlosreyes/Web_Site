import type { APIRoute } from 'astro';

export const prerender = false;

// URL de la Cloud Function (Idealmente en .env)
const CLOUD_FUNCTION_URL = import.meta.env.PUBLIC_CLOUD_FUNCTION_URL || 'https://us-central1-elena-app-2026-v1.cloudfunctions.net/calculateIMXv2';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();

        // 1. Fetch a la Cloud Function
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': `Bearer ${import.meta.env.CLOUDFUNCTION_TOKEN}` // Si se requiere
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Cloud Function Error:', errorText);
            return new Response(JSON.stringify({ error: 'Error calculating IMX via Cloud Function' }), { status: 500 });
        }

        const result = await response.json();

        // 2. Respuesta con Estrategia SWR (Stale-While-Revalidate)
        // s-maxage=60: Cache en el CDN por 60s
        // stale-while-revalidate=300: Si el cache expira, sirve lo viejo y actualiza en background por 5 min
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        });

    } catch (error) {
        console.error('API Route Error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
};
