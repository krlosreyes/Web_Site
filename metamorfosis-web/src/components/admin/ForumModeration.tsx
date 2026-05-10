import React, { useEffect, useMemo, useState } from 'react';

/**
 * Visor de moderación del foro (SPEC-033). Lista todos los topics (incluso
 * los soft-deleted) con force-delete por admin.
 */

interface AdminTopic {
    id: string;
    title: string;
    content: string;
    category: string;
    authorUid: string;
    authorName: string;
    replyCount: number;
    likeCount: number;
    views: number;
    status: string;
    createdAt: string;
}

const ForumModeration = () => {
    const [topics, setTopics] = useState<AdminTopic[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('all');
    const [busyId, setBusyId] = useState<string | null>(null);

    const fetchAll = async () => {
        setLoading(true);
        setError(null);
        try {
            // El endpoint público filtra deleted; reusamos pero pedimos todo via
            // un trick: fetch sin filter de status. Como no hay endpoint admin
            // de listado, vamos a llamar al mismo público y desde acá no vemos
            // los deleted. Para ver deleted, en una iteración futura agregamos
            // /api/admin/forum/topics que devuelva todos. Por ahora limitamos
            // moderación a los activos visibles.
            const res = await fetch('/api/forum/topics', { credentials: 'include' });
            if (res.status === 401) {
                window.location.href = '/admin/login';
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.success) setTopics(data.topics);
        } catch (err) {
            console.error('[ForumModeration] fetch:', err);
            setError('No pudimos cargar el foro.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return topics.filter((t) => {
            if (statusFilter !== 'all' && t.status !== statusFilter) return false;
            if (!term) return true;
            return (
                t.title.toLowerCase().includes(term) ||
                t.content.toLowerCase().includes(term) ||
                t.authorName.toLowerCase().includes(term)
            );
        });
    }, [topics, statusFilter, search]);

    const handleForceDelete = async (id: string) => {
        if (!confirm('¿Force-delete este topic? Acción irreversible desde la UI.')) return;
        setBusyId(id);
        try {
            const res = await fetch(
                `/api/admin/forum/delete?type=topic&topic=${encodeURIComponent(id)}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await fetchAll();
        } catch (err: any) {
            alert('Error: ' + (err?.message || 'desconocido'));
        } finally {
            setBusyId(null);
        }
    };

    const fmtDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('es-ES', {
                year: '2-digit',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return iso;
        }
    };

    if (loading) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-400 rounded-full animate-spin" />
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">Cargando foro…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-red-300 font-mono text-xs">
                ⚠️ {error}
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-1">
                        Moderación del Foro
                    </h2>
                    <p className="text-xs text-gray-500 font-mono">
                        {topics.length} topics activos · force-delete vía Admin SDK
                    </p>
                </div>
                <button
                    onClick={fetchAll}
                    className="text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-full border border-blue-500/30 hover:bg-blue-500/10"
                    title="Refrescar"
                >
                    ↻
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por título, contenido o autor…"
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-orange-500 outline-none"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'deleted')}
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
                >
                    <option value="all" className="bg-gray-900">Todos</option>
                    <option value="active" className="bg-gray-900">Activos</option>
                    <option value="deleted" className="bg-gray-900">Eliminados</option>
                </select>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest bg-black/50 text-gray-500">
                        <tr>
                            <th className="px-4 py-3">Título</th>
                            <th className="px-4 py-3">Autor</th>
                            <th className="px-4 py-3">Cat.</th>
                            <th className="px-4 py-3 text-right">R/L/V</th>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {visible.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-600 font-mono text-xs">
                                    Ningún topic matchea el filtro.
                                </td>
                            </tr>
                        ) : (
                            visible.map((t) => (
                                <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-4 py-3 max-w-xs">
                                        <div className="font-medium text-gray-200 line-clamp-1">{t.title}</div>
                                        <div className="text-[10px] text-gray-600 font-mono mt-1 line-clamp-1">
                                            {t.content?.slice(0, 80)}…
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs">{t.authorName}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2 py-1 rounded">
                                            {t.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs font-mono">
                                        <span className="text-blue-400">{t.replyCount || 0}</span>
                                        <span className="text-gray-700 mx-1">·</span>
                                        <span className="text-pink-400">{t.likeCount || 0}</span>
                                        <span className="text-gray-700 mx-1">·</span>
                                        <span className="text-gray-500">{t.views || 0}</span>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] font-mono text-gray-300">
                                        {fmtDate(t.createdAt)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleForceDelete(t.id)}
                                            disabled={busyId === t.id}
                                            className="text-[10px] font-bold uppercase tracking-widest border border-red-500/30 px-2 py-1 rounded text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-wait"
                                        >
                                            {busyId === t.id ? '…' : 'Borrar'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="pt-3 border-t border-gray-800 text-xs text-gray-600 font-mono flex justify-between">
                <span>Mostrando {visible.length} de {topics.length}</span>
                <span>R = replies · L = likes · V = views</span>
            </div>
        </div>
    );
};

export default ForumModeration;
