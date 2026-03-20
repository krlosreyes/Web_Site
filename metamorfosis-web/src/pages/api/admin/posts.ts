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
        
        const postsRef = db.collection('post');
        // Fetch up to 50 recent posts
        const snapshot = await postsRef.limit(50).get();

        const posts = snapshot.docs.map(doc => {
            const data = doc.data();
            
            // Mocking metrics similarly to before if they don't exist
            const mockViews = Math.floor(Math.random() * 5000) + 500;
            const mockClicks = Math.floor(mockViews * (Math.random() * 0.3 + 0.1));
            const mockConversions = Math.floor(mockClicks * (Math.random() * 0.1 + 0.02));

            return {
                id: doc.id,
                title: data.metadata?.title || data.title || 'Untitled',
                slug: data.metadata?.slug || data.slug || doc.id,
                views: data.analytics?.views || mockViews,
                clicks: data.analytics?.clicks || mockClicks,
                conversions: data.analytics?.conversions || mockConversions,
            };
        });

        // Backend sort by views
        posts.sort((a, b) => b.views - a.views);

        return new Response(JSON.stringify({ success: true, posts }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error fetching posts via Admin API:", error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
    }
};
