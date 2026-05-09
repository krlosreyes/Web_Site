import React, { useEffect, useMemo, useState } from 'react';

/**
 * CRM funcional para leads (SPEC-016).
 *
 * Pipeline: new → contacted → qualified → converted | archived
 * Cada lead tiene además notas libres (≤5000 chars) y tags (≤20).
 * Filtros + búsqueda + edición inline. Persiste en Firestore via
 * PUT /api/admin/leads.
 */

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'archived';

interface Lead {
    id: string;
    name: string;
    email: string;
    imr_score: string | number;
    quiz_type: string;
    dateCompleted: string;
    createdAtIso: string | null;
    status: LeadStatus;
    notes: string;
    tags: string[];
    contactedAt: string | null;
    lastUpdatedAt: string | null;
    proxy_scores: Record<string, number>;
}

const STATUS_META: Record<
    LeadStatus,
    { label: string; emoji: string; classes: string; activeClasses: string }
> = {
    new: {
        label: 'Nuevo',
        emoji: '🆕',
        classes: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
        activeClasses: 'bg-blue-500 text-white border-blue-500',
    },
    contacted: {
        label: 'Contactado',
        emoji: '📞',
        classes: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
        activeClasses: 'bg-yellow-500 text-black border-yellow-500',
    },
    qualified: {
        label: 'Calificado',
        emoji: '⭐',
        classes: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
        activeClasses: 'bg-purple-500 text-white border-purple-500',
    },
    converted: {
        label: 'Convertido',
        emoji: '✅',
        classes: 'bg-[#00C49A]/10 text-[#00C49A] border-[#00C49A]/30',
        activeClasses: 'bg-[#00C49A] text-black border-[#00C49A]',
    },
    archived: {
        label: 'Archivado',
        emoji: '🗄️',
        classes: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
        activeClasses: 'bg-gray-500 text-white border-gray-500',
    },
};

const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'archived'];

const LeadList = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        const fetchLeads = async () => {
            try {
                const response = await fetch('/api/admin/leads', { credentials: 'include' });
                if (response.status === 401) {
                    window.location.href = '/admin/login';
                    return;
                }
                if (!response.ok) throw new Error('Failed to fetch leads');
                const data = await response.json();
                if (data.success) setLeads(data.leads);
            } catch (err) {
                console.error('[LeadList] fetch error:', err);
                setError('No pudimos cargar los leads.');
            } finally {
                setLoading(false);
            }
        };
        fetchLeads();
    }, []);

    /**
     * Persiste cambios al lead. Optimista: actualiza estado local primero,
     * revierte si el server rechaza. Marca savingId mientras está en vuelo.
     */
    const updateLead = async (id: string, patch: Partial<Pick<Lead, 'status' | 'notes' | 'tags'>>) => {
        setSavingId(id);
        const previous = leads.find((l) => l.id === id);
        if (!previous) return;
        // Optimistic update
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
        try {
            const res = await fetch('/api/admin/leads', {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...patch }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${res.status}`);
            }
        } catch (err: any) {
            console.error('[LeadList] update error:', err);
            // Revert
            setLeads((prev) => prev.map((l) => (l.id === id ? previous : l)));
            alert('No pudimos guardar el cambio: ' + (err?.message || 'error desconocido'));
        } finally {
            setSavingId(null);
        }
    };

    /** Counts por status para los chips de filtro. */
    const counts = useMemo(() => {
        const c: Record<LeadStatus | 'all', number> = {
            all: leads.length,
            new: 0,
            contacted: 0,
            qualified: 0,
            converted: 0,
            archived: 0,
        };
        leads.forEach((l) => {
            c[l.status] = (c[l.status] || 0) + 1;
        });
        return c;
    }, [leads]);

    /** Aplicar filtros + búsqueda. */
    const visibleLeads = useMemo(() => {
        const term = search.trim().toLowerCase();
        return leads.filter((l) => {
            if (filterStatus !== 'all' && l.status !== filterStatus) return false;
            if (term.length === 0) return true;
            return (
                l.name.toLowerCase().includes(term) ||
                l.email.toLowerCase().includes(term) ||
                l.tags.some((t) => t.toLowerCase().includes(term))
            );
        });
    }, [leads, filterStatus, search]);

    const exportCsv = () => {
        if (visibleLeads.length === 0) return;
        const headers = ['Nombre', 'Email', 'Status', 'Tags', 'IMR', 'Tipo', 'Fecha', 'Notas'];
        const csvRows = [headers.join(',')];
        for (const lead of visibleLeads) {
            csvRows.push(
                [
                    `"${(lead.name || 'N/A').replace(/"/g, '""')}"`,
                    lead.email,
                    lead.status,
                    `"${lead.tags.join('|').replace(/"/g, '""')}"`,
                    lead.imr_score,
                    lead.quiz_type,
                    lead.dateCompleted,
                    `"${(lead.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                ].join(',')
            );
        }
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads_metamorfosis_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-[#00C49A]/30 border-t-[#00C49A] rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">Fetching CRM Data...</span>
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-1">CRM: Protocol Leads</h2>
                    <p className="text-xs text-gray-500 font-mono">{leads.length} leads totales · pipeline activo</p>
                </div>
                <button
                    onClick={exportCsv}
                    disabled={visibleLeads.length === 0}
                    className="text-xs font-bold uppercase tracking-wider text-[#00C49A] hover:text-[#00C49A]/80 disabled:text-gray-700 disabled:border-gray-800 transition-colors px-4 py-2 rounded-lg border border-[#00C49A]/30 hover:bg-[#00C49A]/10 disabled:hover:bg-transparent flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Exportar CSV ({visibleLeads.length})
                </button>
            </div>

            {/* Filtros + Búsqueda */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                            filterStatus === 'all'
                                ? 'bg-white text-black border-white'
                                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                        }`}
                    >
                        Todos ({counts.all})
                    </button>
                    {STATUS_ORDER.map((s) => {
                        const meta = STATUS_META[s];
                        const isActive = filterStatus === s;
                        return (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                                    isActive ? meta.activeClasses : meta.classes + ' hover:bg-white/10'
                                }`}
                            >
                                <span>{meta.emoji}</span>
                                <span>{meta.label}</span>
                                <span className="opacity-70">({counts[s] || 0})</span>
                            </button>
                        );
                    })}
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, email o tag…"
                    className="w-full sm:w-80 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-blue-500 outline-none"
                />
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest bg-black/50 text-gray-500">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg w-8"></th>
                            <th className="px-4 py-3">Nombre</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">IMR</th>
                            <th className="px-4 py-3 text-right rounded-tr-lg">Fecha</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {visibleLeads.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-600 font-mono text-xs">
                                    {leads.length === 0
                                        ? 'No hay leads capturados todavía.'
                                        : 'No hay leads que matcheen el filtro/búsqueda.'}
                                </td>
                            </tr>
                        ) : (
                            visibleLeads.map((lead) => {
                                const isExpanded = expandedId === lead.id;
                                const meta = STATUS_META[lead.status];
                                return (
                                    <React.Fragment key={lead.id}>
                                        <tr className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                                                    className="w-6 h-6 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                                                    title={isExpanded ? 'Colapsar' : 'Expandir'}
                                                >
                                                    {isExpanded ? '▼' : '▶'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-200">{lead.name}</td>
                                            <td className="px-4 py-3">
                                                <a href={`mailto:${lead.email}`} className="hover:text-blue-400 transition-colors">
                                                    {lead.email}
                                                </a>
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={lead.status}
                                                    onChange={(e) => updateLead(lead.id, { status: e.target.value as LeadStatus })}
                                                    disabled={savingId === lead.id}
                                                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border bg-transparent ${meta.classes} cursor-pointer outline-none focus:ring-1 focus:ring-white/20`}
                                                >
                                                    {STATUS_ORDER.map((s) => (
                                                        <option key={s} value={s} className="bg-gray-900 text-white">
                                                            {STATUS_META[s].emoji} {STATUS_META[s].label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-blue-400">{lead.imr_score}</td>
                                            <td className="px-4 py-3 text-right text-xs">{lead.dateCompleted}</td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-black/20">
                                                <td colSpan={6} className="px-4 py-5">
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                        {/* Notas */}
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                                                                Notas internas
                                                            </label>
                                                            <textarea
                                                                value={lead.notes}
                                                                onChange={(e) => {
                                                                    const newNotes = e.target.value;
                                                                    setLeads((prev) =>
                                                                        prev.map((l) => (l.id === lead.id ? { ...l, notes: newNotes } : l))
                                                                    );
                                                                }}
                                                                onBlur={(e) => {
                                                                    if (e.target.value !== '') {
                                                                        updateLead(lead.id, { notes: e.target.value });
                                                                    }
                                                                }}
                                                                rows={4}
                                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-700 focus:border-purple-500 outline-none resize-y"
                                                                placeholder="Notas privadas: contexto del contacto, próximos pasos, fit…"
                                                            />
                                                            <p className="text-[10px] text-gray-600 font-mono">
                                                                Se guarda al hacer clic fuera del campo. Máx 5000 caracteres.
                                                            </p>
                                                        </div>

                                                        {/* Tags + metadata */}
                                                        <div className="space-y-4">
                                                            <div>
                                                                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                                                    Tags
                                                                </label>
                                                                <div className="flex flex-wrap gap-2 mt-2">
                                                                    {lead.tags.map((tag, idx) => (
                                                                        <span
                                                                            key={idx}
                                                                            className="bg-blue-500/10 text-blue-300 border border-blue-500/30 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"
                                                                        >
                                                                            {tag}
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newTags = lead.tags.filter((_, i) => i !== idx);
                                                                                    updateLead(lead.id, { tags: newTags });
                                                                                }}
                                                                                className="hover:text-red-400 transition-colors"
                                                                                title="Quitar tag"
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        </span>
                                                                    ))}
                                                                    <input
                                                                        type="text"
                                                                        placeholder="+ tag"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                const value = (e.target as HTMLInputElement).value.trim();
                                                                                if (value && !lead.tags.includes(value)) {
                                                                                    updateLead(lead.id, { tags: [...lead.tags, value] });
                                                                                    (e.target as HTMLInputElement).value = '';
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white placeholder:text-gray-600 focus:border-blue-500 outline-none w-20"
                                                                    />
                                                                </div>
                                                                <p className="text-[10px] text-gray-600 font-mono mt-2">
                                                                    Enter para agregar. Máx 20 tags.
                                                                </p>
                                                            </div>

                                                            <div className="space-y-1 text-[10px] font-mono text-gray-500">
                                                                <div>Tipo quiz: <span className="text-[#00C49A]">{lead.quiz_type}</span></div>
                                                                {lead.contactedAt && (
                                                                    <div>Contactado: <span className="text-yellow-400">{new Date(lead.contactedAt).toLocaleString('es-ES')}</span></div>
                                                                )}
                                                                {lead.lastUpdatedAt && (
                                                                    <div>Última edición: <span className="text-gray-300">{new Date(lead.lastUpdatedAt).toLocaleString('es-ES')}</span></div>
                                                                )}
                                                                {Object.keys(lead.proxy_scores).length > 0 && (
                                                                    <details className="mt-2">
                                                                        <summary className="cursor-pointer hover:text-white">Proxy scores del quiz</summary>
                                                                        <pre className="mt-2 p-2 bg-black/40 rounded text-[9px] overflow-auto">
{JSON.stringify(lead.proxy_scores, null, 2)}
                                                                        </pre>
                                                                    </details>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
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
                <span>Mostrando {visibleLeads.length} de {leads.length}</span>
                <span>Pipeline: {counts.contacted + counts.qualified} en proceso · {counts.converted} convertidos</span>
            </div>
        </div>
    );
};

export default LeadList;
