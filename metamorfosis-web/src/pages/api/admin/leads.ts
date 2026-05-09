import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../../lib/constants/firestore';
import { isAuthenticatedFromCookie, parseCookies, enforceProductionSecurity } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    try {
        // Enforce production security requirements
        enforceProductionSecurity();
        
        // Parse cookies and check authentication
        const cookies = parseCookies(request);
        if (!isAuthenticatedFromCookie(cookies)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const leadsRef = db.collection(COLLECTIONS.WAITLIST_LEADS);
        const snapshot = await leadsRef.orderBy('created_at', 'desc').limit(100).get();

        const leads = snapshot.docs.map(doc => {
            const data = doc.data();
            let dateStr = 'Reciente';
            if (data.created_at) {
                // firebase-admin dates are usually Firebase Firestore Timestamps
                dateStr = data.created_at.toDate().toLocaleDateString();
            }

            return {
                id: doc.id,
                name: data.name || 'Desconocido',
                email: data.email || 'N/A',
                imr_score: data.estimated_imr || 'N/A',
                quiz_type: data.quiz_type || 'N/A',
                dateCompleted: dateStr
            };
        });

        return new Response(JSON.stringify({ success: true, leads }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error fetching leads via Admin API:", error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
};
