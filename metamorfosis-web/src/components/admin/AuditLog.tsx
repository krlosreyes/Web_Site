import React, { useEffect, useMemo, useState } from 'react';

/**
 * Visor de audit log (SPEC-018).
 *
 * Tabla de mutaciones admin recientes con filtros por tipo de acción y
 * search por resourceId. El detalle de `changes` se muestra en una fila
 * expandible para no saturar la tabla principal.
 */

type AuditAction =
    | 'create_post'
    | 'update_post'
    | 'delete_post'
    | 'update_lead'
    | 'upload_image'
    | 'cleanup'
    | 'login_admin'
    | 'logout_admin'
    | 'send_welcome_email'
    | 'react_post'
    | 'create_forum_topic'
    | 'delete_forum_topic'
    | 'create_forum_reply'
    | 'delete_forum_reply'
    | 'like_forum_topic'
    | 'admin_delete_forum_topic'
    | 'admin_delete_forum_reply'
    | 'pin_forum_topic'
    | 'save_forum_topic';

interface AuditEntry {
    id: string;
    action: AuditAction;
    resource: string;
    resourceId: string | null;
    changes: Record<string, { before: unknown; after: unknown }> | null;
    performedAt: string;
    performedBy: string;
    ip: string | null;
}

const ACTION_META: Record<AuditAction, { label: string; emoji: string; color: string }> = {
    create_post: { label: 'Crear post', emoji: '📝', color: 'text-blue-300 border-blue-500/30 bg-blue-500/10' },
    update_post: { label: 'Editar post', emoji: '✏️', color: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10' },
    delete_post: { label: 'Borrar post', emoji: '🗑️', color: 'text-red-300 border-red-500/30 bg-red-500/10' },
    update_lead: { label: 'Editar lead', emoji: '👤', color: 'text-[#00C49A] border-[#00C49A]/30 bg-[#00C49A]/10' },
    upload_image: { label: 'Subir imagen', emoji: '🖼️', color: 'text-purple-300 border-purple-500/30 bg-purple-500/10' },
    cleanup: { label: 'Cleanup', emoji: '🧹', color: 'text-orange-300 border-orange-500/30 bg-orange-500/10' },
    login_admin: { label: 'Login', emoji: '🔓', color: 'text-gray-300 border-gray-500/30 bg-gray-500/10' },
    logout_admin: { label: 'Logout', emoji: '🔒', color: 'text-gray-400 border-gray-500/30 bg-gray-500/10' },
    send_welcome_email: { label: 'Email bienvenida', emoji: '✉️', color: 'text-pink-300 border-pink-500/30 bg-pink-500/10' },
    react_post: { label: 'Reacción artículo', emoji: '👍', color: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' },
    create_forum_topic: { label: 'Foro: nuevo topic', emoji: '💬', color: 'text-blue-300 border-blue-500/30 bg-blue-500/10' },
    delete_forum_topic: { label: 'Foro: borrar topic', emoji: '🗑️', color: 'text-red-300 border-red-500/30 bg-red-500/10' },
    create_forum_reply: { label: 'Foro: nueva respuesta', emoji: '↩️', color: 'text-blue-200 border-blue-400/30 bg-blue-400/10' },
    delete_forum_reply: { label: 'Foro: borrar respuesta', emoji: '✂️', color: 'text-red-200 border-red-400/30 bg-red-400/10' },
    like_forum_topic: { label: 'Foro: like', emoji: '❤️', color: 'text-pink-400 border-pink-500/30 bg-pink-500/10' },
    admin_delete_forum_topic: { label: 'Admin: borrar topic', emoji: '🛡️', color: 'text-orange-300 border-orange-500/30 bg-orange-500/10' },
    admin_delete_forum_reply: { label: 'Admin: borrar reply', emoji: '🛡️', color: 'text-orange-200 border-orange-400/30 bg-orange-400/10' },
    pin_forum_topic: { label: 'Foro: destacar topic', emoji: '📌', color: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
    save_forum_topic: { label: 'Foro: guardar topic', emoji: '🔖', color: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10' },
};

const FILTER_OPTIONS: Array<{ key: AuditAction | 'all'; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'update_lead', label: 'Leads' },
    { key: 'create_post', label: 'Crear posts' },
    { key: 'update_post', label: 'Editar posts' },
    { key: 'delete_post', label: 'Borrar posts' },
    { key: 'upload_image', label: 'Imágenes' },
    { key: 'cleanup', label: 'Cleanups' },
    { key: 'react_post', label: 'Reacciones' },
    { key: 'create_forum_topic', label: 'Foro: topics' },
    { key: 'create_forum_reply', label: 'Foro: replies' },
    { key: 'like_forum_topic', label: 'Foro: likes' },
];

const AuditLog = () => {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<AuditAction | 'all'>('all');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const fetchLog = async () => {
            try {
                const res = await fetch('/api/admin/audit-log?limit=200', { credentials: 'include' });
                if (res.status === 401) {
                    window.location.href = '/admin/login';
                    return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (data.success) setEntries(data.entries);
            } catch (err) {
                console.error('[AuditLog] fetch error:', err);
                setError('No pudimos cargar el audit log.');
            } finally {
                setLoading(false);
            }
        };
        fetchLog();
    }, []);

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: entries.length };
        entries.forEach((e) => {
            c[e.action] = (c[e.action] || 0) + 1;
        });
        return c;
    }, [entries]);

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return entries.filter((e) => {
            if (filter !== 'all' && e.action !== filter) return false;
            if (term.length === 0) return true;
            return (
                (e.resourceId || '').toLowerCase().includes(term) ||
                (e.action || '').toLowerCase().includes(term) ||
                (e.performedBy || '').toLowerCase().includes(term)
            );
        });
    }, [entries, filter, search]);

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
                    <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-400 rounded-full animate-spin" />
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">
                        Loading audit trail…
                    </span>
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-1">Audit log</h2>
                    <p className="text-xs text-gray-500 font-mono">
                        {entries.length} entries · trazabilidad de mutaciones admin
                    </p>
                </div>
            </div>

            {/* Filtros + búsqueda */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                    {FILTER_OPTIONS.map((opt) => {
                        const active = filter === opt.key;
                        const count = counts[opt.key] ?? 0;
                        return (
                            <button
                                key={opt.key}
                                onClick={() => setFilter(opt.key)}
                                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                                    active
                                        ? 'bg-white text-black border-white'
                                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                {opt.label} ({count})
                            </button>
                        );
                    })}
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por resourceId, acción o user…"
                    className="w-full sm:w-80 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-blue-500 outline-none"
                />
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest bg-black/50 text-gray-500">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg w-8"></th>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3">Acción</th>
                            <th className="px-4 py-3">Recurso</th>
                            <th className="px-4 py-3">By</th>
                            <th className="px-4 py-3 rounded-tr-lg">IP</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {visible.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-600 font-mono text-xs">
                                    {entries.length === 0
                                        ? 'No hay actividad registrada todavía.'
                                        : 'Ningún entry matchea el filtro/búsqueda.'}
                                </td>
                            </tr>
                        ) : (
                            visible.map((e) => {
                                const meta = ACTION_META[e.action] ?? {
                                    label: e.action,
                                    emoji: '·',
                                    color: 'text-gray-300 border-gray-500/30 bg-gray-500/10',
                                };
                                const isExpanded = expandedId === e.id;
                                const hasChanges = e.changes && Object.keys(e.changes).length > 0;
                                return (
                                    <React.Fragment key={e.id}>
                                        <tr className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setExpandedId(isExpanded ? null : e.id)}
                                                    disabled={!hasChanges}
                                                    className="w-6 h-6 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title={hasChanges ? (isExpanded ? 'Colapsar' : 'Expandir') : 'Sin cambios'}
                                                >
                                                    {hasChanges ? (isExpanded ? '▼' : '▶') : '·'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono text-gray-300">{fmtDate(e.performedAt)}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${meta.color}`}
                                                >
                                                    {meta.emoji} {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs">
                                                {e.resourceId ? (
                                                    <span className="text-blue-300">{e.resourceId}</span>
                                                ) : (
                                                    <span className="text-gray-600">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs">{e.performedBy}</td>
                                            <td className="px-4 py-3 text-xs font-mono text-gray-500">{e.ip || '—'}</td>
                                        </tr>
                                        {isExpanded && hasChanges && (
                                            <tr className="bg-black/20">
                                                <td colSpan={6} className="px-4 py-4">
                                                    <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">
                                                        Cambios
                                                    </div>
                                                    <pre className="bg-black/40 rounded p-3 text-[10px] font-mono text-gray-300 overflow-x-auto max-h-64">
{JSON.stringify(e.changes, null, 2)}
                                                    </pre>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="pt-3 border-t border-gray-800 text-xs text-gray-600 font-mono flex justify-between">
                <span>Mostrando {visible.length} de {entries.length}</span>
                <span>Sin retención automática — trim manual cuando crezca</span>
            </div>
        </div>
    );
};

export default AuditLog;
