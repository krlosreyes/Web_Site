import { describe, expect, test } from 'vitest';
import { getCanonicalRedirect, LEGACY_POST_REDIRECTS } from './canonicalRedirect';

const SITE = new URL('https://metamorfosisvital.com.co');
const base = {
    forwardedHost: null as string | null,
    host: 'metamorfosisvital.com.co' as string | null,
    method: 'GET',
    pathname: '/biblioteca',
    search: '',
    site: SITE,
};
const run = (over: Partial<typeof base> = {}) => getCanonicalRedirect({ ...base, ...over });

describe('getCanonicalRedirect', () => {
    test('request ya canónica → null', () => {
        expect(run()).toBeNull();
        expect(run({ pathname: '/' })).toBeNull();
    });

    test('www → apex, preservando path y query', () => {
        expect(run({ host: 'www.metamorfosisvital.com.co', pathname: '/biblioteca', search: '?pilar=sueno' }))
            .toBe('https://metamorfosisvital.com.co/biblioteca?pilar=sueno');
    });

    test('x-forwarded-host tiene prioridad sobre host', () => {
        expect(run({ forwardedHost: 'www.metamorfosisvital.com.co', host: 'localhost:4321' }))
            .toBe('https://metamorfosisvital.com.co/biblioteca');
    });

    test('x-forwarded-host en lista y con puerto', () => {
        expect(run({ forwardedHost: 'WWW.metamorfosisvital.com.co:443, proxy.internal', host: null }))
            .toBe('https://metamorfosisvital.com.co/biblioteca');
    });

    test('sin headers de host → no redirige (no puede haber bucle)', () => {
        expect(run({ host: null, forwardedHost: null })).toBeNull();
    });

    test('host ajeno (localhost) → no redirige', () => {
        expect(run({ host: 'localhost:4321' })).toBeNull();
    });

    test('barra final → sin barra, en un solo salto con www', () => {
        expect(run({ pathname: '/biblioteca/' })).toBe('https://metamorfosisvital.com.co/biblioteca');
        expect(run({ host: 'www.metamorfosisvital.com.co', pathname: '/quiz/' }))
            .toBe('https://metamorfosisvital.com.co/quiz');
        expect(run({ pathname: '/quiz///' })).toBe('https://metamorfosisvital.com.co/quiz');
    });

    test('raíz "/" nunca pierde su barra', () => {
        expect(run({ host: 'www.metamorfosisvital.com.co', pathname: '/' }))
            .toBe('https://metamorfosisvital.com.co/');
    });

    test('slug legacy → slug vigente (con y sin barra, con y sin www)', () => {
        const target = `https://metamorfosisvital.com.co/posts/${LEGACY_POST_REDIRECTS['que-pasa-cuerpo-16-horas-autofagia']}`;
        expect(run({ pathname: '/posts/que-pasa-cuerpo-16-horas-autofagia/' })).toBe(target);
        expect(run({ pathname: '/posts/que-pasa-cuerpo-16-horas-autofagia' })).toBe(target);
        expect(run({ host: 'www.metamorfosisvital.com.co', pathname: '/posts/que-pasa-cuerpo-16-horas-autofagia/' })).toBe(target);
    });

    test('slug no legacy no se toca', () => {
        expect(run({ pathname: '/posts/otro-articulo' })).toBeNull();
    });

    test('métodos no idempotentes no se redirigen (preserva body de POST /api)', () => {
        expect(run({ method: 'POST', host: 'www.metamorfosisvital.com.co', pathname: '/api/leads/' })).toBeNull();
        expect(run({ method: 'DELETE', pathname: '/api/admin/posts/' })).toBeNull();
    });

    test('HEAD sí se redirige', () => {
        expect(run({ method: 'HEAD', pathname: '/quiz/' })).toBe('https://metamorfosisvital.com.co/quiz');
    });

    test('destino siempre es el origen de site, no el host recibido', () => {
        const r = run({ host: 'www.metamorfosisvital.com.co' });
        expect(r?.startsWith('https://metamorfosisvital.com.co/')).toBe(true);
    });
});
