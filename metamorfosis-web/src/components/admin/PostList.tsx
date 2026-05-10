import React, { useEffect, useMemo, useState } from 'react';

/**
 * PostList con filtros + orden configurable + columna de fecha (SPEC-023).
 *
 * Default: "Más recientes" (publishedAt desc). Posts legacy sin
 * publishedAt caen al final cuando se ordena desc, al principio cuando asc.
 *
 * Filtro y orden persisten en localStorage para sobrevivir a refreshes.
 */

type PostStatus = 'draft' | 'published' | 'legacy';

interface Post {
    id: string;
    title: string;
    slug: string;
    views: number;
    clicks: number;
    conversions: number;
    content?: string;
    images?: string[];
    references?: string[];
    quiz?: any[];
    status?: 'draft' | 'published';
    publishedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

type SortKey =
    | 'pub-desc'
    | 'pub-asc'
    | 'created-desc'
    | 'updated-desc'
    | 'title-asc'
    | 'title-desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'pub-desc', label: '📅 Más recientes' },
    { key: 'pub-asc', label: '📅 Más antiguos' },
    { key: 'created-desc', label: '🆕 Recién creados' },
    { key: 'updated-desc', label: '✏️ Recién editados' },
    { key: 'title-asc', label: '🔤 A–Z' },
    { key: 'title-desc', label: '🔤 Z–A' },
];

const FILTER_KEY = 'admin_postlist_filter';
const SORT_KEY = 'admin_postlist_sort';

const STATUS_META: Record<PostStatus, { emoji: string; label: string; classes: string }> = {
    published: {
        emoji: '🟢',
        label: 'Publicado',
        classes: 'bg-[#00C49A]/10 text-[#00C49A] border-[#00C49A]/30',
    },
    draft: {
        emoji: '🟡',
        label: 'Borrador',
        classes: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
    },
    legacy: {
        emoji: '⚪',
        label: 'Legacy',
        classes: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    },
};

/** Mapea el status del doc al status del filtro. Legacy = sin campo (SPEC-015). */
const resolveStatus = (p: Post): PostStatus => {
    if (p.status === 'draft') return 'draft';
    if (p.status === 'published') return 'published';
    return 'legacy';
};

/** Formatea ISO a `dd MMM yyyy` español. Devuelve '—' si null/inválido. */
const formatPubDate = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const sortPosts = (posts: Post[], sortKey: SortKey): Post[] => {
    const sorted = [...posts];
    const toMs = (iso: string | null | undefined) => {
        if (!iso) return null;
        const t = new Date(iso).getTime();
        return isNaN(t) ? null : t;
    };
    sorted.sort((a, b) => {
        switch (sortKey) {
            case 'pub-desc': {
                const ax = toMs(a.publishedAt);
                const bx = toMs(b.publishedAt);
                if (ax === null && bx === null) return 0;
                if (ax === null) return 1; // null al final
                if (bx === null) return -1;
                return bx - ax;
            }
            case 'pub-asc': {
                const ax = toMs(a.publishedAt);
                const bx = toMs(b.publishedAt);
                if (ax === null && bx === null) return 0;
                if (ax === null) return 1; // null al final también para asc
                if (bx === null) return -1;
                return ax - bx;
            }
            case 'created-desc': {
                const ax = toMs(a.createdAt) ?? 0;
                const bx = toMs(b.createdAt) ?? 0;
                return bx - ax;
            }
            case 'updated-desc': {
                const ax = toMs(a.updatedAt) ?? toMs(a.createdAt) ?? 0;
                const bx = toMs(b.updatedAt) ?? toMs(b.createdAt) ?? 0;
                return bx - ax;
            }
            case 'title-asc':
                return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' });
            case 'title-desc':
                return (b.title || '').localeCompare(a.title || '', 'es', { sensitivity: 'base' });
            default:
                return 0;
        }
    });
    return sorted;
};

interface PostListProps {
    onEdit: (post: Post) => void;
    onNew: () => void;
}

const PostList: React.FC<PostListProps> = ({ onEdit, onNew }) => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<PostStatus | 'all'>(() => {
        if (typeof window === 'undefined') return 'all';
        const saved = window.localStorage.getItem(FILTER_KEY);
        return (saved as PostStatus | 'all') || 'all';
    });
    const [sortKey, setSortKey] = useState<SortKey>(() => {
        if (typeof window === 'undefined') return 'pub-desc';
        const saved = window.localStorage.getItem(SORT_KEY);
        return SORT_OPTIONS.some((o) => o.key === saved) ? (saved as SortKey) : 'pub-desc';
    });

    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem(FILTER_KEY, filter);
    }, [filter]);

    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem(SORT_KEY, sortKey);
    }, [sortKey]);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/posts');
            if (response.ok) {
                const data = await response.json();
                if (data.success) setPosts(data.posts);
            }
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar este artículo permanentemente?')) return;
        try {
            const response = await fetch(`/api/admin/posts?id=${id}`, { method: 'DELETE' });
            if (response.ok) fetchPosts();
        } catch (error) {
            console.error("Error deleting post:", error);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    const counts = useMemo(() => {
        const c: Record<PostStatus | 'all', number> = {
            all: posts.length,
            published: 0,
            draft: 0,
            legacy: 0,
        };
        posts.forEach((p) => {
            c[resolveStatus(p)] += 1;
        });
        return c;
    }, [posts]);

    const visiblePosts = useMemo(() => {
        const filtered =
            filter === 'all' ? posts : posts.filter((p) => resolveStatus(p) === filter);
        return sortPosts(filtered, sortKey);
    }, [posts, filter, sortKey]);

    if (loading) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl h-full flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-[#00C49A] rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">Cargando Archivos...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl h-full flex flex-col gap-5">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-1">Index de Contenido</h2>
                    <p className="text-xs text-gray-500 font-mono">{posts.length} artículos · gestión editorial</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onNew} className="text-xs font-bold uppercase tracking-wider bg-[#00C49A] text-black px-4 py-2 rounded-xl hover:bg-[#00C49A]/90 transition-all">
                        + Nuevo Artículo
                    </button>
                    <button onClick={fetchPosts} className="text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-full border border-blue-500/30 hover:bg-blue-500/10" title="Refrescar">
                        ↻
                    </button>
                </div>
            </div>

            {/* Filtros + orden */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div className="flex flex-wrap gap-2">
                    {(['all', 'published', 'draft', 'legacy'] as const).map((key) => {
                        const active = filter === key;
                        const meta = key === 'all' ? null : STATUS_META[key];
                        const label = key === 'all' ? 'Todos' : `${meta!.emoji} ${meta!.label}`;
                        return (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                                    active
                                        ? 'bg-white text-black border-white'
                                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                {label} ({counts[key]})
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">Orden:</label>
                    <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value as SortKey)}
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 cursor-pointer"
                    >
                        {SORT_OPTIONS.map((opt) => (
                            <option key={opt.key} value={opt.key} className="bg-gray-900">
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest bg-black/50 text-gray-500">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">Artículo</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Fecha pub.</th>
                            <th className="px-4 py-3 text-right">Métricas</th>
                            <th className="px-4 py-3 text-right rounded-tr-lg">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {visiblePosts.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-600 font-mono text-xs">
                                    {posts.length === 0
                                        ? 'No hay artículos todavía.'
                                        : 'Ningún artículo matchea el filtro seleccionado.'}
                                </td>
                            </tr>
                        ) : (
                            visiblePosts.map((post) => {
                                const statusKey = resolveStatus(post);
                                const meta = STATUS_META[statusKey];
                                return (
                                    <tr key={post.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-4 py-4 max-w-md">
                                            <div className="font-medium text-gray-200 group-hover:text-white transition-colors line-clamp-1 overflow-hidden">{post.title}</div>
                                            <div className="text-[10px] text-gray-600 font-mono mt-1 truncate max-w-xs">/{post.slug}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${meta.classes}`}>
                                                {meta.emoji} {meta.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-xs font-mono text-gray-300">
                                            {formatPubDate(post.publishedAt)}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] uppercase tracking-tighter text-gray-500">Vistas: {post.views}</span>
                                                <span className="text-[10px] uppercase tracking-tighter text-blue-400">Clics: {post.clicks}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => onEdit(post)}
                                                    className="text-[10px] font-bold uppercase tracking-widest border border-blue-500/30 px-2 py-1 rounded text-blue-400 hover:bg-blue-500/10"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(post.id)}
                                                    className="text-[10px] font-bold uppercase tracking-widest border border-red-500/30 px-2 py-1 rounded text-red-500 hover:bg-red-500/10"
                                                >
                                                    Borrar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="pt-3 border-t border-gray-800 text-xs text-gray-600 font-mono flex justify-between">
                <span>Mostrando {visiblePosts.length} de {posts.length}</span>
                <span>Filtro y orden persisten en localStorage</span>
            </div>
        </div>
    );
};

export default PostList;
