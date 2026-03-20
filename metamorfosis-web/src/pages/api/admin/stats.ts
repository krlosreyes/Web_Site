import type { APIRoute } from 'astro';
import { db } from '../../../lib/firebaseAdmin';
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
        // Total Posts
        const postsRef = db.collection('post');
        const postsCountSnap = await postsRef.count().get();
        const totalPosts = postsCountSnap.data().count;

        // Total Leads Capturados
        const leadsRef = db.collection('waitlist_leads');
        const leadsCountSnap = await leadsRef.count().get();
        const totalLeads = leadsCountSnap.data().count;

        return new Response(JSON.stringify({ 
            success: true, 
            totalPosts,
            totalLeads, 
            // Simulated conversion rate logic handled via React frontend since it animates
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error fetching stats via Admin API:", error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
};
