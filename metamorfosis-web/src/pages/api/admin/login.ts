/**
 * Admin Login Endpoint
 * Secure password validation with rate limiting and session management
 */

import type { APIRoute } from 'astro';
import {
    verifyAdminPassword,
    createSecureSessionCookie,
    isWithinRateLimit,
    resetRateLimit,
    getClientIp,
    sanitizeInput,
    validatePasswordStrength,
    enforceProductionSecurity,
} from '../../../lib/auth';

export const prerender = false;

/**
 * POST /api/admin/login
 * Accept password and create secure session cookie
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        // Enforce production security
        enforceProductionSecurity();
        
        // Only allow POST
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // Get client IP for rate limiting
        const clientIp = getClientIp(request);
        
        // Check rate limit
        if (!isWithinRateLimit(clientIp, 5, 60000)) {
            console.warn(`[Auth] Rate limit exceeded for IP: ${clientIp}`);
            return new Response(
                JSON.stringify({
                    error: 'Too many login attempts. Please try again in 1 minute.',
                }),
                {
                    status: 429,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }
        
        // Parse request body
        let body: any;
        try {
            body = await request.json();
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // Validate input
        const { password } = body;
        
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            return new Response(
                JSON.stringify({ error: passwordValidation.error }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }
        
        // Sanitize input
        const sanitizedPassword = sanitizeInput(password);
        
        // Verify password (constant-time comparison)
        if (!verifyAdminPassword(sanitizedPassword)) {
            console.warn(`[Auth] Failed login attempt from IP: ${clientIp}`);
            return new Response(
                JSON.stringify({ error: 'Invalid credentials' }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }
        
        // Password is correct - reset rate limit and create session
        resetRateLimit(clientIp);
        
        const sessionCookie = createSecureSessionCookie('firebase_auth');
        
        console.log(`[Auth] Successful login from IP: ${clientIp}`);
        
        return new Response(
            JSON.stringify({
                success: true,
                message: 'Login successful',
                redirect: '/admin/dashboard',
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': sessionCookie,
                },
            }
        );
        
    } catch (error) {
        console.error('[Auth] Login endpoint error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};
