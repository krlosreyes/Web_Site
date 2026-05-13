/**
 * Funciones puras de agregación para el tablero de analítica de
 * artículos (SPEC-090).
 *
 * Separadas del endpoint para poder testearlas sin levantar
 * Firebase. El endpoint en `src/pages/api/admin/article-analytics.ts`
 * lee los docs crudos y delega los aggregates acá.
 */

export interface RawPost {
    id: string;
    title?: string;
    slug?: string;
    pillar?: string;
    status?: 'draft' | 'published';
    publishedAt?: string | null;
    analytics?: {
        views?: number;
        clicks?: number;
        conversions?: number;
    };
    quiz?: unknown[];
    // Resto de campos (content, images, references) los pasamos
    // through como `any` para que ArticleEditor los reciba en el
    // drilldown.
    [key: string]: unknown;
}

export interface RawUserQuizEntry {
    articleId: string;
    score: number;
    date?: string;
}

export interface RawUser {
    uid: string;
    email?: string;
    displayName?: string | null;
    completedQuizzes?: RawUserQuizEntry[];
}

export interface ArticleMetric {
    id: string;
    title: string;
    slug: string;
    pillar: string;
    status: 'draft' | 'published' | 'legacy';
    publishedAt: string | null;
    views: number;
    clicks: number;
    /** Porcentaje 0-100. -1 si views = 0 (no calculable). */
    engagementPct: number;
    quizCompletions: number;
    /** Promedio del score del quiz. -1 si no hay completions. */
    avgQuizScore: number;
    /** Pass-through del doc para drilldown al editor. */
    raw: RawPost;
}

export interface ReaderMetric {
    uid: string;
    email: string;
    displayName: string;
    articlesCompleted: number;
    avgScore: number;
}

export interface PillarMetric {
    pillar: string;
    views: number;
    clicks: number;
    articles: number;
}

export interface AnalyticsKpis {
    totalViews: number;
    totalClicks: number;
    totalQuizzes: number;
    articlesPublished: number;
    /** Porcentaje 0-100. 0 si no hay views. */
    globalEngagementPct: number;
}

export interface QuizFunnelMetrics {
    started: number;
    completed: number;
    registered: number;
    /** Empezaron quiz pero NO lo completaron. started - completed. */
    dropOffAtQuiz: number;
    /** Completaron quiz pero NO se registraron — el KPI clave de SPEC-093. */
    dropOffAtRegister: number;
    /** Conversion end-to-end: registered/started en %. -1 si started=0. */
    conversionPct: number;
    /** % de quienes empezaron que completaron el quiz. -1 si started=0. */
    completionPct: number;
    /** % de quienes completaron que se registraron. -1 si completed=0. */
    registerRatePct: number;
}

export interface AnalyticsResponse {
    kpis: AnalyticsKpis;
    quizFunnel: QuizFunnelMetrics;
    topArticles: ArticleMetric[];
    topReaders: ReaderMetric[];
    byPillar: PillarMetric[];
    zombies: { id: string; title: string; slug: string; publishedAt: string | null }[];
    withoutQuiz: { id: string; title: string; slug: string }[];
}

/** Resuelve el status del post (igual semantica que PostList). */
function resolveStatus(p: RawPost): 'draft' | 'published' | 'legacy' {
    if (p.status === 'draft') return 'draft';
    if (p.status === 'published') return 'published';
    return 'legacy';
}

/**
 * Indexa las entries `completedQuizzes` de TODOS los users por
 * articleId. Retorna `Map<articleId, { count, sumScore }>`.
 *
 * Útil para enriquecer cada post con su métrica de quiz en O(1)
 * después de un solo pass por users.
 */
export function indexQuizzesByArticle(
    users: RawUser[],
): Map<string, { count: number; sumScore: number }> {
    const map = new Map<string, { count: number; sumScore: number }>();
    for (const u of users) {
        const entries = u.completedQuizzes ?? [];
        for (const entry of entries) {
            if (!entry || typeof entry.articleId !== 'string') continue;
            const existing = map.get(entry.articleId) ?? { count: 0, sumScore: 0 };
            existing.count += 1;
            existing.sumScore += typeof entry.score === 'number' ? entry.score : 0;
            map.set(entry.articleId, existing);
        }
    }
    return map;
}

/**
 * Construye la métrica completa de un artículo combinando su
 * `analytics.*` con el índice de quizzes.
 *
 * `quizIndex` matchea por `slug` porque ARTICLE_QUIZZES guarda
 * `articleId` que en este proyecto es el slug del artículo (ver
 * /api/users/onboard y SPEC-024). Si en el futuro pasa a ser docId,
 * ajustar acá.
 */
export function buildArticleMetric(
    post: RawPost,
    quizIndex: Map<string, { count: number; sumScore: number }>,
): ArticleMetric {
    const views = post.analytics?.views ?? 0;
    const clicks = post.analytics?.clicks ?? 0;
    const engagementPct = views > 0 ? (clicks / views) * 100 : -1;

    const slug = post.slug ?? post.id;
    const quizStats = quizIndex.get(slug) ?? { count: 0, sumScore: 0 };
    const quizCompletions = quizStats.count;
    const avgQuizScore =
        quizCompletions > 0 ? quizStats.sumScore / quizCompletions : -1;

    return {
        id: post.id,
        title: typeof post.title === 'string' ? post.title : 'Untitled',
        slug,
        pillar: typeof post.pillar === 'string' ? post.pillar : 'sin-pilar',
        status: resolveStatus(post),
        publishedAt: post.publishedAt ?? null,
        views,
        clicks,
        engagementPct,
        quizCompletions,
        avgQuizScore,
        raw: post,
    };
}

/**
 * Top readers: ordena users por cantidad de quizzes completados
 * (desc), retorna los primeros N.
 */
export function buildTopReaders(users: RawUser[], topN = 10): ReaderMetric[] {
    const metrics = users
        .map<ReaderMetric>((u) => {
            const entries = u.completedQuizzes ?? [];
            const completed = entries.length;
            const sum = entries.reduce(
                (acc, e) => acc + (typeof e.score === 'number' ? e.score : 0),
                0,
            );
            const avg = completed > 0 ? sum / completed : 0;
            return {
                uid: u.uid,
                email: u.email ?? '',
                displayName: u.displayName ?? '',
                articlesCompleted: completed,
                avgScore: avg,
            };
        })
        .filter((m) => m.articlesCompleted > 0);
    metrics.sort((a, b) => {
        if (b.articlesCompleted !== a.articlesCompleted) {
            return b.articlesCompleted - a.articlesCompleted;
        }
        return b.avgScore - a.avgScore;
    });
    return metrics.slice(0, topN);
}

/**
 * Distribución por pilar: agrega vistas, clicks y count de
 * artículos por `pillar`. Posts sin pilar van a 'sin-pilar'.
 */
export function buildPillarBreakdown(posts: RawPost[]): PillarMetric[] {
    const map = new Map<string, PillarMetric>();
    for (const p of posts) {
        const pillar =
            typeof p.pillar === 'string' && p.pillar.length > 0
                ? p.pillar
                : 'sin-pilar';
        const existing =
            map.get(pillar) ??
            { pillar, views: 0, clicks: 0, articles: 0 };
        existing.views += p.analytics?.views ?? 0;
        existing.clicks += p.analytics?.clicks ?? 0;
        existing.articles += 1;
        map.set(pillar, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.views - a.views);
}

/** Lista de artículos publicados con 0 vistas (zombies). */
export function findZombies(posts: RawPost[]) {
    return posts
        .filter(
            (p) =>
                resolveStatus(p) === 'published' &&
                (p.analytics?.views ?? 0) === 0,
        )
        .map((p) => ({
            id: p.id,
            title: typeof p.title === 'string' ? p.title : 'Untitled',
            slug: p.slug ?? p.id,
            publishedAt: p.publishedAt ?? null,
        }));
}

/** Lista de artículos publicados sin quiz embebido. */
export function findWithoutQuiz(posts: RawPost[]) {
    return posts
        .filter((p) => {
            if (resolveStatus(p) !== 'published') return false;
            const quiz = Array.isArray(p.quiz) ? p.quiz : [];
            return quiz.length === 0;
        })
        .map((p) => ({
            id: p.id,
            title: typeof p.title === 'string' ? p.title : 'Untitled',
            slug: p.slug ?? p.id,
        }));
}

/**
 * Construye las métricas del funnel del quiz a partir del doc
 * `system/counters.quizFunnel`. Función pura.
 *
 * Tolerante a campos ausentes: si el counter aún no existe en
 * Firestore (caso pre-deploy de SPEC-093), todos los valores
 * arrancan en 0.
 */
export function buildQuizFunnel(
    rawCounter: Record<string, unknown> | null | undefined,
): QuizFunnelMetrics {
    const namespace = (rawCounter?.quizFunnel ?? {}) as Record<string, unknown>;
    const started = typeof namespace.started === 'number' ? namespace.started : 0;
    const completed = typeof namespace.completed === 'number' ? namespace.completed : 0;
    const registered = typeof namespace.registered === 'number' ? namespace.registered : 0;

    const dropOffAtQuiz = Math.max(0, started - completed);
    const dropOffAtRegister = Math.max(0, completed - registered);

    const conversionPct = started > 0 ? (registered / started) * 100 : -1;
    const completionPct = started > 0 ? (completed / started) * 100 : -1;
    const registerRatePct = completed > 0 ? (registered / completed) * 100 : -1;

    return {
        started,
        completed,
        registered,
        dropOffAtQuiz,
        dropOffAtRegister,
        conversionPct,
        completionPct,
        registerRatePct,
    };
}

/**
 * Pipeline completo: toma posts y users crudos y produce el
 * payload de respuesta. Función pura — fácil de testear.
 */
export function buildAnalyticsResponse(
    posts: RawPost[],
    users: RawUser[],
    rawCounter?: Record<string, unknown> | null,
): AnalyticsResponse {
    const quizIndex = indexQuizzesByArticle(users);
    const articleMetrics = posts.map((p) => buildArticleMetric(p, quizIndex));

    const totalViews = articleMetrics.reduce((acc, a) => acc + a.views, 0);
    const totalClicks = articleMetrics.reduce((acc, a) => acc + a.clicks, 0);
    const totalQuizzes = articleMetrics.reduce(
        (acc, a) => acc + a.quizCompletions,
        0,
    );
    const articlesPublished = articleMetrics.filter(
        (a) => a.status === 'published',
    ).length;
    const globalEngagementPct =
        totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

    // Top articles por views desc; los con 0 quedan al final por orden estable.
    const topArticles = [...articleMetrics].sort((a, b) => b.views - a.views);

    return {
        kpis: {
            totalViews,
            totalClicks,
            totalQuizzes,
            articlesPublished,
            globalEngagementPct,
        },
        quizFunnel: buildQuizFunnel(rawCounter ?? null),
        topArticles,
        topReaders: buildTopReaders(users, 10),
        byPillar: buildPillarBreakdown(posts),
        zombies: findZombies(posts),
        withoutQuiz: findWithoutQuiz(posts),
    };
}
