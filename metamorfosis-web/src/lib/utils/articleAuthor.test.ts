import { describe, it, expect } from 'vitest';
import { buildAuthorJsonLd, buildReviewerJsonLd } from './articleAuthor';

describe('buildAuthorJsonLd', () => {
    it('firma la marca como Organization con URL absoluta a /sobre-nosotros', () => {
        const a = buildAuthorJsonLd('https://metamorfosisvital.com.co');
        expect(a['@type']).toBe('Organization');
        expect(a.name).toBe('Equipo Metamorfosis Real');
        expect(a.url).toBe('https://metamorfosisvital.com.co/sobre-nosotros');
    });
});

describe('buildReviewerJsonLd', () => {
    it('sin revisor no genera nada (no se inventa revisión médica)', () => {
        expect(buildReviewerJsonLd(null)).toBeUndefined();
    });
    it('con revisor genera Person con credencial', () => {
        const r = buildReviewerJsonLd({ name: 'Dra. X', credential: 'Médica internista', url: 'https://x.co' });
        expect(r).toEqual({ '@type': 'Person', name: 'Dra. X', jobTitle: 'Médica internista', url: 'https://x.co' });
    });
});
