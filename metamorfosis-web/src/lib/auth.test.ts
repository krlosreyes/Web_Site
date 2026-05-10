/**
 * Tests del módulo auth (SPEC-020).
 *
 * Cubre:
 *   - parseCookies (header vacío, válido, multiple, URL-encoded, malformado)
 *   - isValidSessionValue / isAuthenticatedFromCookie
 *   - validatePasswordStrength
 *   - sanitizeInput (trim, cap, strip HTML)
 *   - isWithinRateLimit + resetRateLimit
 *   - verifyAdminPassword (con vi.stubEnv, incluido caso quotes envolventes)
 *
 * Notas:
 *   - Usamos `vi.stubEnv` para `import.meta.env` y `vi.unstubAllEnvs` en
 *     afterEach para no contaminar tests paralelos.
 *   - `isWithinRateLimit` mantiene un Map global; resetamos manualmente al
 *     final de cada test que lo usa.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    parseCookies,
    isValidSessionValue,
    isAuthenticatedFromCookie,
    validatePasswordStrength,
    sanitizeInput,
    isWithinRateLimit,
    resetRateLimit,
    getClientIp,
    verifyAdminPassword,
    SESSION_VALUE,
} from './auth';

const makeRequest = (headers: Record<string, string> = {}): Request => {
    return new Request('http://test/', { headers });
};

describe('parseCookies', () => {
    it('devuelve {} cuando no hay header cookie', () => {
        const req = makeRequest();
        expect(parseCookies(req)).toEqual({});
    });

    it('parsea una cookie simple', () => {
        const req = makeRequest({ cookie: 'admin_session=firebase_auth' });
        expect(parseCookies(req)).toEqual({ admin_session: 'firebase_auth' });
    });

    it('parsea múltiples cookies separadas por ;', () => {
        const req = makeRequest({
            cookie: 'admin_session=firebase_auth; theme=dark; lang=es',
        });
        expect(parseCookies(req)).toEqual({
            admin_session: 'firebase_auth',
            theme: 'dark',
            lang: 'es',
        });
    });

    it('decodifica URL-encoded en name y value', () => {
        const req = makeRequest({ cookie: 'foo%20bar=val%20ue' });
        expect(parseCookies(req)).toEqual({ 'foo bar': 'val ue' });
    });

    it('ignora cookies malformadas sin lanzar', () => {
        const req = makeRequest({ cookie: 'malformed; valid=ok; ; =empty' });
        const result = parseCookies(req);
        expect(result).toEqual({ valid: 'ok' });
    });
});

describe('isValidSessionValue', () => {
    it('rechaza undefined / null / vacío', () => {
        expect(isValidSessionValue(undefined)).toBe(false);
        expect(isValidSessionValue(null)).toBe(false);
        expect(isValidSessionValue('')).toBe(false);
    });

    it('acepta el SESSION_VALUE canónico', () => {
        expect(isValidSessionValue(SESSION_VALUE)).toBe(true);
        expect(isValidSessionValue('firebase_auth')).toBe(true);
    });

    it('rechaza valores de longitud distinta', () => {
        expect(isValidSessionValue('firebase_auth_x')).toBe(false);
        expect(isValidSessionValue('firebase')).toBe(false);
    });

    it('rechaza valores de misma longitud pero contenido distinto', () => {
        // 'firebase_auth' tiene 13 chars; 'firebase_outh' también
        expect(isValidSessionValue('firebase_outh')).toBe(false);
    });
});

describe('isAuthenticatedFromCookie', () => {
    it('autentica con cookie admin_session válida', () => {
        expect(isAuthenticatedFromCookie({ admin_session: 'firebase_auth' })).toBe(true);
    });

    it('rechaza sin admin_session', () => {
        expect(isAuthenticatedFromCookie({})).toBe(false);
        expect(isAuthenticatedFromCookie({ other: 'value' })).toBe(false);
    });

    it('rechaza admin_session con valor incorrecto', () => {
        expect(isAuthenticatedFromCookie({ admin_session: 'wrong' })).toBe(false);
    });
});

describe('validatePasswordStrength', () => {
    it('rechaza vacío', () => {
        expect(validatePasswordStrength('')).toEqual({
            isValid: false,
            error: 'Password is required',
        });
    });

    it('rechaza < 8 chars', () => {
        const result = validatePasswordStrength('1234567');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('8 characters');
    });

    it('acepta 8 chars exactos', () => {
        expect(validatePasswordStrength('12345678')).toEqual({ isValid: true });
    });

    it('acepta passwords largos', () => {
        expect(validatePasswordStrength('a'.repeat(50))).toEqual({ isValid: true });
    });
});

describe('sanitizeInput', () => {
    it('trim leading/trailing whitespace', () => {
        expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('cappea a 1000 chars', () => {
        const input = 'x'.repeat(1500);
        expect(sanitizeInput(input).length).toBe(1000);
    });

    it('remueve < y >', () => {
        expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    });
});

describe('isWithinRateLimit', () => {
    const TEST_IP = '10.0.0.99';
    afterEach(() => resetRateLimit(TEST_IP));

    it('permite el primer intento', () => {
        expect(isWithinRateLimit(TEST_IP)).toBe(true);
    });

    it('permite hasta maxAttempts intentos en la ventana', () => {
        for (let i = 0; i < 5; i++) {
            expect(isWithinRateLimit(TEST_IP, 5, 60000)).toBe(true);
        }
    });

    it('bloquea el intento N+1', () => {
        for (let i = 0; i < 5; i++) isWithinRateLimit(TEST_IP, 5, 60000);
        expect(isWithinRateLimit(TEST_IP, 5, 60000)).toBe(false);
    });

    it('resetRateLimit permite intentos nuevos', () => {
        for (let i = 0; i < 5; i++) isWithinRateLimit(TEST_IP, 5, 60000);
        resetRateLimit(TEST_IP);
        expect(isWithinRateLimit(TEST_IP, 5, 60000)).toBe(true);
    });
});

describe('getClientIp', () => {
    it('prefiere X-Forwarded-For', () => {
        const req = makeRequest({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' });
        expect(getClientIp(req)).toBe('203.0.113.1');
    });

    it('cae a CF-Connecting-IP si no hay X-Forwarded-For', () => {
        const req = makeRequest({ 'cf-connecting-ip': '198.51.100.42' });
        expect(getClientIp(req)).toBe('198.51.100.42');
    });

    it('cae a 127.0.0.1 cuando no hay headers', () => {
        const req = makeRequest();
        expect(getClientIp(req)).toBe('127.0.0.1');
    });
});

describe('verifyAdminPassword', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('devuelve false cuando ADMIN_PASSWORD no está set', () => {
        vi.stubEnv('ADMIN_PASSWORD', '');
        expect(verifyAdminPassword('anything')).toBe(false);
    });

    it('acepta password correcto', () => {
        vi.stubEnv('ADMIN_PASSWORD', 'super_secret_123');
        expect(verifyAdminPassword('super_secret_123')).toBe(true);
    });

    it('rechaza password incorrecto de misma longitud', () => {
        vi.stubEnv('ADMIN_PASSWORD', 'super_secret_123');
        expect(verifyAdminPassword('super_secret_124')).toBe(false);
    });

    it('rechaza password de longitud distinta', () => {
        vi.stubEnv('ADMIN_PASSWORD', 'super_secret_123');
        expect(verifyAdminPassword('short')).toBe(false);
    });

    it('strippea quotes envolventes en env (caso real hPanel)', () => {
        // hPanel guarda envs con quotes: ADMIN_PASSWORD="super_secret"
        vi.stubEnv('ADMIN_PASSWORD', '"super_secret_123"');
        expect(verifyAdminPassword('super_secret_123')).toBe(true);
        // Con quotes en el input NO debe matchear (los quotes son parte del valor)
        expect(verifyAdminPassword('"super_secret_123"')).toBe(false);
    });
});
