import React, { useEffect, useMemo, useState } from 'react';

/**
 * Dashboard de KPIs de adherencia (SPEC-114).
 *
 * Consume `/api/admin/kpis`. Ver ese endpoint para el detalle de qué
 * subcolecciones de Firestore alimentan cada métrica y qué falta por
 * instrumentar (conversión, churn, coaching_action_followed).
 *
 * El roster por usuario es, a propósito, la pieza más prominente: con
 * ~10 testers, un % agregado es poco accionable — saber exactamente
 * quién se puso inactivo y hace cuántos días es lo que permite ejecutar
 * el Experimento 1 del informe de producto (llamar a los usuarios).
 */

type Status = 'activo' | 'en_riesgo' | 'inactivo' | 'nunca_activo';

interface RetentionStat {
    rate: number | null;
    cohortSize: number;
    returned: number;
}

interface RosterEntry {
    uid: string;
    email: string;
    signupDate: string | null;
    onboardingCompleted: boolean;
    lastActive: string | null;
    daysSinceLastActive: number | null;
    activeDaysTotal: number;
    pillarsTouched: string[];
    status: Status;
}

interface KpiResponse {
    success: boolean;
    generatedAt: string;
    headline: {
        totalUsers: number;
        onboardingCompleteRate: number | null;
        activationRate: number | null;
        activationCohortSize: number;
        d1Retention: RetentionStat;
        d7Retention: RetentionStat;
        d30Retention: RetentionStat;
        dau: number;
        mau: number;
        dauMauRate: number | null;
        northStarRate: number | null;
        habitWeekUsers: number;
    };
    unavailable: Record<string, { available: false; reason: string }>;
    roster: RosterEntry[];
}

const PILLAR_LABEL: Record<string, string> = {
    fasting: 'Ayuno',
    nutrition: 'Nutrición',
    exercise: 'Ejercicio',
    sleep: 'Sueño',
    hydration: 'Hidratación',
};

const STATUS_STYLE: Record<Status, { label: string; className: string }> = {
    activo: { label: 'Activo', className: 'bg-status-good/10 text-status-good border-status-good/30' },
    en_riesgo: { label: 'En riesgo', className: 'bg-status-warn/10 text-status-warn border-status-warn/30' },
    inactivo: { label: 'Inactivo', className: 'bg-status-bad/10 text-status-bad border-status-bad/30' },
    nunca_activo: { label: 'Nunca activo', className: 'bg-white/5 text-text-muted border-white/10' },
};

function fmtPct(v: number | null): string {
    return v === null ? '—' : `${v}%`;
}

const KpiCard: React.FC<{ label: string; value: string; sub?: string; accentClass?: string }> = ({
    label,
    value,
    sub,
    accentClass = 'text-accent',
}) => (
    <div className="bg-bg-surface border border-white/[0.08] rounded-2xl p-6">
        <h3 className="text-text-muted font-bold uppercase tracking-widest text-xs mb-2">{label}</h3>
        <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-text-primary">{value}</span>
        </div>
        {sub && <p className={`text-xs font-semibold mt-1 ${accentClass}`}>{sub}</p>}
    </div>
);

const UnavailableCard: React.FC<{ label: string; reason: string }> = ({ label, reason }) => (
    <div className="bg-bg-surface border border-white/[0.08] rounded-2xl p-6 opacity-70">
        <h3 className="text-text-muted font-bold uppercase tracking-widest text-xs mb-2">{label}</h3>
        <div className="text-3xl font-black text-text-muted mb-2">—</div>
        <p className="text-xs text-text-muted leading-relaxed">{reason}</p>
    </div>
);

const KpiDashboard: React.FC = () => {
    const [data, setData] = useState<KpiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<Status | 'todos'>('todos');

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/kpis', { credentials: 'include' });
            if (res.status === 401) {
                window.location.href = '/admin/login';
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const payload = (await res.json()) as KpiResponse;
            if (payload.success) setData(payload);
        } catch (err) {
            console.error('[KpiDashboard] fetch error:', err);
            setError('No pudimos cargar los KPIs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const filteredRoster = useMemo(() => {
        if (!data) return [];
        if (statusFilter === 'todos') return data.roster;
        return data.roster.filter((r) => r.status === statusFilter);
    }, [data, statusFilter]);

    const h = data?.headline;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="text-lg font-bold text-text-primary uppercase tracking-widest">KPIs de adherencia</h2>
                    <p className="text-xs text-text-muted font-mono">
                        {data ? `n=${h?.totalUsers} usuarios · actualizado ${new Date(data.generatedAt).toLocaleString('es-MX')}` : 'Cargando…'}
                    </p>
                </div>
                <button
                    onClick={load}
                    className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border bg-white/5 text-text-secondary border-white/10 hover:bg-white/10 transition-all"
                >
                    ↻ Refrescar
                </button>
            </div>

            {error && (
                <div className="bg-status-bad/10 border border-status-bad/30 rounded-2xl p-4 text-status-bad font-mono text-xs">
                    ⚠️ {error}
                </div>
            )}

            {h && h.totalUsers < 30 && (
                <div className="bg-status-warn/10 border border-status-warn/30 rounded-xl p-3 text-status-warn text-xs">
                    Con n={h.totalUsers}, los porcentajes agregados no son estadísticamente robustos — úsalos como
                    dirección, no como verdad. La tabla de usuarios de abajo es la herramienta más accionable a este
                    tamaño de base.
                </div>
            )}

            {/* Headline cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Onboarding completo"
                    value={loading && !data ? '--' : fmtPct(h?.onboardingCompleteRate ?? null)}
                />
                <KpiCard
                    label="Activation (D0)"
                    value={loading && !data ? '--' : fmtPct(h?.activationRate ?? null)}
                    sub={h ? `sobre ${h.activationCohortSize} con fecha de alta` : undefined}
                />
                <KpiCard
                    label="D1 retention"
                    value={loading && !data ? '--' : fmtPct(h?.d1Retention.rate ?? null)}
                    sub={h ? `${h.d1Retention.returned}/${h.d1Retention.cohortSize} cohorte` : undefined}
                />
                <KpiCard
                    label="D7 retention"
                    value={loading && !data ? '--' : fmtPct(h?.d7Retention.rate ?? null)}
                    sub={h ? `${h.d7Retention.returned}/${h.d7Retention.cohortSize} cohorte` : undefined}
                />
                <KpiCard
                    label="D30 retention"
                    value={loading && !data ? '--' : fmtPct(h?.d30Retention.rate ?? null)}
                    sub={h ? `${h.d30Retention.returned}/${h.d30Retention.cohortSize} cohorte` : undefined}
                />
                <KpiCard
                    label="DAU / MAU"
                    value={loading && !data ? '--' : fmtPct(h?.dauMauRate ?? null)}
                    sub={h ? `${h.dau} hoy / ${h.mau} en 30d` : undefined}
                />
                <KpiCard
                    label="North Star — semana con hábito"
                    value={loading && !data ? '--' : fmtPct(h?.northStarRate ?? null)}
                    sub={h ? `≥3 pilares en ≥4 días · ${h.habitWeekUsers} usuarios` : undefined}
                    accentClass="text-accent-strong"
                />
                {data &&
                    Object.entries(data.unavailable).map(([key, v]) => (
                        <UnavailableCard
                            key={key}
                            label={
                                key === 'conversionTrialToPremium'
                                    ? 'Conversión trial→premium'
                                    : key === 'churn'
                                      ? 'Churn mensual'
                                      : 'Coaching action followed'
                            }
                            reason={v.reason}
                        />
                    ))}
            </div>

            {/* Roster */}
            <div className="bg-bg-surface border border-white/[0.08] rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <h3 className="text-text-primary font-bold uppercase tracking-widest text-xs">
                        Usuarios — ordenados por inactividad
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {(['todos', 'activo', 'en_riesgo', 'inactivo', 'nunca_activo'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                                    statusFilter === s
                                        ? 'bg-accent text-black border-accent'
                                        : 'bg-white/5 text-text-secondary border-white/10 hover:bg-white/10'
                                }`}
                            >
                                {s === 'todos' ? 'Todos' : STATUS_STYLE[s].label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading && !data ? (
                    <div className="h-32 animate-pulse bg-white/5 rounded-xl" />
                ) : filteredRoster.length === 0 ? (
                    <p className="text-text-muted text-sm">Sin usuarios en este filtro.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left text-text-muted uppercase tracking-widest border-b border-white/10">
                                    <th className="py-2 pr-4">Email</th>
                                    <th className="py-2 pr-4">Alta</th>
                                    <th className="py-2 pr-4">Onboarding</th>
                                    <th className="py-2 pr-4">Última actividad</th>
                                    <th className="py-2 pr-4">Días inactivo</th>
                                    <th className="py-2 pr-4">Pilares tocados</th>
                                    <th className="py-2 pr-4">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRoster.map((u) => (
                                    <tr key={u.uid} className="border-b border-white/[0.04] text-text-secondary">
                                        <td className="py-2 pr-4 text-text-primary font-medium">{u.email}</td>
                                        <td className="py-2 pr-4 font-mono">{u.signupDate || '—'}</td>
                                        <td className="py-2 pr-4">{u.onboardingCompleted ? '✓' : '✗'}</td>
                                        <td className="py-2 pr-4 font-mono">{u.lastActive || 'nunca'}</td>
                                        <td className="py-2 pr-4 font-mono">
                                            {u.daysSinceLastActive === null ? '—' : u.daysSinceLastActive}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {u.pillarsTouched.length === 0
                                                ? '—'
                                                : u.pillarsTouched.map((p) => PILLAR_LABEL[p] || p).join(', ')}
                                        </td>
                                        <td className="py-2 pr-4">
                                            <span
                                                className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[u.status].className}`}
                                            >
                                                {STATUS_STYLE[u.status].label}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KpiDashboard;
