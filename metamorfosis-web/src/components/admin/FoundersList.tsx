import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * SPEC-058: tab Fundadores del dashboard admin.
 *
 * Vista en tiempo real del cohorte fundadores (primeros 1000 usuarios).
 * Polling cada 30s al endpoint /api/admin/founders. Header con barra de
 * progreso XXX/1000, tabla ordenada por número, búsqueda por nombre/email,
 * export CSV.
 */

interface FounderRow {
    uid: string;
    number: number;
    displayName: string | null;
    email: string;
    assignedAt: string | null;
    imrScore: number | null;
    waitlistStatus: string | null;
    welcomeEmailSent: boolean;
    createdAt: string | null;
}

interface FoundersResponse {
    cap: number;
    count: number;
    remaining: number;
    founders: FounderRow[];
}

const POLL_INTERVAL_MS = 30_000;

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function exportCsv(founders: FounderRow[]) {
    const headers = [
        'numero',
        'nombre',
        'email',
        'imr_score',
        'asignado_iso',
        'creado_iso',
        'waitlist_status',
        'email_enviado',
    ];
    const rows = founders.map((f) => [
        f.number,
        // Escape básico para CSV: comillas dobles internas duplicadas + envoltorio
        `"${(f.displayName ?? '').replace(/"/g, '""')}"`,
        `"${f.email.replace(/"/g, '""')}"`,
        f.imrScore ?? '',
        f.assignedAt ?? '',
        f.createdAt ?? '',
        f.waitlistStatus ?? '',
        f.welcomeEmailSent ? 'si' : 'no',
    ]);
    const csv =
        headers.join(',') + '\n' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fundadores_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const FoundersList: React.FC = () => {
    const [data, setData] = useState<FoundersResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [query, setQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    // SPEC-077: uid en proceso de eliminación (para feedback visual).
    const [deletingUid, setDeletingUid] = useState<string | null>(null);

    // Ref del intervalo para limpiarlo en unmount.
    const intervalRef = useRef<number | null>(null);

    const fetchFounders = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setIsRefreshing(true);
        try {
            const res = await fetch('/api/admin/founders', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Cache-Control': 'no-cache' },
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const json = (await res.json()) as FoundersResponse;
            setData(json);
            setError(null);
            setLastUpdatedAt(new Date());
        } catch (e: any) {
            console.error('[FoundersList] fetch error:', e);
            setError(e?.message || 'Error de red');
        } finally {
            if (!silent) setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        // Primer fetch + polling cada 30s.
        fetchFounders(false);
        intervalRef.current = window.setInterval(() => {
            fetchFounders(true);
        }, POLL_INTERVAL_MS);
        return () => {
            if (intervalRef.current) window.clearInterval(intervalRef.current);
        };
    }, [fetchFounders]);

    /**
     * SPEC-077: eliminar fundador. Decrementa el counter atómico
     * server-side, libera cupo, y refresca el listado.
     *
     * Reglas CLAUDE.md sección 4 aplicadas:
     *   - Content-Type: application/json (sin esto Astro 6 rechaza con 403 CSRF).
     *   - credentials: 'include' explícito (cookie admin_session).
     *   - Check res.ok + parse body para mensaje útil si falla.
     *   - Alert visible al usuario en error (no silencio).
     */
    const handleDelete = useCallback(
        async (uid: string, name: string | null, email: string) => {
            const label = name || email || uid;
            const confirmed = window.confirm(
                `¿Eliminar a "${label}" del cohorte fundador?\n\n` +
                'Pierde los beneficios del cohorte. Libera un cupo para que otro usuario pueda entrar. ' +
                'El usuario sigue existiendo como usuario normal — solo se le quita el estatus fundador.'
            );
            if (!confirmed) return;

            setDeletingUid(uid);
            try {
                const res = await fetch(
                    `/api/admin/founders?uid=${encodeURIComponent(uid)}`,
                    {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                    },
                );

                if (!res.ok) {
                    let errMsg = `Error ${res.status}`;
                    try {
                        const body = await res.json();
                        if (body?.error) errMsg = `${errMsg}: ${body.error}`;
                    } catch {
                        // body no parseable
                    }
                    console.error('[FoundersList.handleDelete] No OK:', errMsg);
                    alert(`No se pudo eliminar el fundador. ${errMsg}`);
                    return;
                }

                // Refresh listado (counter actualizado + fila ya fuera).
                await fetchFounders(false);
            } catch (e: any) {
                console.error('[FoundersList.handleDelete] Network error:', e);
                alert(`Error de red al eliminar: ${e?.message || 'desconocido'}`);
            } finally {
                setDeletingUid(null);
            }
        },
        [fetchFounders],
    );

    const filtered = useMemo(() => {
        if (!data) return [];
        if (!query.trim()) return data.founders;
        const q = query.toLowerCase();
        return data.founders.filter(
            (f) =>
                (f.displayName ?? '').toLowerCase().includes(q) ||
                f.email.toLowerCase().includes(q) ||
                String(f.number).includes(q),
        );
    }, [data, query]);

    const cap = data?.cap ?? 1000;
    const count = data?.count ?? 0;
    const remaining = data?.remaining ?? cap;
    const progressPct = Math.min(100, Math.round((count / cap) * 100));

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header con métricas */}
            <div className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-[#00C49A]/10 border border-amber-400/30 rounded-[2rem] p-8 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/10 blur-[80px] rounded-full pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300 mb-2">
                            🎁 Cohorte fundadores
                        </div>
                        <div className="text-5xl sm:text-6xl font-black text-white italic tracking-tighter leading-none">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-[#00C49A]">
                                {count}
                            </span>
                            <span className="text-gray-500"> / {cap}</span>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mt-2">
                            {remaining > 0
                                ? `${remaining} cupos disponibles`
                                : 'cupo lleno · nuevos usuarios son estándar'}
                        </div>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                            Actualizado: {lastUpdatedAt ? formatDate(lastUpdatedAt.toISOString()) : '—'}
                            {isRefreshing && (
                                <span className="ml-2 text-[#00C49A] animate-pulse">●</span>
                            )}
                        </div>
                        <button
                            onClick={() => fetchFounders(false)}
                            disabled={loading || isRefreshing}
                            className="text-[10px] font-bold uppercase tracking-widest text-amber-300 hover:text-amber-200 border border-amber-400/30 hover:border-amber-400/50 rounded-full px-4 py-1.5 transition-all disabled:opacity-50"
                        >
                            ↻ Actualizar ahora
                        </button>
                    </div>
                </div>
                {/* Progress bar */}
                <div className="relative z-10 h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div
                        className="h-full bg-gradient-to-r from-amber-400 to-[#00C49A] transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
                <div className="relative z-10 mt-2 text-right text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                    {progressPct}% del cupo asignado
                </div>
            </div>

            {/* Toolbar: búsqueda + export */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <input
                    type="search"
                    placeholder="Buscar por nombre, email o número..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 max-w-md px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-400/50 focus:bg-white/8 transition-all"
                />
                <button
                    onClick={() => data && exportCsv(filtered)}
                    disabled={!data || filtered.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    ↓ Exportar CSV ({filtered.length})
                </button>
            </div>

            {/* Estados */}
            {loading && !data && (
                <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
                    <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mr-3" />
                    Cargando fundadores...
                </div>
            )}

            {error && !data && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
                    <p className="text-red-400 font-bold mb-2">⚠ Error obteniendo fundadores</p>
                    <p className="text-gray-400 text-xs font-mono mb-4">{error}</p>
                    <button
                        onClick={() => fetchFounders(false)}
                        className="text-xs font-bold uppercase tracking-widest text-red-300 border border-red-400/30 rounded-full px-4 py-1.5 hover:text-red-200 transition-all"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* Tabla */}
            {data && filtered.length > 0 && (
                <div className="bg-[#0c1422]/40 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5">
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">#</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Nombre</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Email</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">IMR</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Asignado</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Email enviado</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((f) => (
                                    <tr
                                        key={f.uid}
                                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                                    >
                                        <td className="px-4 py-3 text-sm font-mono font-bold text-amber-300">
                                            #{f.number}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white">
                                            {f.displayName ?? <span className="text-gray-600 italic">sin nombre</span>}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                                            {f.email || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold">
                                            {f.imrScore !== null ? (
                                                <span className={
                                                    f.imrScore < 40 ? 'text-red-400'
                                                    : f.imrScore < 60 ? 'text-yellow-400'
                                                    : 'text-[#00C49A]'
                                                }>
                                                    {f.imrScore}
                                                </span>
                                            ) : (
                                                <span className="text-gray-600">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-400">
                                            {formatDate(f.assignedAt)}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {f.welcomeEmailSent ? (
                                                <span className="inline-flex items-center gap-1 text-[#00C49A]">
                                                    ✓ <span className="text-gray-500">enviado</span>
                                                </span>
                                            ) : (
                                                <span className="text-amber-400">⚠ no</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(f.uid, f.displayName, f.email)}
                                                disabled={deletingUid === f.uid}
                                                className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                                title="Quitar el estatus fundador (libera cupo)"
                                            >
                                                {deletingUid === f.uid ? 'Eliminando…' : '🗑 Eliminar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Lista vacía / sin resultados */}
            {data && filtered.length === 0 && !loading && (
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-10 text-center">
                    {data.founders.length === 0 ? (
                        <>
                            <p className="text-gray-400 font-bold mb-2">Aún no hay fundadores</p>
                            <p className="text-xs text-gray-600">
                                Los primeros usuarios que se registren entrarán al cohorte automáticamente.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-gray-400 font-bold mb-2">Sin resultados para "{query}"</p>
                            <p className="text-xs text-gray-600">
                                Intenta otro nombre, email o número.
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default FoundersList;
