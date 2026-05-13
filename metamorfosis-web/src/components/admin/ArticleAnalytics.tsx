import React, { useEffect, useMemo, useState } from 'react';
import type {
    AnalyticsResponse,
    ArticleMetric,
} from '../../lib/admin/articleAnalytics';

/**
 * ArticleAnalytics — tablero de KPIs editoriales (SPEC-090).
 *
 * Fetch único al montar contra `/api/admin/article-analytics`. Todo el
 * sort y filtros son client-side (data ya está agregada server-side).
 */

interface ArticleAnalyticsProps {
    onEditArticle?: (article: unknown) => void;
}

type SortKey = 'views' | 'clicks' | 'engagement' | 'quizzes' | 'avgQuizScore';

const STATUS_META: Record<
    string,
    { emoji: string; label: string; classes: string }
> = {
    published: {
        emoji: '🟢',
        label: 'Publicado',
        classes: 'bg-accent/10 text-accent border-accent/30',
    },
    draft: {
        emoji: '🟡',
        label: 'Borrador',
        classes: 'bg-status-warn/10 text-status-warn border-status-warn/30',
    },
    legacy: {
        emoji: '⚪',
        label: 'Legacy',
        classes: 'bg-white/[0.04] text-text-muted border-white/[0.1]',
    },
};

const PILLAR_LABELS: Record<string, string> = {
    estructura: 'Estructura',
    metabolismo: 'Metabolismo',
    conducta: 'Conducta',
    'sin-pilar': 'Sin pilar',
};

const formatPct = (pct: number): string => {
    if (pct < 0) return '—';
    return `${pct.toFixed(1)}%`;
};

const formatNum = (n: number): string => {
    if (n === 0) return '—';
    return n.toLocaleString('es-ES');
};

const ArticleAnalytics: React.FC<ArticleAnalyticsProps> = ({ onEditArticle }) => {
    const [data, setData] = useState<AnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [pillarFilter, setPillarFilter] = useState<string>('todos');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [sortKey, setSortKey] = useState<SortKey>('views');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/article-analytics');
                if (res.status === 401) {
                    window.location.href = '/admin/login';
                    return;
                }
                if (!res.ok) throw new Error('Error de conexión a la API');
                const json = await res.json();
                if (!json.success) throw new Error(json.error || 'Error');
                setData(json as AnalyticsResponse);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error desconocido');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredAndSorted = useMemo<ArticleMetric[]>(() => {
        if (!data) return [];
        const filtered = data.topArticles.filter((a) => {
            if (pillarFilter !== 'todos' && a.pillar !== pillarFilter) return false;
            if (statusFilter !== 'todos' && a.status !== statusFilter) return false;
            return true;
        });
        return [...filtered].sort((a, b) => {
            switch (sortKey) {
                case 'views':
                    return b.views - a.views;
                case 'clicks':
                    return b.clicks - a.clicks;
                case 'engagement':
                    return b.engagementPct - a.engagementPct;
                case 'quizzes':
                    return b.quizCompletions - a.quizCompletions;
                case 'avgQuizScore':
                    return b.avgQuizScore - a.avgQuizScore;
                default:
                    return 0;
            }
        });
    }, [data, pillarFilter, statusFilter, sortKey]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px] bg-bg-surface border border-white/[0.06] rounded-xl">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-7 h-7 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <span className="text-xs text-text-muted font-medium">
                        Cargando analítica…
                    </span>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-status-bad/10 border border-status-bad/30 rounded-xl p-6">
                <p className="text-status-bad font-semibold">⚠️ Error al cargar la analítica</p>
                <p className="text-text-secondary text-sm mt-1">{error}</p>
            </div>
        );
    }

    const sortBtn = (key: SortKey, label: string) => (
        <button
            onClick={() => setSortKey(key)}
            className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-colors ${
                sortKey === key
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text-primary'
            }`}
        >
            {label} {sortKey === key ? '▼' : ''}
        </button>
    );

    return (
        <div className="space-y-8 pb-20">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Vistas totales" value={data.kpis.totalViews.toLocaleString('es-ES')} />
                <KpiCard label="Clicks en CTA" value={data.kpis.totalClicks.toLocaleString('es-ES')} />
                <KpiCard
                    label="Engagement global"
                    value={formatPct(data.kpis.globalEngagementPct)}
                    accent
                />
                <KpiCard
                    label="Quizzes completados"
                    value={data.kpis.totalQuizzes.toLocaleString('es-ES')}
                />
            </div>

            {/* SPEC-093: Funnel del quiz IMR. Antes del top de artículos
                porque es el indicador clave de conversión del sitio. */}
            <section className="bg-bg-surface border border-white/[0.06] rounded-xl p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
                    <h3 className="text-sm font-bold tracking-widest uppercase text-text-secondary">
                        Funnel del quiz IMR
                    </h3>
                    <span className="text-[10px] text-text-muted">
                        Conversión global:{' '}
                        <span className="text-text-primary font-semibold">
                            {formatPct(data.quizFunnel.conversionPct)}
                        </span>
                    </span>
                </div>

                {/* Barra visual de los 3 escalones */}
                <FunnelBar funnel={data.quizFunnel} />

                {/* 3 KPIs del funnel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
                    <FunnelStep
                        label="1. Iniciaron quiz"
                        value={data.quizFunnel.started}
                        sublabel="Click 'Iniciar mi diagnóstico'"
                    />
                    <FunnelStep
                        label="2. Completaron quiz"
                        value={data.quizFunnel.completed}
                        sublabel={`${formatPct(data.quizFunnel.completionPct)} de los que iniciaron`}
                    />
                    <FunnelStep
                        label="3. Se registraron"
                        value={data.quizFunnel.registered}
                        sublabel={`${formatPct(data.quizFunnel.registerRatePct)} de los que completaron`}
                        accent
                    />
                </div>

                {/* Cards de abandono — el indicador clave que pidió SPEC-093 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="bg-status-warn/[0.06] border border-status-warn/30 rounded-lg p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-status-warn mb-1">
                            Abandono durante el quiz
                        </p>
                        <p className="text-2xl font-bold text-text-primary">
                            {data.quizFunnel.dropOffAtQuiz}
                        </p>
                        <p className="text-[11px] text-text-secondary mt-1">
                            Empezaron pero NO completaron las preguntas.
                        </p>
                    </div>
                    <div className="bg-status-bad/[0.08] border border-status-bad/30 rounded-lg p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-status-bad mb-1">
                            Abandono pre-registro
                        </p>
                        <p className="text-2xl font-bold text-text-primary">
                            {data.quizFunnel.dropOffAtRegister}
                        </p>
                        <p className="text-[11px] text-text-secondary mt-1">
                            Completaron quiz pero NO crearon cuenta.
                        </p>
                    </div>
                </div>

                {data.quizFunnel.started === 0 && (
                    <p className="text-[11px] text-text-muted mt-4 text-center">
                        Aún no hay datos del funnel. Empieza a contar tras el primer click en "Iniciar mi diagnóstico".
                    </p>
                )}
            </section>

            {/* Distribución por pilar */}
            <section className="bg-bg-surface border border-white/[0.06] rounded-xl p-6">
                <h3 className="text-sm font-bold tracking-widest uppercase text-text-secondary mb-6">
                    Distribución por pilar
                </h3>
                <div className="space-y-3">
                    {data.byPillar.map((p) => {
                        const max = Math.max(...data.byPillar.map((x) => x.views), 1);
                        const widthPct = (p.views / max) * 100;
                        return (
                            <div key={p.pillar} className="flex items-center gap-4">
                                <div className="w-32 text-xs font-medium text-text-primary shrink-0">
                                    {PILLAR_LABELS[p.pillar] ?? p.pillar}
                                </div>
                                <div className="flex-1 h-7 bg-bg-base/60 rounded-md overflow-hidden relative">
                                    <div
                                        className="h-full bg-accent/30 border-r border-accent transition-all"
                                        style={{ width: `${widthPct}%` }}
                                    />
                                    <div className="absolute inset-0 flex items-center px-3 text-[11px] font-mono text-text-primary">
                                        {p.views.toLocaleString('es-ES')} vistas · {p.clicks.toLocaleString('es-ES')} clicks · {p.articles} artículos
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Filtros + tabla principal */}
            <section className="bg-bg-surface border border-white/[0.06] rounded-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <h3 className="text-sm font-bold tracking-widest uppercase text-text-secondary">
                        Top artículos
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={pillarFilter}
                            onChange={(e) => setPillarFilter(e.target.value)}
                            className="bg-bg-base/60 border border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
                        >
                            <option value="todos">Todos los pilares</option>
                            <option value="estructura">Estructura</option>
                            <option value="metabolismo">Metabolismo</option>
                            <option value="conducta">Conducta</option>
                            <option value="sin-pilar">Sin pilar</option>
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-bg-base/60 border border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-text-primary focus:border-accent outline-none"
                        >
                            <option value="todos">Cualquier estado</option>
                            <option value="published">Publicados</option>
                            <option value="draft">Borradores</option>
                            <option value="legacy">Legacy</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted mr-2 py-1">
                        Ordenar por:
                    </span>
                    {sortBtn('views', 'Vistas')}
                    {sortBtn('clicks', 'Clicks')}
                    {sortBtn('engagement', 'Engagement')}
                    {sortBtn('quizzes', 'Quizzes')}
                    {sortBtn('avgQuizScore', 'Score promedio')}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-text-secondary">
                        <thead className="text-[10px] text-text-muted uppercase tracking-widest border-b border-white/[0.06]">
                            <tr>
                                <th className="px-3 py-3">Título</th>
                                <th className="px-3 py-3">Pilar</th>
                                <th className="px-3 py-3">Estado</th>
                                <th className="px-3 py-3 text-right">Vistas</th>
                                <th className="px-3 py-3 text-right">Clicks</th>
                                <th className="px-3 py-3 text-right">Engagement</th>
                                <th className="px-3 py-3 text-right">Quizzes</th>
                                <th className="px-3 py-3 text-right">Score prom.</th>
                                <th className="px-3 py-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSorted.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-3 py-8 text-center text-text-muted">
                                        Sin artículos para los filtros activos.
                                    </td>
                                </tr>
                            )}
                            {filteredAndSorted.map((a) => {
                                const meta = STATUS_META[a.status];
                                return (
                                    <tr
                                        key={a.id}
                                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                                    >
                                        <td className="px-3 py-3 max-w-md">
                                            <div className="font-medium text-text-primary line-clamp-1">
                                                {a.title}
                                            </div>
                                            <div className="text-[10px] text-text-muted font-mono mt-0.5 truncate">
                                                /{a.slug}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-xs">
                                            {PILLAR_LABELS[a.pillar] ?? a.pillar}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span
                                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${meta.classes}`}
                                            >
                                                {meta.emoji} {meta.label}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono text-xs">
                                            {formatNum(a.views)}
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono text-xs text-accent">
                                            {formatNum(a.clicks)}
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono text-xs">
                                            {formatPct(a.engagementPct)}
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono text-xs">
                                            {formatNum(a.quizCompletions)}
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono text-xs">
                                            {a.avgQuizScore < 0
                                                ? '—'
                                                : `${a.avgQuizScore.toFixed(0)}%`}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <button
                                                onClick={() => onEditArticle?.(a.raw)}
                                                className="text-[10px] font-bold uppercase tracking-widest border border-accent/30 px-2 py-1 rounded text-accent hover:bg-accent/10 transition-colors"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="text-[10px] text-text-muted mt-4">
                    Mostrando {filteredAndSorted.length} de {data.topArticles.length} artículos
                </p>
            </section>

            {/* Top readers + listas accionables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top readers */}
                <section className="bg-bg-surface border border-white/[0.06] rounded-xl p-6">
                    <h3 className="text-sm font-bold tracking-widest uppercase text-text-secondary mb-5">
                        Top lectores
                    </h3>
                    {data.topReaders.length === 0 ? (
                        <p className="text-text-muted text-sm">
                            Aún no hay quizzes completados.
                        </p>
                    ) : (
                        <table className="w-full text-left text-sm text-text-secondary">
                            <thead className="text-[10px] text-text-muted uppercase tracking-widest border-b border-white/[0.06]">
                                <tr>
                                    <th className="px-2 py-2">Usuario</th>
                                    <th className="px-2 py-2 text-right">Quizzes</th>
                                    <th className="px-2 py-2 text-right">Score promedio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topReaders.map((r) => (
                                    <tr
                                        key={r.uid}
                                        className="border-b border-white/[0.04]"
                                    >
                                        <td className="px-2 py-2">
                                            <div className="text-text-primary text-xs">
                                                {r.displayName || '(sin nombre)'}
                                            </div>
                                            <div className="text-[10px] text-text-muted truncate max-w-[200px]">
                                                {r.email}
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 text-right font-mono text-xs">
                                            {r.articlesCompleted}
                                        </td>
                                        <td className="px-2 py-2 text-right font-mono text-xs">
                                            {r.avgScore.toFixed(0)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                {/* Listas accionables */}
                <section className="space-y-6">
                    {data.zombies.length > 0 && (
                        <div className="bg-bg-surface border border-status-warn/30 rounded-xl p-6">
                            <h3 className="text-sm font-bold tracking-widest uppercase text-status-warn mb-3">
                                Artículos zombie ({data.zombies.length})
                            </h3>
                            <p className="text-text-secondary text-xs mb-4">
                                Publicados con cero vistas. Oportunidad para promocionar o revisar el título.
                            </p>
                            <ul className="space-y-2">
                                {data.zombies.slice(0, 5).map((z) => (
                                    <li
                                        key={z.id}
                                        className="text-xs text-text-primary truncate"
                                    >
                                        · {z.title}
                                    </li>
                                ))}
                                {data.zombies.length > 5 && (
                                    <li className="text-[10px] text-text-muted">
                                        + {data.zombies.length - 5} más…
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}

                    {data.withoutQuiz.length > 0 && (
                        <div className="bg-bg-surface border border-accent/20 rounded-xl p-6">
                            <h3 className="text-sm font-bold tracking-widest uppercase text-accent mb-3">
                                Sin quiz ({data.withoutQuiz.length})
                            </h3>
                            <p className="text-text-secondary text-xs mb-4">
                                Publicados sin preguntas embebidas. Agregar un quiz aumenta retención y completions.
                            </p>
                            <ul className="space-y-2">
                                {data.withoutQuiz.slice(0, 5).map((w) => (
                                    <li
                                        key={w.id}
                                        className="text-xs text-text-primary truncate"
                                    >
                                        · {w.title}
                                    </li>
                                ))}
                                {data.withoutQuiz.length > 5 && (
                                    <li className="text-[10px] text-text-muted">
                                        + {data.withoutQuiz.length - 5} más…
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

/**
 * SPEC-093: barra visual del funnel del quiz. Los tres bloques
 * representan started/completed/registered con anchos proporcionales
 * (started = 100% del ancho disponible, completed % de started,
 * registered % de started).
 */
const FunnelBar: React.FC<{
    funnel: AnalyticsResponse['quizFunnel'];
}> = ({ funnel }) => {
    const startedWidth = 100;
    const completedWidth =
        funnel.started > 0 ? (funnel.completed / funnel.started) * 100 : 0;
    const registeredWidth =
        funnel.started > 0 ? (funnel.registered / funnel.started) * 100 : 0;

    return (
        <div className="space-y-2">
            <FunnelBarRow
                label="Iniciaron"
                width={startedWidth}
                count={funnel.started}
                colorClass="bg-accent/30 border-accent"
            />
            <FunnelBarRow
                label="Completaron"
                width={completedWidth}
                count={funnel.completed}
                colorClass="bg-status-warn/30 border-status-warn"
            />
            <FunnelBarRow
                label="Registrados"
                width={registeredWidth}
                count={funnel.registered}
                colorClass="bg-status-good/30 border-status-good"
            />
        </div>
    );
};

const FunnelBarRow: React.FC<{
    label: string;
    width: number;
    count: number;
    colorClass: string;
}> = ({ label, width, count, colorClass }) => (
    <div className="flex items-center gap-4">
        <div className="w-28 text-xs font-medium text-text-secondary shrink-0">
            {label}
        </div>
        <div className="flex-1 h-7 bg-bg-base/60 rounded-md overflow-hidden relative">
            <div
                className={`h-full border-r transition-all ${colorClass}`}
                style={{ width: `${Math.max(0, Math.min(100, width))}%` }}
            />
            <div className="absolute inset-0 flex items-center px-3 text-[11px] font-mono text-text-primary">
                {count.toLocaleString('es-ES')}
            </div>
        </div>
    </div>
);

const FunnelStep: React.FC<{
    label: string;
    value: number;
    sublabel: string;
    accent?: boolean;
}> = ({ label, value, sublabel, accent }) => (
    <div
        className={`p-4 rounded-lg border ${
            accent
                ? 'bg-accent/[0.06] border-accent/30'
                : 'bg-bg-base/40 border-white/[0.06]'
        }`}
    >
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">
            {label}
        </p>
        <p
            className={`text-2xl font-bold tracking-tight ${
                accent ? 'text-accent' : 'text-text-primary'
            }`}
        >
            {value.toLocaleString('es-ES')}
        </p>
        <p className="text-[11px] text-text-secondary mt-1">{sublabel}</p>
    </div>
);

const KpiCard: React.FC<{ label: string; value: string; accent?: boolean }> = ({
    label,
    value,
    accent,
}) => (
    <div className="bg-bg-surface border border-white/[0.06] rounded-xl p-5">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">
            {label}
        </p>
        <p
            className={`text-3xl font-bold ${accent ? 'text-accent' : 'text-text-primary'} tracking-tight`}
        >
            {value}
        </p>
    </div>
);

export default ArticleAnalytics;
