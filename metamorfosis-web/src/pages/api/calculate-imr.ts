// Stub temporal — desbloquea el build de SPEC-001.
//
// El endpoint original importaba `calculateIMR` desde `imr-engine.ts`, pero ese
// símbolo dejó de existir cuando el engine se renombró a `calculateSPEC705`.
// La calculadora PRO (`MetamorfosisCalculator.tsx`) consume este endpoint, así
// que llevaba tiempo rota (no se notaba porque el sitio se publicaba estático
// y la API nunca corría en producción).
//
// SPEC-004 reescribe este archivo para usar `calculateSPEC705` correctamente,
// además de eliminar la rama `recordId` que permitía writes anónimos a posts.
// Mientras tanto, devolvemos 503 con un mensaje claro para que el front lo
// muestre como "no disponible" en lugar de quedar en silencio.

import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async () => {
    return new Response(
        JSON.stringify({
            error: 'Calculadora temporalmente fuera de servicio. Reactivación pendiente en SPEC-004.',
        }),
        {
            status: 503,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': '86400',
            },
        }
    );
};
