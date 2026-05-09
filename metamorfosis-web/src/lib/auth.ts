/**
 * Authentication & Security Layer
 * Secure admin authentication with constant-time comparison and session management
 */

/**
 * Constant-time string comparison to prevent timing attacks
 * @param a First string to compare
 * @param b Second string to compare
 * @returns true if strings are equal, false otherwise
 */
function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/**
 * Generate a secure session token using Web Crypto API
 * @returns Base64-encoded secure random token
 */
async function generateSecureToken(): Promise<string> {
    const buffer = new Uint8Array(32);
    crypto.getRandomValues(buffer);
    return Array.from(buffer, byte => String.fromCharCode(byte)).join('')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 32);
}

/**
 * Hash a value using Web Crypto SHA-256
 * @param value Value to hash
 * @returns Hex-encoded hash
 */
async function hashValue(value: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify admin password using constant-time comparison
 * @param inputPassword Password provided by user
 * @returns true if password matches environment variable, false otherwise
 */
export function verifyAdminPassword(inputPassword: string): boolean {
    const envPassword = import.meta.env.ADMIN_PASSWORD;
    
    // Fail securely if environment variable is not set
    if (!envPassword) {
        console.warn('[Auth] ADMIN_PASSWORD not set in environment');
        return false;
    }
    
    // Use constant-time comparison to prevent timing attacks
    let envPass = envPassword;
    if (envPass.startsWith('"') && envPass.endsWith('"')) {
        envPass = envPass.slice(1, -1);
    }
    return constantTimeCompare(inputPassword, envPass);
}

/**
 * Opaque value emitted by /api/admin/login.ts and validated everywhere else.
 * NEVER ponemos el ADMIN_PASSWORD raw en la cookie — el servidor emite un valor
 * fijo que actúa solo como "tengo sesión válida". Si en el futuro queremos
 * sesiones rotables, cambiamos el contrato acá (a un JWT firmado, por ejemplo).
 */
export const SESSION_VALUE = 'firebase_auth';

/**
 * Check if request is authenticated via session cookie
 * @param cookies Cookie object from request
 * @returns true if session is valid, false otherwise
 */
export function isAuthenticatedFromCookie(cookies: Record<string, string>): boolean {
    return isValidSessionValue(cookies['admin_session']);
}

/**
 * Sugar para callers que ya tienen el valor crudo de la cookie (típicamente
 * desde `Astro.cookies.get("admin_session")?.value`).
 */
export function isValidSessionValue(value: string | undefined | null): boolean {
    if (!value) return false;
    return constantTimeCompare(value, SESSION_VALUE);
}

/**
 * Extract cookies from request headers
 * @param request Astro request object
 * @returns Object with cookie key-value pairs
 */
export function parseCookies(request: Request): Record<string, string> {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies: Record<string, string> = {};
    
    cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
            cookies[decodeURIComponent(name)] = decodeURIComponent(value);
        }
    });
    
    return cookies;
}

/**
 * Create a secure session cookie string
 * @returns Cookie string with secure flags
 */
export function createSecureSessionCookie(value: string = 'admin_authenticated'): string {
    const isProduction = import.meta.env.PROD;
    
    // Base cookie
    let cookie = `admin_session=${encodeURIComponent(value)}`;
    
    // Add path
    cookie += '; Path=/';
    
    // Add secure flag only in production (HTTPS)
    if (isProduction) {
        cookie += '; Secure';
    }
    
    // HttpOnly: prevent JavaScript access (essential for security)
    cookie += '; HttpOnly';
    
    // SameSite: prevent CSRF attacks
    cookie += '; SameSite=Strict';
    
    // Set expiry: 24 hours from now
    const expiryDate = new Date();
    expiryDate.setTime(expiryDate.getTime() + (24 * 60 * 60 * 1000));
    cookie += `; Expires=${expiryDate.toUTCString()}`;
    
    return cookie;
}

/**
 * Create a logout cookie (expires immediately)
 * @returns Cookie string that expires the session
 */
export function createLogoutCookie(): string {
    const pastDate = new Date(0); // Epoch time
    return `admin_session=; Path=/; HttpOnly; SameSite=Strict; Expires=${pastDate.toUTCString()}`;
}

/**
 * In-memory rate limiting store (consider using Redis in production)
 * Maps IP addresses to timestamps of failed login attempts
 */
const loginAttempts = new Map<string, number[]>();

/**
 * Check if an IP address has exceeded rate limit
 * @param ip IP address to check
 * @param maxAttempts Maximum attempts allowed (default: 5)
 * @param windowMs Time window in milliseconds (default: 60000 = 1 minute)
 * @returns true if within limit, false if exceeded
 */
export function isWithinRateLimit(
    ip: string,
    maxAttempts: number = 5,
    windowMs: number = 60000
): boolean {
    const now = Date.now();
    const attempts = loginAttempts.get(ip) || [];
    
    // Remove attempts outside the time window
    const validAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    // Update the map
    if (validAttempts.length >= maxAttempts) {
        // Update timestamps (add current for next check)
        loginAttempts.set(ip, validAttempts);
        return false; // Rate limit exceeded
    }
    
    // Add current attempt
    validAttempts.push(now);
    loginAttempts.set(ip, validAttempts);
    
    return true; // Within rate limit
}

/**
 * Reset rate limit for an IP (call after successful login)
 * @param ip IP address to reset
 */
export function resetRateLimit(ip: string): void {
    loginAttempts.delete(ip);
}

/**
 * Get IP address from request
 * @param request Request object
 * @returns IP address string
 */
export function getClientIp(request: Request): string {
    // Try to get from X-Forwarded-For header first (proxy/CDN)
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    
    // Fallback to connection IP
    return request.headers.get('cf-connecting-ip') || '127.0.0.1';
}

/**
 * Validate password strength
 * @param password Password to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validatePasswordStrength(password: string): { isValid: boolean; error?: string } {
    if (!password || password.length === 0) {
        return { isValid: false, error: 'Password is required' };
    }
    
    if (password.length < 8) {
        return { isValid: false, error: 'Password must be at least 8 characters' };
    }
    
    return { isValid: true };
}

/**
 * Sanitize input to prevent injection attacks
 * @param input User input to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
    return input
        .trim()
        .slice(0, 1000) // Limit length
        .replace(/[<>]/g, ''); // Remove potential HTML/injection chars
}

/**
 * Check if environment is production
 * @returns true if in production, false otherwise
 */
export function isProduction(): boolean {
    return import.meta.env.PROD || import.meta.env.MODE === 'production';
}

/**
 * Enforce production security requirements
 * Throws error if ADMIN_PASSWORD is not set in production
 */
export function enforceProductionSecurity(): void {
    if (isProduction() && !import.meta.env.ADMIN_PASSWORD) {
        throw new Error(
            'ADMIN_PASSWORD must be defined in production. ' +
            'Set it as an environment variable before deploying.'
        );
    }
}
