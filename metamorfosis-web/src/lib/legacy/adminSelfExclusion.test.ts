/**
 * Tests del helper de self-exclusion (SPEC-091).
 */

import { describe, test, expect } from 'vitest';
import {
    ADMIN_SELF_COOKIE,
    isSelfExcluded,
    readCookiesFromHeader,
    decideCookieAction,
} from './adminSelfExclusion';

const mockCookies = (jar: Record<string, string>) => ({
    get(name: string) {
        return name in jar ? { value: jar[name] } : undefined;
    },
});

describe('isSelfExcluded', () => {
    test('true cuando mr_admin_self === "1"', () => {
        const cookies = mockCookies({ [ADMIN_SELF_COOKIE]: '1' });
        expect(isSelfExcluded(cookies)).toBe(true);
    });

    test('false cuando mr_admin_self === "0"', () => {
        const cookies = mockCookies({ [ADMIN_SELF_COOKIE]: '0' });
        expect(isSelfExcluded(cookies)).toBe(false);
    });

    test('false cuando cookie ausente', () => {
        const cookies = mockCookies({});
        expect(isSelfExcluded(cookies)).toBe(false);
    });

    test('false con valores raros (defensa)', () => {
        expect(isSelfExcluded(mockCookies({ [ADMIN_SELF_COOKIE]: 'true' }))).toBe(false);
        expect(isSelfExcluded(mockCookies({ [ADMIN_SELF_COOKIE]: 'yes' }))).toBe(false);
        expect(isSelfExcluded(mockCookies({ [ADMIN_SELF_COOKIE]: '' }))).toBe(false);
    });
});

describe('readCookiesFromHeader', () => {
    test('parsea cookie header estándar', () => {
        const c = readCookiesFromHeader('mr_admin_self=1; other=foo');
        expect(c.get('mr_admin_self')).toEqual({ value: '1' });
        expect(c.get('other')).toEqual({ value: 'foo' });
    });

    test('retorna undefined para cookie ausente', () => {
        const c = readCookiesFromHeader('a=1; b=2');
        expect(c.get('missing')).toBeUndefined();
    });

    test('null header → reader vacío', () => {
        const c = readCookiesFromHeader(null);
        expect(c.get('anything')).toBeUndefined();
    });

    test('decode URI components', () => {
        const c = readCookiesFromHeader('encoded=hello%20world');
        expect(c.get('encoded')?.value).toBe('hello world');
    });

    test('tolera espacios y formato sucio', () => {
        const c = readCookiesFromHeader('  a=1 ;  b = 2  ; c=3');
        expect(c.get('a')?.value).toBe('1');
        expect(c.get('b')?.value).toBe('2');
        expect(c.get('c')?.value).toBe('3');
    });
});

describe('decideCookieAction', () => {
    test('?mr-admin=1 → set', () => {
        const params = new URLSearchParams('mr-admin=1');
        const action = decideCookieAction(params);
        expect(action.type).toBe('set');
        if (action.type === 'set') {
            expect(action.value).toBe('1');
            expect(action.maxAge).toBe(60 * 60 * 24 * 365);
        }
    });

    test('?mr-admin=0 → delete', () => {
        const params = new URLSearchParams('mr-admin=0');
        expect(decideCookieAction(params).type).toBe('delete');
    });

    test('sin mr-admin → noop', () => {
        const params = new URLSearchParams('foo=bar');
        expect(decideCookieAction(params).type).toBe('noop');
    });

    test('valor inesperado → noop (defensa)', () => {
        expect(decideCookieAction(new URLSearchParams('mr-admin=true')).type).toBe('noop');
        expect(decideCookieAction(new URLSearchParams('mr-admin=on')).type).toBe('noop');
        expect(decideCookieAction(new URLSearchParams('mr-admin=')).type).toBe('noop');
    });
});
