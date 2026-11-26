import { describe, it, expect } from 'vitest';
import { POST_SEO } from './seoOverrides';

const EMOJI = /\p{Extended_Pictographic}/u;

describe('POST_SEO', () => {
    for (const [slug, seo] of Object.entries(POST_SEO)) {
        it(`${slug}: título ≤ 50, descripción ≤ 155, sin emojis`, () => {
            expect(seo.title.length).toBeLessThanOrEqual(50);
            expect(seo.description.length).toBeLessThanOrEqual(155);
            expect(seo.description.length).toBeGreaterThanOrEqual(90);
            expect(EMOJI.test(seo.title + seo.description)).toBe(false);
        });
    }
    it('no hay títulos repetidos (canibalización)', () => {
        const titles = Object.values(POST_SEO).map((s) => s.title.toLowerCase());
        expect(new Set(titles).size).toBe(titles.length);
    });
});
