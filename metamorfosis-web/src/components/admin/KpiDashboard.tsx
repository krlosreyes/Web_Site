import React, { useEffect, useMemo, useState } from 'react';

/**
 * Dashboard de KPIs de adherencia (SPEC-114).
 *
 * Consume `/api/admin/kpis`. Ver ese endpoint para el detalle de qué
 * subcolecciones de Firestore alimentan cada métrica y qué falta por
 * instrumentar (conversión, churn, coaching_action_followed).
 *
 * SPEC-114-fix (2026-07-12): v1 usaba jerga de analista (D0/D1/D7/D30,
 * DAU/MAU, "North Star") sin explicación — Carlos lo vio en vivo y no
 * pudo interpretarlo. Esta versión reemplaza todos los labels por
 * lenguaje llano orientado a la pregunta que responde cada tarjeta, en
 * el orden del embudo real (instalar → registrarse → usarla el primer
 * día → seguir volviendo → formar el hábito). Los términos técnicos se
 * mantienen solo como referencia pequeña, no como el label principal.
 *
 * El roster por usuario sigue siendo la pieza más prominente: con ~10-12
 * testers, un % agregado es poco accionable — saber exactamente quién
 * se puso inactivo y hace cuántos días es lo que permite ejecutar el
 * Experimento 1 del informe de producto (llamar a los usuarios).
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

/**
 * Tarjeta de KPI en lenguaje llano: título = la pregunta que responde,
 * número grande = la respuesta, descripción = cómo se calculó (siempre
 * visible, no escondida detrás de un tooltip), raw = el detalle
 * "X de Y" para poder verificar a ojo con pocos usuarios.
 */
const KpiCard: React.FC<{
    title: string;
    value: string;
    description: string;
    raw?: string;
    technicalTag?: string;
    accentClass?: string;
}> = ({ title, value, description, raw, technicalTag, accentClass = 'text-accent' }) => (
    <div className="bg-bg-surface border border-white/[0.08] rounded-2xl p-6 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-text-primary font-bold text-sm leading-snug">{title}</h3>
            {technicalTag && (
                <span className="shrink-0 text-[9px] font-mono text-text-muted/70 border border-white/10 rounded px-1.5 py-0.5">
                    {technicalTag}
                </span>
            )}
        </div>
        <span className={`text-4xl font-black text-text-primary`}>{value}</span>
        {raw && <p className={`text-xs font-semibold mt-1 ${accentClass}`}>{raw}</p>}
        <p className="text-xs text-text-muted leading-relaxed mt-3">{description}</p>
    </div>
);

const UnavailableCard: React.FC<{ title: string; plain: string; technical: string }> = ({ title, plain, technical }) => (
    <div className="bg-bg-surface border border-white/[0.08] rounded-2xl p-6 opacity-70 flex flex-col">
        <h3 className="text-text-primary font-bold text-sm leading-snug mb-2">{title}</h3>
        <div className="text-4xl font-black text-text-muted mb-2">—</div>
        <p className="text-xs text-text-secondary leading-relaxed">{plain}</p>
        <p className="text-xs text-text-muted leading-relaxed mt-2 italic">{technical}</p>
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
    const isLoadingFirst = loading && !data;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="text-lg font-bold text-text-primary">KPIs de adherencia</h2>
                    <p className="text-xs text-text-muted font-mono">
                        {data
                            ? `${h?.totalUsers} usuarios registrados · actualizado ${new Date(data.generatedAt).toLocaleString('es-MX')}`
                            : 'Cargando…'}
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

            {/* Cómo leer este panel */}
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 text-text-secondary text-xs leading-relaxed">
                <p className="text-text-primary font-bold text-xs mb-1">Cómo leer este panel</p>
                <p>
                    Cada tarjeta responde un paso del mismo camino: alguien instala la app, se registra, la usa por
                    primera vez, y luego (o no) sigue volviendo. Van en ese orden. La pregunta que más importa para
                    decidir es la última con número (más abajo): <strong className="text-text-primary">de los que
                    llevan usándola una semana, ¿cuántos de verdad formaron el hábito de los 5 pilares?</strong> Las
                    tarjetas grises al final son cosas que todavía no podemos medir — no son 0%, son "no lo sabemos
                    todavía" (te explico el motivo en cada una).
                </p>
            </div>

            {h && h.totalUsers < 30 && (
                <div className="bg-status-warn/10 border border-status-warn/30 rounded-xl p-3 text-status-warn text-xs leading-relaxed">
                    Con solo {h.totalUsers} usuarios, un cambio de 1-2 personas mueve el porcentaje varios puntos —
                    no le des demasiado peso al número exacto ("45%" no es muy distinto de "40%" a este tamaño).
                    Úsalos como dirección general. La tabla de usuarios más abajo, con nombre y fecha, es la
                    herramienta más confiable a este tamaño de base.
                </div>
            )}

            {/* Headline cards — en orden de embudo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <KpiCard
                    title="¿Terminan el registro dentro de la app?"
                    value={isLoadingFirst ? '--' : fmtPct(h?.onboardingCompleteRate ?? null)}
                    description="Porcentaje de usuarios que completó el flujo de registro (perfil, objetivos, permisos) hasta el final. Puede estar un poco subestimado: si el guardado falla por conexión, no queda registrado aunque la persona sí haya terminado."
                    technicalTag="onboarding_complete"
                />
                <KpiCard
                    title="¿Empiezan a usarla el mismo día que se registran?"
                    value={isLoadingFirst ? '--' : fmtPct(h?.activationRate ?? null)}
                    description="De quienes tienen fecha de alta, porcentaje que registró algo (un ayuno, agua, una comida) ese mismo día. Es la señal más temprana de si la app engancha de entrada."
                    raw={h ? `${h.activationCohortSize} usuarios con fecha de alta conocida` : undefined}
                    technicalTag="activation"
                />
                <KpiCard
                    title="¿Seguían usándola al día siguiente?"
                    value={isLoadingFirst ? '--' : fmtPct(h?.d1Retention.rate ?? null)}
                    description="De quienes ya llevan al menos 1 día desde que se unieron, porcentaje que volvió a usar la app en ese día o después."
                    raw={h ? `${h.d1Retention.returned} de ${h.d1Retention.cohortSize} (solo cuenta a quienes ya les dio tiempo)` : undefined}
                    technicalTag="D1 retention"
                />
                <KpiCard
                    title="¿Seguían usándola después de una semana?"
                    value={isLoadingFirst ? '--' : fmtPct(h?.d7Retention.rate ?? null)}
                    description="Mismo cálculo que el anterior, pero mirando 7 días después del alta. Es la señal de si el hábito sobrevive la primera semana, que es donde más gente abandona."
                    raw={h ? `${h.d7Retention.returned} de ${h.d7Retention.cohortSize}` : undefined}
                    technicalTag="D7 retention"
                />
                <KpiCard
                    title="¿Seguían usándola después de un mes?"
                    value={isLoadingFirst ? '--' : fmtPct(h?.d30Retention.rate ?? null)}
                    description="Igual, mirando 30 días después del alta. Con pocos usuarios este número suele tardar en tener sentido — mira el 'de X' de al lado antes de preocuparte por el %."
                    raw={h ? `${h.d30Retention.returned} de ${h.d30Retention.cohortSize}` : undefined}
                    technicalTag="D30 retention"
                />
                <KpiCard
                    title="De los que vuelven, ¿vuelven seguido?"
                    value={isLoadingFirst ? '--' : fmtPct(h?.dauMauRate ?? null)}
                    description="Compara cuántas personas usaron la app hoy contra cuántas la usaron en algún momento de los últimos 30 días. Un número alto significa que quien vuelve, vuelve casi a diario — no solo una vez al mes."
                    raw={h ? `${h.dau} personas hoy, de ${h.mau} en los últimos 30 días` : undefined}
                    technicalTag="DAU/MAU"
                />
                <KpiCard
                    title="¿Formaron el hábito completo esta semana?"
                    value={isLoadingFirst ? '--' : fmtPct(h?.northStarRate ?? null)}
                    description="La pregunta que más importa: porcentaje que esta semana usó al menos 3 de los 5 pilares (ayuno, sueño, hidratación, ejercicio, comidas) en al menos 4 días distintos. No mide si abrieron la app — mide si de verdad están construyendo el hábito completo."
                    raw={h ? `${h.habitWeekUsers} de ${h.totalUsers} usuarios esta semana` : undefined}
                    technicalTag="North Star"
                    accentClass="text-accent-strong"
                />
            </div>

            {/* No disponible todavía */}
            {data && (
                <div>
                    <p className="text-text-muted text-xs uppercase tracking-widest font-bold mb-3">
                        Todavía no podemos medir esto
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(data.unavailable).map(([key, v]) => {
                            const meta =
                                key === 'conversionTrialToPremium'
                                    ? {
                                          title: '¿Cuántos de prueba pasan a pago?',
                                          plain: 'No lo tenemos conectado todavía — el estado de cada suscripción vive solo dentro de RevenueCat (la plataforma de pagos), no en nuestra base de datos.',
                                      }
                                    : key === 'churn'
                                      ? {
                                            title: '¿Cuántos cancelan cada mes?',
                                            plain: 'Depende de la misma conexión pendiente que la anterior (RevenueCat).',
                                        }
                                      : {
                                            title: '¿El coaching dentro de la app sirve?',
                                            plain: 'Se registra el evento, pero no está conectado a un lugar donde lo podamos consultar todavía.',
                                        };
                            return <UnavailableCard key={key} title={meta.title} plain={meta.plain} technical={v.reason} />;
                        })}
                    </div>
                </div>
            )}

            {/* Roster */}
            <div className="bg-bg-surface border border-white/[0.08] rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-1">
                    <h3 className="text-text-primary font-bold text-sm">
                        Usuario por usuario — ordenados por quién lleva más tiempo sin usarla
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
                <p className="text-text-muted text-xs mb-4">
                    Esta tabla es la más confiable con pocos usuarios: úsala para saber a quién llamar. "Activo" =
                    usó algo en los últimos 2 días. "En riesgo" = 3 a 6 días sin usarla. "Inactivo" = 7 días o más.
                </p>

                {isLoadingFirst ? (
                    <div className="h-32 animate-pulse bg-white/5 rounded-xl" />
                ) : filteredRoster.length === 0 ? (
                    <p className="text-text-muted text-sm">Sin usuarios en este filtro.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left text-text-muted uppercase tracking-widest border-b border-white/10">
                                    <th className="py-2 pr-4">Email</th>
                                    <th className="py-2 pr-4">Se unió</th>
                                    <th className="py-2 pr-4">Terminó registro</th>
                                    <th className="py-2 pr-4">Última vez que la usó</th>
                                    <th className="py-2 pr-4">Días sin usarla</th>
                                    <th className="py-2 pr-4">Qué ha usado</th>
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
