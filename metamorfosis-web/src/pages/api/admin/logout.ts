/**
 * Admin Logout Endpoint
 * Clear admin session cookie
 */

import type { APIRoute } from 'astro';
import { createLogoutCookie } from '../../../lib/auth';

export const prerender = false;

/**
 * POST /api/admin/logout
 * Invalidate admin session
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        // Only allow POST
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        const logoutCookie = createLogoutCookie();

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Logout successful',
                redirect: '/admin/login',
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': logoutCookie,
                },
            }
        );
        
    } catch (error) {
        console.error('[Auth] Logout endpoint error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
