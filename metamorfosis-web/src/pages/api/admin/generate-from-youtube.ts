// Este endpoint ha sido deshabilitado: la funcionalidad de generación automática de posts
// (Gemini / IA, procesamiento de transcripciones de YouTube) fue eliminada por decisión de seguridad.
// Si necesitas volver a habilitar algo similar, implementa un flujo seguro y con cuotas.

import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async () => {
    return new Response(JSON.stringify({ error: 'Feature disabled: automatic post generation removed' }), { status: 410, headers: { 'Content-Type': 'application/json' } });
};
