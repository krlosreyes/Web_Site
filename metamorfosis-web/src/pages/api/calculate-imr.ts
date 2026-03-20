import type { APIRoute } from 'astro';
import { calculateIMR } from '../../utils/imr-engine';
import { db } from '../../lib/firebaseAdmin';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();
        
        // Ejecución técnica del motor IMR
        const result = calculateIMR({
            heightCm: data.heightCm,
            currentWeightKg: data.currentWeightKg,
            waistCircumferenceCm: data.waistCircumferenceCm,
            neckCircumferenceCm: data.neckCircumferenceCm,
            pathologies: data.pathologies || [],
            age: data.age || 40,
            gender: data.gender || 'male'
        });

        // Estructura Metadata solicitada para Firestore
        const metadata = {
            imr_score: result.imrScore,
            imr_label: result.label,
            metabolic_age_est: result.metabolicAge,
            ica_ratio: result.ica,
            bmi_ref: result.imc,
            tmb_ref: result.tmb,
            updated_at: new Date().toISOString()
        };

        // Inyección opcional si hay recordId (lead o post)
        if (data.recordId) {
            try {
                const docRef = db.collection('metamorfosis_posts').doc(data.recordId);
                await docRef.set({
                    metadata: metadata,
                    imr_report: result,
                    last_calculation_type: 'IMR_V01'
                }, { merge: true });
            } catch (fsError) {
                console.error('Firestore Injection Error:', fsError);
                // No detenemos la respuesta principal por un error de logging opcional
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            result, 
            metadata 
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

    } catch (error) {
        console.error('IMR Critical Engine Error:', error);
        return new Response(JSON.stringify({ 
            error: 'Servicio temporalmente no disponible (Engine Failure)' 
        }), { 
            status: 500 
        });
    }
};
