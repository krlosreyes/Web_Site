import type { APIRoute } from 'astro';
import { db } from '../../lib/firebaseAdmin';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const payload = await request.json();
        
        const { name, email, estimated_imr, quiz_type, proxy_scores } = payload;
        
        if (!name || !email) {
            return new Response(JSON.stringify({ error: 'Nombre y correo son requeridos' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const emailClean = email.toLowerCase().trim();

        // ─── UNIQUE EMAIL CHECK ───
        const leadsRef = db.collection('waitlist_leads');
        const snapshot = await leadsRef.where('email', '==', emailClean).get();
        
        if (!snapshot.empty) {
            return new Response(JSON.stringify({ 
                error: 'Ya has realizado tu diagnóstico y estás en lista de espera. Pronto te contactaremos.' 
            }), { 
                status: 409,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ─── SAVE LEAD ───
        await leadsRef.add({
            name: name.trim(),
            email: emailClean,
            estimated_imr: estimated_imr || 0,
            quiz_type: quiz_type || 'proxy_v1',
            proxy_scores: proxy_scores || {},
            created_at: new Date() // El Admin SDK usa Date standard que luego Firestore convierte a Timestamp
        });

        return new Response(JSON.stringify({ success: true }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error al guardar lead en backend:", error);
        return new Response(JSON.stringify({
            error: 'Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.'
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
