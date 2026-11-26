import { describe, it, expect } from 'vitest';
import { validateNewsletter, NEWSLETTER_CONSENT_VERSION } from './validate';

describe('validateNewsletter', () => {
    it('acepta correo válido con autorización', () => {
        const r = validateNewsletter({ email: '  Ana@Correo.co ', consent: true, source: 'post' });
        expect(r).toEqual({ ok: true, value: { email: 'ana@correo.co', source: 'post', consentVersion: NEWSLETTER_CONSENT_VERSION } });
    });
    it('rechaza sin autorización explícita', () => {
        expect(validateNewsletter({ email: 'a@b.co', consent: 'true' }).ok).toBe(false);
        expect(validateNewsletter({ email: 'a@b.co' }).ok).toBe(false);
    });
    it('rechaza correos inválidos', () => {
        for (const email of ['', 'sin-arroba', 'a@b', 'a b@c.co', 'x'.repeat(250) + '@b.co']) {
            expect(validateNewsletter({ email, consent: true }).ok).toBe(false);
        }
    });
    it('usa home si el origen no es conocido', () => {
        const r = validateNewsletter({ email: 'a@b.co', consent: true, source: 'hack' });
        expect(r.ok && r.value.source).toBe('home');
    });
    it('rechaza cuerpos que no son objeto', () => {
        expect(validateNewsletter(null).ok).toBe(false);
        expect(validateNewsletter('x').ok).toBe(false);
    });
});
