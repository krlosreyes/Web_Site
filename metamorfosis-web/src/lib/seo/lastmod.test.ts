import { describe, it, expect } from 'vitest';
import { postLastmod, toIso } from './lastmod';

describe('postLastmod', () => {
    it('usa la revisión editorial si es más reciente que la publicación', () => {
        expect(postLastmod({ publishedAt: '2026-05-19T10:00:00Z', editorialRevision: 'spec-119' }, 'x')).toBe('2026-11-26');
    });
    it('usa la fecha más reciente entre publicación y actualización', () => {
        expect(postLastmod({ publishedAt: '2026-05-19', updatedAt: { _seconds: Date.UTC(2026, 9, 1) / 1000 } }, 'x')).toBe('2026-10-01');
    });
    it('ignora revisiones desconocidas y usa el respaldo si no hay fechas', () => {
        expect(postLastmod({ editorialRevision: 'otra' }, '2026-01-01')).toBe('2026-01-01');
    });
    it('toIso acepta Timestamp de Firestore', () => {
        expect(toIso({ toDate: () => new Date('2026-02-03T00:00:00Z') })).toBe('2026-02-03T00:00:00.000Z');
        expect(toIso('no es fecha')).toBeNull();
    });
});
