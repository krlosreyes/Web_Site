import { describe, it, expect } from 'vitest';
import { getRelated, HOME_FEATURED, TOPICS, toLink } from './relatedPosts';
import { POST_SEO } from './seoOverrides';

describe('relatedPosts', () => {
    it('todos los slugs de temas y portada existen en POST_SEO', () => {
        for (const s of [...HOME_FEATURED, ...Object.values(TOPICS).flat()]) expect(POST_SEO[s], s).toBeDefined();
    });
    it('cada artículo aparece en al menos un tema', () => {
        const inTopics = new Set(Object.values(TOPICS).flat());
        for (const s of Object.keys(POST_SEO)) expect(inTopics.has(s), s).toBe(true);
    });
    it('devuelve 3 relacionados distintos, sin el actual, del mismo tema primero', () => {
        for (const s of Object.keys(POST_SEO)) {
            const r = getRelated(s);
            expect(r).toHaveLength(3);
            expect(new Set(r.map((x) => x.slug)).size).toBe(3);
            expect(r.some((x) => x.slug === s)).toBe(false);
        }
        const r = getRelated('por-que-dormir-8-horas-no-es-lo-mismo-que-dormir-8-horas');
        expect(r[0].slug).toBe('por-que-te-sientes-como-un-zombi-aunque-dormiste-8-horas');
    });
    it('slug desconocido devuelve igual 3 enlaces', () => {
        expect(getRelated('no-existe')).toHaveLength(3);
        expect(getRelated(undefined)).toHaveLength(3);
    });
    it('toLink arma la URL del artículo', () => {
        expect(toLink(HOME_FEATURED[0])!.href).toBe(`/posts/${HOME_FEATURED[0]}`);
        expect(toLink('no-existe')).toBeNull();
    });
});
