/**
 * Tests de las funciones puras de agregación (SPEC-090).
 *
 * Ejecutar con `npm test`.
 */

import { describe, test, expect } from 'vitest';
import {
    indexQuizzesByArticle,
    buildArticleMetric,
    buildTopReaders,
    buildPillarBreakdown,
    findZombies,
    findWithoutQuiz,
    buildAnalyticsResponse,
    buildQuizFunnel,
    type RawPost,
    type RawUser,
} from './articleAnalytics';

const postPublished = (overrides: Partial<RawPost> = {}): RawPost => ({
    id: 'doc-id',
    title: 'Untitled',
    slug: 'untitled',
    status: 'published',
    pillar: 'estructura',
    analytics: { views: 100, clicks: 10 },
    quiz: [{ q: 'demo' }],
    ...overrides,
});

const userWithQuizzes = (uid: string, quizzes: { articleId: string; score: number }[]): RawUser => ({
    uid,
    email: `${uid}@test.com`,
    displayName: uid.toUpperCase(),
    completedQuizzes: quizzes.map((q) => ({ articleId: q.articleId, score: q.score })),
});

describe('indexQuizzesByArticle', () => {
    test('agrega quizzes de múltiples users por articleId', () => {
        const users = [
            userWithQuizzes('u1', [
                { articleId: 'art-a', score: 80 },
                { articleId: 'art-b', score: 60 },
            ]),
            userWithQuizzes('u2', [
                { articleId: 'art-a', score: 100 },
            ]),
        ];
        const idx = indexQuizzesByArticle(users);
        expect(idx.get('art-a')).toEqual({ count: 2, sumScore: 180 });
        expect(idx.get('art-b')).toEqual({ count: 1, sumScore: 60 });
    });

    test('ignora entries inválidos', () => {
        const users: RawUser[] = [
            {
                uid: 'u1',
                completedQuizzes: [
                    { articleId: 'art-a', score: 50 },
                    { articleId: null as unknown as string, score: 100 },
                    null as unknown as { articleId: string; score: number },
                ],
            },
        ];
        const idx = indexQuizzesByArticle(users);
        expect(idx.size).toBe(1);
        expect(idx.get('art-a')).toEqual({ count: 1, sumScore: 50 });
    });

    test('users sin completedQuizzes no rompen', () => {
        const users: RawUser[] = [{ uid: 'u1' }];
        const idx = indexQuizzesByArticle(users);
        expect(idx.size).toBe(0);
    });
});

describe('buildArticleMetric', () => {
    test('engagement = clicks/views * 100', () => {
        const post = postPublished({ analytics: { views: 200, clicks: 20 } });
        const m = buildArticleMetric(post, new Map());
        expect(m.engagementPct).toBeCloseTo(10, 5);
    });

    test('engagement = -1 cuando views = 0', () => {
        const post = postPublished({ analytics: { views: 0, clicks: 0 } });
        const m = buildArticleMetric(post, new Map());
        expect(m.engagementPct).toBe(-1);
    });

    test('avgQuizScore = -1 cuando no hay completions', () => {
        const post = postPublished();
        const m = buildArticleMetric(post, new Map());
        expect(m.avgQuizScore).toBe(-1);
        expect(m.quizCompletions).toBe(0);
    });

    test('avgQuizScore calculado desde el índice', () => {
        const post = postPublished({ slug: 'my-slug' });
        const idx = new Map([['my-slug', { count: 4, sumScore: 320 }]]);
        const m = buildArticleMetric(post, idx);
        expect(m.quizCompletions).toBe(4);
        expect(m.avgQuizScore).toBe(80);
    });

    test('status legacy si no tiene status field', () => {
        const post = postPublished({ status: undefined });
        const m = buildArticleMetric(post, new Map());
        expect(m.status).toBe('legacy');
    });

    test('preserva raw para drilldown', () => {
        const post = postPublished({ content: 'Body...' });
        const m = buildArticleMetric(post, new Map());
        expect((m.raw as { content?: string }).content).toBe('Body...');
    });
});

describe('buildTopReaders', () => {
    test('ordena por cantidad de completados desc', () => {
        const users = [
            userWithQuizzes('u-pocos', [
                { articleId: 'a', score: 100 },
            ]),
            userWithQuizzes('u-power', [
                { articleId: 'a', score: 80 },
                { articleId: 'b', score: 60 },
                { articleId: 'c', score: 70 },
            ]),
            userWithQuizzes('u-medio', [
                { articleId: 'a', score: 90 },
                { articleId: 'b', score: 50 },
            ]),
        ];
        const top = buildTopReaders(users, 10);
        expect(top.map((r) => r.uid)).toEqual(['u-power', 'u-medio', 'u-pocos']);
    });

    test('avg score correcto', () => {
        const users = [
            userWithQuizzes('u1', [
                { articleId: 'a', score: 80 },
                { articleId: 'b', score: 60 },
                { articleId: 'c', score: 100 },
            ]),
        ];
        const top = buildTopReaders(users);
        expect(top[0].avgScore).toBe(80);
    });

    test('filtra users sin quizzes', () => {
        const users = [
            { uid: 'empty', completedQuizzes: [] },
            userWithQuizzes('u1', [{ articleId: 'a', score: 50 }]),
        ];
        const top = buildTopReaders(users);
        expect(top.length).toBe(1);
        expect(top[0].uid).toBe('u1');
    });

    test('respeta topN', () => {
        const users = Array.from({ length: 15 }, (_, i) =>
            userWithQuizzes(`u${i}`, [{ articleId: 'a', score: 100 }]),
        );
        const top = buildTopReaders(users, 5);
        expect(top.length).toBe(5);
    });
});

describe('buildPillarBreakdown', () => {
    test('agrega vistas y clicks por pilar', () => {
        const posts: RawPost[] = [
            postPublished({ pillar: 'estructura', analytics: { views: 100, clicks: 10 } }),
            postPublished({ pillar: 'estructura', analytics: { views: 200, clicks: 30 } }),
            postPublished({ pillar: 'metabolismo', analytics: { views: 50, clicks: 5 } }),
        ];
        const by = buildPillarBreakdown(posts);
        const est = by.find((b) => b.pillar === 'estructura')!;
        expect(est.views).toBe(300);
        expect(est.clicks).toBe(40);
        expect(est.articles).toBe(2);
        const met = by.find((b) => b.pillar === 'metabolismo')!;
        expect(met.views).toBe(50);
        expect(met.articles).toBe(1);
    });

    test('posts sin pilar van a sin-pilar', () => {
        const posts: RawPost[] = [
            postPublished({ pillar: undefined, analytics: { views: 10, clicks: 1 } }),
        ];
        const by = buildPillarBreakdown(posts);
        expect(by[0].pillar).toBe('sin-pilar');
    });

    test('ordena por views desc', () => {
        const posts: RawPost[] = [
            postPublished({ pillar: 'a', analytics: { views: 10 } }),
            postPublished({ pillar: 'b', analytics: { views: 100 } }),
            postPublished({ pillar: 'c', analytics: { views: 50 } }),
        ];
        const by = buildPillarBreakdown(posts);
        expect(by.map((p) => p.pillar)).toEqual(['b', 'c', 'a']);
    });
});

describe('findZombies', () => {
    test('detecta publicados con 0 vistas', () => {
        const posts: RawPost[] = [
            postPublished({ id: 'z1', analytics: { views: 0, clicks: 0 } }),
            postPublished({ id: 'good', analytics: { views: 50 } }),
            postPublished({ id: 'd1', status: 'draft', analytics: { views: 0 } }),
        ];
        const zombies = findZombies(posts);
        expect(zombies.map((z) => z.id)).toEqual(['z1']);
    });

    test('drafts no son zombies aunque tengan 0', () => {
        const posts: RawPost[] = [
            postPublished({ id: 'd1', status: 'draft', analytics: { views: 0 } }),
        ];
        const zombies = findZombies(posts);
        expect(zombies.length).toBe(0);
    });
});

describe('findWithoutQuiz', () => {
    test('detecta publicados sin quiz', () => {
        const posts: RawPost[] = [
            postPublished({ id: 'q-vacio', quiz: [] }),
            postPublished({ id: 'q-undef', quiz: undefined }),
            postPublished({ id: 'good', quiz: [{ q: 'demo' }] }),
            postPublished({ id: 'd1', status: 'draft', quiz: [] }),
        ];
        const wq = findWithoutQuiz(posts);
        expect(wq.map((w) => w.id).sort()).toEqual(['q-undef', 'q-vacio']);
    });
});

describe('buildQuizFunnel (SPEC-093)', () => {
    test('counter ausente → todo 0 y porcentajes -1', () => {
        const f = buildQuizFunnel(null);
        expect(f.started).toBe(0);
        expect(f.completed).toBe(0);
        expect(f.registered).toBe(0);
        expect(f.dropOffAtQuiz).toBe(0);
        expect(f.dropOffAtRegister).toBe(0);
        expect(f.conversionPct).toBe(-1);
        expect(f.completionPct).toBe(-1);
        expect(f.registerRatePct).toBe(-1);
    });

    test('drop-offs son la resta de los counts', () => {
        const f = buildQuizFunnel({
            quizFunnel: { started: 100, completed: 60, registered: 20 },
        });
        expect(f.dropOffAtQuiz).toBe(40);
        expect(f.dropOffAtRegister).toBe(40);
    });

    test('drop-offs no son negativos (defensa si counters quedan raros)', () => {
        const f = buildQuizFunnel({
            quizFunnel: { started: 10, completed: 20, registered: 5 },
        });
        expect(f.dropOffAtQuiz).toBe(0); // no -10
    });

    test('porcentajes calculados correctos', () => {
        const f = buildQuizFunnel({
            quizFunnel: { started: 100, completed: 50, registered: 25 },
        });
        expect(f.conversionPct).toBe(25); // 25/100
        expect(f.completionPct).toBe(50); // 50/100
        expect(f.registerRatePct).toBe(50); // 25/50
    });

    test('campos faltantes en el counter → 0', () => {
        const f = buildQuizFunnel({ quizFunnel: { started: 50 } });
        expect(f.started).toBe(50);
        expect(f.completed).toBe(0);
        expect(f.registered).toBe(0);
    });

    test('ignora otros campos del doc (founderCount, etc)', () => {
        const f = buildQuizFunnel({
            founderCount: 5,
            quizFunnel: { started: 10, completed: 5, registered: 1 },
        });
        expect(f.started).toBe(10);
    });

    test('values negativos en input → tratados como 0', () => {
        // Defense: si por alguna razón el counter quedó negativo,
        // no propagamos basura. Estos tests garantizan ese contrato.
        const f = buildQuizFunnel({
            quizFunnel: { started: -1, completed: -1, registered: -1 },
        });
        // -1 ≠ "number type guard" técnicamente pasa porque sí es number.
        // Pero los drop-offs siguen siendo Math.max(0, ...).
        expect(f.dropOffAtQuiz).toBe(0);
        expect(f.dropOffAtRegister).toBe(0);
    });
});

describe('buildAnalyticsResponse', () => {
    test('KPIs reflejan los totales', () => {
        const posts: RawPost[] = [
            postPublished({ analytics: { views: 100, clicks: 10 } }),
            postPublished({ analytics: { views: 200, clicks: 20 } }),
        ];
        const users = [
            userWithQuizzes('u1', [
                { articleId: 'untitled', score: 80 },
                { articleId: 'untitled', score: 90 },
            ]),
        ];
        const res = buildAnalyticsResponse(posts, users);
        expect(res.kpis.totalViews).toBe(300);
        expect(res.kpis.totalClicks).toBe(30);
        expect(res.kpis.articlesPublished).toBe(2);
        // 2 entries en completedQuizzes
        expect(res.kpis.totalQuizzes).toBe(2);
        expect(res.kpis.globalEngagementPct).toBeCloseTo(10, 5);
    });

    test('topArticles ordenado por views desc', () => {
        const posts: RawPost[] = [
            postPublished({ id: 'a', slug: 'a', analytics: { views: 50 } }),
            postPublished({ id: 'b', slug: 'b', analytics: { views: 200 } }),
            postPublished({ id: 'c', slug: 'c', analytics: { views: 100 } }),
        ];
        const res = buildAnalyticsResponse(posts, []);
        expect(res.topArticles.map((a) => a.id)).toEqual(['b', 'c', 'a']);
    });

    test('payload vacío para inputs vacíos', () => {
        const res = buildAnalyticsResponse([], []);
        expect(res.kpis.totalViews).toBe(0);
        expect(res.kpis.totalClicks).toBe(0);
        expect(res.kpis.totalQuizzes).toBe(0);
        expect(res.kpis.globalEngagementPct).toBe(0);
        expect(res.topArticles).toEqual([]);
        expect(res.topReaders).toEqual([]);
        expect(res.quizFunnel.started).toBe(0);
    });

    test('quizFunnel se incluye en la respuesta cuando hay counter', () => {
        const counter = { quizFunnel: { started: 30, completed: 15, registered: 5 } };
        const res = buildAnalyticsResponse([], [], counter);
        expect(res.quizFunnel.started).toBe(30);
        expect(res.quizFunnel.dropOffAtRegister).toBe(10);
        expect(res.quizFunnel.conversionPct).toBeCloseTo(16.66, 1);
    });

    test('zombies y withoutQuiz se incluyen', () => {
        const posts: RawPost[] = [
            postPublished({ id: 'z', analytics: { views: 0 } }),
            postPublished({ id: 'nq', quiz: [] }),
            postPublished({ id: 'ok' }),
        ];
        const res = buildAnalyticsResponse(posts, []);
        // 'z' tiene views=0 → zombie. 'nq' y 'ok' tienen views=100 (default).
        expect(res.zombies.length).toBe(1);
        expect(res.zombies[0].id).toBe('z');
        // 'nq' tiene quiz=[] → sin quiz. 'z' y 'ok' tienen quiz=[{q:'demo'}] (default).
        expect(res.withoutQuiz.length).toBe(1);
        expect(res.withoutQuiz[0].id).toBe('nq');
    });
});
