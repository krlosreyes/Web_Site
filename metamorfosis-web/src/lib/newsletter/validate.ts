/**
 * SPEC-119: validación de la suscripción al boletín quincenal.
 * Función pura (sin Firebase) para poder testearla.
 */

/** Versión del texto de autorización que vio la persona (Ley 1581 de 2012). */
export const NEWSLETTER_CONSENT_VERSION = 'nl-2026-11-26';

export const NEWSLETTER_CONSENT_TEXT =
    'Autorizo a Metamorfosis Real a usar mi correo para enviarme el boletín quincenal, según la política de privacidad. Puedo darme de baja cuando quiera.';

export const NEWSLETTER_SOURCES = ['home', 'post', 'calculadora', 'imr', 'footer'] as const;
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type NewsletterInput = {
    email: string;
    source: NewsletterSource;
    consentVersion: string;
};

export type NewsletterValidation =
    | { ok: true; value: NewsletterInput }
    | { ok: false; error: string };

export function validateNewsletter(body: unknown): NewsletterValidation {
    if (!body || typeof body !== 'object') return { ok: false, error: 'Solicitud inválida.' };
    const b = body as Record<string, unknown>;

    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
        return { ok: false, error: 'Escribe un correo válido.' };
    }
    if (b.consent !== true) {
        return { ok: false, error: 'Necesitamos tu autorización para enviarte el boletín.' };
    }
    const source = (NEWSLETTER_SOURCES as readonly string[]).includes(b.source as string)
        ? (b.source as NewsletterSource)
        : 'home';

    return { ok: true, value: { email, source, consentVersion: NEWSLETTER_CONSENT_VERSION } };
}
