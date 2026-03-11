import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
    // 1. Extract ePayco reference from URL search params
    const url = new URL(request.url);
    const ref_payco = url.searchParams.get('ref_payco');

    // Simulate PDF Generation logic here
    console.log(`[Longevity Report] Processing payment reference: ${ref_payco}`);

    // In a real app we'd verify the transaction with ePayco API:
    // const validation = await fetch(`https://secure.epayco.co/validation/v1/reference/${ref_payco}`)

    // 2. Generate PDF using a library like pdf-lib or essentially just return a success page

    const htmlResponse = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reporte Generado | Metamorfosis</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-900 text-white min-h-screen flex items-center justify-center p-6">
        <div class="max-w-md text-center bg-gray-800 p-8 rounded-2xl border border-teal-500/30">
            <svg class="w-16 h-16 text-teal-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <h1 class="text-2xl font-black uppercase mb-2">Pago Exitoso</h1>
            <p class="text-gray-400 mb-6">Tu Reporte de Longevidad PRO ha sido generado. (Demostración)</p>
            <a href="/" class="bg-teal-500 text-gray-900 font-bold px-6 py-3 rounded-xl uppercase tracking-widest text-sm hover:bg-teal-400 transition-colors">Volver al Inicio</a>
        </div>
    </body>
    </html>
    `;

    return new Response(htmlResponse, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
    });
};
