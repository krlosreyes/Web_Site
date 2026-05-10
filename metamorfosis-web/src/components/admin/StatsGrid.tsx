import React, { useEffect, useMemo, useState } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
} from 'recharts';

/**
 * Stats con filtros temporales + sparklines (SPEC-019).
 *
 * 3 KPIs reales (no más conversionRate simulado):
 *   1. Artículos publicados (+ drafts)
 *   2. Users captados en rango (+ total)
 *   3. IMR promedio en rango (+ N quizzes)
 *
 * Cada KPI tiene una sparkline (Recharts AreaChart).
 * El rango se persiste en localStorage.
 */

type RangeKey = '7d' | '30d' | '90d' | 'all';

interface SeriesPoint {
    date: string;
    count: number;
}
interface ImrPoint {
    date: string;
    avg: number | null;
    count: number;
}
interface StatsResponse {
    success: boolean;
    range: RangeKey;
    rangeLabel: string;
    bucketBy: 'day' | 'month';
    totals: {
        posts: number;
        drafts: number;
        users: number;
        newUsersInRange: number;
        imrAvg: number | null;
        imrCount: number;
    };
    series: {
        newUsersByDay: SeriesPoint[];
        postsByDay: SeriesPoint[];
        imrByDay: ImrPoint[];
    };
}

const RANGES: { key: RangeKey; label: string }[] = [
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
    { key: '90d', label: '90d' },
    { key: 'all', label: 'Todo' },
];

const STORAGE_KEY = 'admin_stats_range';

/**
 * Formatea una fecha de bucket (YYYY-MM-DD o YYYY-MM) a algo más legible
 * para el tooltip de Recharts.
 */
const fmtBucket = (b: string, bucketBy: 'day' | 'month') => {
    if (bucketBy === 'month') {
        const [y, m] = b.split('-');
        return `${m}/${y.slice(2)}`;
    }
    const [, m, d] = b.split('-');
    return `${d}/${m}`;
};

/** Tooltip minimal y consistente con la paleta del dashboard. */
const SparkTooltip: React.FC<any> = ({ active, payload, label, valueLabel, bucketBy }) => {
    if (!active || !payload || !payload.length) return null;
    const v = payload[0].value;
    return (
        <div className="bg-black/90 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono text-white shadow-2xl">
            <div className="text-gray-500 uppercase tracking-widest">{fmtBucket(label, bucketBy)}</div>
            <div className="text-sm font-bold mt-0.5">
                {v !== null && v !== undefined ? v : '—'}{' '}
                <span className="text-[9px] text-gray-500 font-normal">{valueLabel}</span>
            </div>
        </div>
    );
};

interface SparklineProps {
    data: { date: string; value: number | null }[];
    color: string;
    valueLabel: string;
    bucketBy: 'day' | 'month';
    gradientId: string;
}
const Sparkline: React.FC<SparklineProps> = ({ data, color, valueLabel, bucketBy, gradientId }) => {
    if (!data || data.length === 0) {
        return <div className="h-12 flex items-center text-[10px] text-gray-700 font-mono">Sin datos</div>;
    }
    return (
        <div className="h-12 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <RechartsTooltip
                        cursor={{ stroke: color, strokeOpacity: 0.3 }}
                        content={<SparkTooltip valueLabel={valueLabel} bucketBy={bucketBy} />}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        fill={`url(#${gradientId})`}
                        connectNulls
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

const StatsGrid = () => {
    const [range, setRange] = useState<RangeKey>(() => {
        if (typeof window === 'undefined') return '30d';
        const saved = window.localStorage.getItem(STORAGE_KEY);
        return saved && RANGES.some((r) => r.key === saved) ? (saved as RangeKey) : '30d';
    });
    const [data, setData] = useState<StatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, range);
        }
        let cancelled = false;
        const fetchStats = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/admin/stats?range=${range}`, { credentials: 'include' });
                if (res.status === 401) {
                    window.location.href = '/admin/login';
                    return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const payload = (await res.json()) as StatsResponse;
                if (!cancelled && payload.success) setData(payload);
            } catch (err) {
                console.error('[StatsGrid] fetch error:', err);
                if (!cancelled) setError('No pudimos cargar las métricas.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchStats();
        return () => {
            cancelled = true;
        };
    }, [range]);

    const postsSeries = useMemo(
        () => (data?.series.postsByDay || []).map((p) => ({ date: p.date, value: p.count })),
        [data]
    );
    const usersSeries = useMemo(
        () => (data?.series.newUsersByDay || []).map((p) => ({ date: p.date, value: p.count })),
        [data]
    );
    const imrSeries = useMemo(
        () => (data?.series.imrByDay || []).map((p) => ({ date: p.date, value: p.avg })),
        [data]
    );

    const totals = data?.totals;
    const bucketBy = data?.bucketBy || 'day';

    return (
        <div className="flex flex-col gap-4">
            {/* Header con chips de rango */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-widest">Métricas</h2>
                    <p className="text-xs text-gray-500 font-mono">
                        {data?.rangeLabel || 'Cargando…'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {RANGES.map((r) => (
                        <button
                            key={r.key}
                            onClick={() => setRange(r.key)}
                            className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                                range === r.key
                                    ? 'bg-white text-black border-white'
                                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                            }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 font-mono text-xs">
                    ⚠️ {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Artículos publicados */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-[#00C49A]/30 transition-colors">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#00C49A]/5 rounded-full blur-2xl group-hover:bg-[#00C49A]/10 transition-colors"></div>
                    <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">
                        Artículos publicados
                    </h3>
                    <div className="flex items-baseline gap-2 text-white">
                        <span className="text-4xl font-black">
                            {totals ? totals.posts : <span className="animate-pulse text-gray-700">--</span>}
                        </span>
                        <span className="text-[#00C49A] text-xs font-bold">
                            {totals && totals.drafts > 0 ? `+${totals.drafts} drafts` : 'Activos'}
                        </span>
                    </div>
                    <div className="mt-4">
                        {loading && !data ? (
                            <div className="h-12 animate-pulse bg-white/5 rounded" />
                        ) : (
                            <Sparkline
                                data={postsSeries}
                                color="#00C49A"
                                valueLabel="publicados"
                                bucketBy={bucketBy}
                                gradientId="grad-posts"
                            />
                        )}
                    </div>
                </div>

                {/* 2. Users captados (en rango) */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors"></div>
                    <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">
                        Users captados
                    </h3>
                    <div className="flex items-baseline gap-2 text-white">
                        <span className="text-4xl font-black">
                            {totals ? (
                                totals.newUsersInRange
                            ) : (
                                <span className="animate-pulse text-gray-700">--</span>
                            )}
                        </span>
                        <span className="text-blue-400 text-xs font-bold">
                            {totals ? `total: ${totals.users}` : 'cargando'}
                        </span>
                    </div>
                    <div className="mt-4">
                        {loading && !data ? (
                            <div className="h-12 animate-pulse bg-white/5 rounded" />
                        ) : (
                            <Sparkline
                                data={usersSeries}
                                color="#60A5FA"
                                valueLabel="nuevos"
                                bucketBy={bucketBy}
                                gradientId="grad-users"
                            />
                        )}
                    </div>
                </div>

                {/* 3. IMR promedio (en rango) */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors"></div>
                    <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">
                        IMR promedio
                    </h3>
                    <div className="flex items-baseline gap-2 text-white">
                        <span className="text-4xl font-black">
                            {totals ? (
                                totals.imrAvg !== null ? (
                                    totals.imrAvg
                                ) : (
                                    <span className="text-gray-700">—</span>
                                )
                            ) : (
                                <span className="animate-pulse text-gray-700">--</span>
                            )}
                        </span>
                        <span className="text-purple-400 text-xs font-bold">
                            {totals ? `${totals.imrCount} quizzes` : 'cargando'}
                        </span>
                    </div>
                    <div className="mt-4">
                        {loading && !data ? (
                            <div className="h-12 animate-pulse bg-white/5 rounded" />
                        ) : (
                            <Sparkline
                                data={imrSeries}
                                color="#A78BFA"
                                valueLabel="IMR avg"
                                bucketBy={bucketBy}
                                gradientId="grad-imr"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsGrid;
