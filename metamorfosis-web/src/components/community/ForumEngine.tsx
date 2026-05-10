import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

/**
 * Foro de comunidad funcional con persistencia Firestore (SPEC-033).
 *
 * Reemplaza el dummy anterior. Persistencia vía endpoints `/api/forum/*`
 * con Admin SDK + transactions atómicas.
 *
 * Gating actual: cualquier user logueado (anónimo ve gate "Identifícate").
 */

// ─── Iconos SVG inline ─────────────────────────────────────────────
const Icon = ({ d, size = 20, className = "" }: { d: string; size?: number; className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d={d} />
    </svg>
);

const Icons = {
    Search: (props: any) => <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" {...props} />,
    Message: (props: any) => <Icon d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" {...props} />,
    Trending: (props: any) => <Icon d="M23 6l-9.5 9.5-5-5L1 18" {...props} />,
    Users: (props: any) => <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" {...props} />,
    ChevronRight: (props: any) => <Icon d="M9 5l7 7-7 7" {...props} />,
    ChevronLeft: (props: any) => <Icon d="M15 19l-7-7 7-7" {...props} />,
    Timer: (props: any) => <Icon d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" {...props} />,
    Zap: (props: any) => <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" {...props} />,
    Heart: (props: any) => <Icon d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" {...props} />,
    Brain: (props: any) => <Icon d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-5 0V11" {...props} />,
    Send: (props: any) => <Icon d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" {...props} />,
    Lock: (props: any) => <Icon d="M7 11V7a5 5 0 0110 0v4M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z" {...props} />,
    Trash: (props: any) => <Icon d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" {...props} />,
    Eye: (props: any) => <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zm11-3a3 3 0 100 6 3 3 0 000-6z" {...props} />,
};

// ─── Avatar ──────────────────────────────────────────────────────
const AVATAR_COLORS = [
    'bg-blue-500/20 border-blue-500/40 text-blue-300',
    'bg-[#00C49A]/20 border-[#00C49A]/40 text-[#00C49A]',
    'bg-purple-500/20 border-purple-500/40 text-purple-300',
    'bg-pink-500/20 border-pink-500/40 text-pink-300',
    'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
    'bg-orange-500/20 border-orange-500/40 text-orange-300',
    'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
    'bg-red-500/20 border-red-500/40 text-red-300',
];

const Avatar: React.FC<{ initial: string; colorIdx: number; size?: 'sm' | 'md' | 'lg' }> = ({
    initial,
    colorIdx,
    size = 'md',
}) => {
    const cls = AVATAR_COLORS[Math.max(0, Math.min(7, colorIdx ?? 0))];
    const dim = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
    return (
        <div
            className={`${dim} rounded-full border ${cls} flex items-center justify-center font-black uppercase shrink-0`}
            aria-hidden="true"
        >
            {initial || '?'}
        </div>
    );
};

// ─── Tipos ────────────────────────────────────────────────────────
interface Topic {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    authorUid: string;
    authorName: string;
    authorInitial: string;
    authorColorIdx: number;
    replyCount: number;
    likeCount: number;
    views: number;
    status: string;
    createdAt: string;
}

interface Reply {
    id: string;
    content: string;
    authorUid: string;
    authorName: string;
    authorInitial: string;
    authorColorIdx: number;
    status: string;
    createdAt: string;
    /** SPEC-036: contador denormalizado de likes en la reply. */
    likeCount?: number;
}

const CATEGORIES = [
    { id: 'todos', name: 'La Tribu', icon: <Icons.Users size={16} /> },
    { id: 'ayuno', name: 'Ayuno', icon: <Icons.Timer size={16} /> },
    { id: 'bio', name: 'Biohacking', icon: <Icons.Zap size={16} /> },
    { id: 'longevity', name: 'Longevidad', icon: <Icons.Heart size={16} /> },
    { id: 'mind', name: 'Cerebro', icon: <Icons.Brain size={16} /> },
    { id: 'general', name: 'General', icon: <Icons.Message size={16} /> },
];

/** Formato relativo simple ("2h", "3d", "ahora"). */
function relTime(iso: string): string {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    if (isNaN(ms) || ms < 0) return '';
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d`;
    const mo = Math.floor(d / 30);
    return `${mo}mo`;
}

// ─── Component principal ─────────────────────────────────────────
const ForumEngine = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [topics, setTopics] = useState<Topic[]>([]);
    const [topicsLoading, setTopicsLoading] = useState(true);
    const [topicsError, setTopicsError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('todos');

    const [isCreating, setIsCreating] = useState(false);
    const [newTopic, setNewTopic] = useState({ title: '', content: '', category: 'general' });
    const [submittingTopic, setSubmittingTopic] = useState(false);

    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const [replies, setReplies] = useState<Reply[]>([]);
    const [topicLoading, setTopicLoading] = useState(false);
    const [replyDraft, setReplyDraft] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);
    const [topicLiked, setTopicLiked] = useState(false);
    /** SPEC-036: estado de likes del user actual en cada reply (replyId → bool). */
    const [replyLikes, setReplyLikes] = useState<Record<string, boolean>>({});

    // ─── Auth listener ───
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return () => unsub();
    }, []);

    // ─── Fetch topics ───
    const fetchTopics = useCallback(async () => {
        setTopicsLoading(true);
        setTopicsError(null);
        try {
            const params = new URLSearchParams();
            if (activeCategory !== 'todos') params.set('category', activeCategory);
            const res = await fetch(`/api/forum/topics?${params.toString()}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.success) setTopics(data.topics);
        } catch (err) {
            console.error('[ForumEngine] fetchTopics:', err);
            setTopicsError('No pudimos cargar los topics.');
        } finally {
            setTopicsLoading(false);
        }
    }, [activeCategory]);

    useEffect(() => {
        fetchTopics();
    }, [fetchTopics]);

    // ─── Fetch detalle ───
    const fetchTopicDetail = useCallback(async (id: string) => {
        setTopicLoading(true);
        try {
            const res = await fetch(`/api/forum/topics/${encodeURIComponent(id)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.success) {
                setSelectedTopic(data.topic);
                setReplies(data.replies || []);
            }
            // Trae el estado de like del topic + likes de cada reply
            if (user) {
                try {
                    const idToken = await user.getIdToken();
                    const lr = await fetch(`/api/forum/topics/${encodeURIComponent(id)}/like`, {
                        headers: { Authorization: `Bearer ${idToken}` },
                    });
                    if (lr.ok) {
                        const ld = await lr.json();
                        setTopicLiked(!!ld.liked);
                    }
                    // SPEC-036: estado de likes en cada reply
                    if (data.success && Array.isArray(data.replies)) {
                        const likesMap: Record<string, boolean> = {};
                        await Promise.all(
                            data.replies.map(async (r: Reply) => {
                                try {
                                    const rlr = await fetch(
                                        `/api/forum/replies/like?topicId=${encodeURIComponent(id)}&replyId=${encodeURIComponent(r.id)}`,
                                        { headers: { Authorization: `Bearer ${idToken}` } }
                                    );
                                    if (rlr.ok) {
                                        const rld = await rlr.json();
                                        likesMap[r.id] = !!rld.liked;
                                    }
                                } catch {
                                    // ignorar
                                }
                            })
                        );
                        setReplyLikes(likesMap);
                    }
                } catch {
                    // no crítico
                }
            } else {
                setTopicLiked(false);
                setReplyLikes({});
            }
        } catch (err) {
            console.error('[ForumEngine] fetchTopicDetail:', err);
        } finally {
            setTopicLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (selectedTopicId) fetchTopicDetail(selectedTopicId);
    }, [selectedTopicId, fetchTopicDetail]);

    // ─── Filtro client-side ───
    const visibleTopics = useMemo(() => {
        const term = search.trim().toLowerCase();
        return topics.filter((t) => {
            if (!term) return true;
            return (
                t.title.toLowerCase().includes(term) ||
                t.content.toLowerCase().includes(term)
            );
        });
    }, [topics, search]);

    // ─── Acciones ───
    const handleCreateTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || submittingTopic) return;
        if (newTopic.title.trim().length < 3 || newTopic.content.trim().length < 5) return;

        setSubmittingTopic(true);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/forum/topics', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify(newTopic),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            setIsCreating(false);
            setNewTopic({ title: '', content: '', category: 'general' });
            await fetchTopics();
        } catch (err: any) {
            console.error('[ForumEngine] createTopic:', err);
            alert('Error creando topic: ' + (err?.message || 'desconocido'));
        } finally {
            setSubmittingTopic(false);
        }
    };

    const handleDeleteTopic = async (topicId: string) => {
        if (!user) return;
        if (!confirm('¿Eliminar este topic? La acción es reversible solo desde admin.')) return;
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`/api/forum/topics/${encodeURIComponent(topicId)}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            // Si estábamos viendo el detalle, salir
            if (selectedTopicId === topicId) {
                setSelectedTopicId(null);
                setSelectedTopic(null);
            }
            await fetchTopics();
        } catch (err: any) {
            console.error('[ForumEngine] deleteTopic:', err);
            alert('Error eliminando: ' + (err?.message || 'desconocido'));
        }
    };

    const handleSubmitReply = async () => {
        if (!user || !selectedTopicId || submittingReply) return;
        if (replyDraft.trim().length < 2) return;
        setSubmittingReply(true);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(
                `/api/forum/topics/${encodeURIComponent(selectedTopicId)}/replies`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({ content: replyDraft.trim() }),
                }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            setReplyDraft('');
            await fetchTopicDetail(selectedTopicId);
        } catch (err: any) {
            console.error('[ForumEngine] submitReply:', err);
            alert('Error enviando reply: ' + (err?.message || 'desconocido'));
        } finally {
            setSubmittingReply(false);
        }
    };

    const handleDeleteReply = async (replyId: string) => {
        if (!user || !selectedTopicId) return;
        if (!confirm('¿Eliminar este comentario?')) return;
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(
                `/api/forum/topics/${encodeURIComponent(selectedTopicId)}/replies/${encodeURIComponent(replyId)}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${idToken}`,
                    },
                }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await fetchTopicDetail(selectedTopicId);
        } catch (err: any) {
            console.error('[ForumEngine] deleteReply:', err);
            alert('Error eliminando reply: ' + (err?.message || 'desconocido'));
        }
    };

    const handleToggleLike = async () => {
        if (!user || !selectedTopicId || !selectedTopic) return;
        const next = !topicLiked;
        // optimistic
        setTopicLiked(next);
        setSelectedTopic({
            ...selectedTopic,
            likeCount: Math.max(0, (selectedTopic.likeCount || 0) + (next ? 1 : -1)),
        });
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(
                `/api/forum/topics/${encodeURIComponent(selectedTopicId)}/like`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({ liked: next }),
                }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.success) {
                setTopicLiked(!!data.liked);
                if (typeof data.likeCount === 'number') {
                    setSelectedTopic((prev) => (prev ? { ...prev, likeCount: data.likeCount } : prev));
                }
            }
        } catch (err) {
            console.error('[ForumEngine] toggleLike:', err);
            // rollback
            setTopicLiked(!next);
            setSelectedTopic((prev) =>
                prev ? { ...prev, likeCount: Math.max(0, (prev.likeCount || 0) + (next ? -1 : 1)) } : prev
            );
        }
    };

    /** SPEC-036: toggle like de una reply con optimistic update y rollback. */
    const handleToggleReplyLike = async (replyId: string) => {
        if (!user || !selectedTopicId) return;
        const wasLiked = !!replyLikes[replyId];
        const next = !wasLiked;

        // Optimistic
        setReplyLikes((prev) => ({ ...prev, [replyId]: next }));
        setReplies((prev) =>
            prev.map((r) =>
                r.id === replyId
                    ? { ...r, likeCount: Math.max(0, (r.likeCount ?? 0) + (next ? 1 : -1)) }
                    : r
            )
        );

        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/forum/replies/like', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    topicId: selectedTopicId,
                    replyId,
                    liked: next,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.success) {
                setReplyLikes((prev) => ({ ...prev, [replyId]: !!data.liked }));
                if (typeof data.likeCount === 'number') {
                    setReplies((prev) =>
                        prev.map((r) => (r.id === replyId ? { ...r, likeCount: data.likeCount } : r))
                    );
                }
            }
        } catch (err) {
            console.error('[ForumEngine] toggleReplyLike:', err);
            // Rollback
            setReplyLikes((prev) => ({ ...prev, [replyId]: wasLiked }));
            setReplies((prev) =>
                prev.map((r) =>
                    r.id === replyId
                        ? { ...r, likeCount: Math.max(0, (r.likeCount ?? 0) + (next ? -1 : 1)) }
                        : r
                )
            );
        }
    };

    // ─── Render: loading auth ───
    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
                <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Validando sesión…</p>
            </div>
        );
    }

    // ─── Render: gate de identificación (anónimo) ───
    if (!user) {
        return (
            <div className="max-w-4xl mx-auto mt-12 bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[300px] bg-blue-600/10 blur-[120px] -z-10"></div>
                <div className="w-20 h-20 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                    <Icons.Lock size={32} className="text-blue-400" />
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter mb-6 leading-tight break-words">
                    Identificate para entrar a <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#00C49A]">La Tribu</span>
                </h2>
                <p className="text-gray-400 text-base max-w-xl mx-auto mb-12 font-medium">
                    El foro es exclusivo para usuarios registrados. Crea tu cuenta o iniciá sesión para participar.
                </p>
                <a
                    href="/login"
                    className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs px-10 py-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all"
                >
                    Identificarse →
                </a>
            </div>
        );
    }

    // ─── Render: detalle del topic ───
    if (selectedTopicId) {
        return (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <button
                    onClick={() => {
                        setSelectedTopicId(null);
                        setSelectedTopic(null);
                        setReplies([]);
                        setTopicLiked(false);
                    }}
                    className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 font-bold text-xs uppercase tracking-widest transition-colors"
                >
                    <Icons.ChevronLeft size={16} /> Volver a La Tribu
                </button>

                {topicLoading || !selectedTopic ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-8 md:p-16 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px]"></div>
                        <div className="flex items-center gap-4 mb-8 flex-wrap">
                            <Avatar
                                initial={selectedTopic.authorInitial || selectedTopic.authorName?.charAt(0).toUpperCase() || '?'}
                                colorIdx={selectedTopic.authorColorIdx ?? 0}
                                size="lg"
                            />
                            <div className="min-w-0 flex-1">
                                <h4 className="text-white font-bold break-words">{selectedTopic.authorName}</h4>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                                    Biohacker · Hace {relTime(selectedTopic.createdAt)} · {selectedTopic.views || 0} vistas
                                </p>
                            </div>
                            {user.uid === selectedTopic.authorUid && (
                                <button
                                    onClick={() => handleDeleteTopic(selectedTopic.id)}
                                    className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 border border-red-500/30 hover:bg-red-500/10 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <Icons.Trash size={12} /> Eliminar
                                </button>
                            )}
                        </div>
                        <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter mb-8 leading-tight break-words">
                            {selectedTopic.title}
                        </h2>
                        <p className="text-gray-300 text-base md:text-lg leading-relaxed font-medium mb-10 whitespace-pre-wrap break-words">
                            {selectedTopic.content}
                        </p>

                        {/* Like button */}
                        <button
                            onClick={handleToggleLike}
                            aria-pressed={topicLiked}
                            className={`mb-10 flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all font-bold text-sm
                                ${topicLiked
                                    ? 'bg-pink-500/15 border-pink-500/50 text-pink-300'
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:border-pink-500/30'}`}
                        >
                            <Icons.Heart size={18} className={topicLiked ? 'fill-current' : ''} />
                            <span className="tabular-nums">{selectedTopic.likeCount || 0}</span>
                            <span className="text-[10px] uppercase tracking-widest opacity-70">
                                {topicLiked ? 'Te gustó' : 'Me gusta'}
                            </span>
                        </button>

                        <div className="border-t border-white/5 pt-10">
                            <h5 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-6">
                                Respuestas ({replies.length})
                            </h5>

                            {/* Lista de replies */}
                            <div className="space-y-4 mb-8">
                                {replies.length === 0 ? (
                                    <p className="text-gray-600 text-sm italic">Sé el primero en responder.</p>
                                ) : (
                                    replies.map((r) => {
                                        const liked = !!replyLikes[r.id];
                                        return (
                                            <div key={r.id} className="flex gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                                                <Avatar
                                                    initial={r.authorInitial || r.authorName?.charAt(0).toUpperCase() || '?'}
                                                    colorIdx={r.authorColorIdx ?? 0}
                                                    size="sm"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                        <span className="text-white font-bold text-sm">{r.authorName}</span>
                                                        <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">
                                                            Hace {relTime(r.createdAt)}
                                                        </span>
                                                        {user.uid === r.authorUid && (
                                                            <button
                                                                onClick={() => handleDeleteReply(r.id)}
                                                                className="ml-auto text-[10px] text-red-500 hover:text-red-400 transition-colors"
                                                                aria-label="Eliminar comentario"
                                                            >
                                                                <Icons.Trash size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words mb-3">{r.content}</p>
                                                    {/* SPEC-036: like en reply */}
                                                    <button
                                                        onClick={() => handleToggleReplyLike(r.id)}
                                                        aria-pressed={liked}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all
                                                            ${liked
                                                                ? 'bg-pink-500/15 border-pink-500/40 text-pink-300'
                                                                : 'bg-white/5 border-white/10 text-gray-400 hover:border-pink-500/30 hover:text-pink-300'}`}
                                                    >
                                                        <Icons.Heart size={12} className={liked ? 'fill-current' : ''} />
                                                        <span className="tabular-nums">{r.likeCount ?? 0}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Form reply */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-3">
                                <textarea
                                    value={replyDraft}
                                    onChange={(e) => setReplyDraft(e.target.value)}
                                    placeholder="Comparte tu experiencia o duda…"
                                    className="flex-1 bg-transparent border-none outline-none text-white text-sm resize-none placeholder:text-gray-600"
                                    rows={2}
                                    maxLength={2000}
                                />
                                <button
                                    onClick={handleSubmitReply}
                                    disabled={submittingReply || replyDraft.trim().length < 2}
                                    className="bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0"
                                    aria-label="Enviar respuesta"
                                >
                                    <Icons.Send size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ─── Render: lista de topics ───
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">
            <aside className="lg:col-span-3 space-y-6">
                <a href="/dashboard" className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group shadow-lg">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                        <Icons.ChevronLeft size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Panel de Control</p>
                        <p className="text-xs text-white font-bold uppercase">Volver al Perfil</p>
                    </div>
                </a>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 px-2">Categorías</h3>
                    <div className="space-y-1">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${activeCategory === cat.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:bg-white/5'}`}
                            >
                                <span className="flex items-center gap-3 font-bold text-sm">
                                    {cat.icon}
                                    {cat.name}
                                </span>
                                <Icons.ChevronRight size={14} className={activeCategory === cat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} />
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            <section className="lg:col-span-9 space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white/[0.02] p-4 rounded-[2rem] border border-white/5 backdrop-blur-xl">
                    <div className="relative flex-1 w-full">
                        <Icons.Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar en La Tribu…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-blue-500/50 transition-all text-sm font-medium"
                        />
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="w-full md:w-auto bg-[#00C49A] text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.03] transition-all shadow-xl shadow-[#00C49A]/20"
                    >
                        + Nuevo Tema
                    </button>
                </div>

                {isCreating && (
                    <div className="bg-blue-600/5 border border-blue-500/20 p-6 md:p-10 rounded-[2.5rem] mb-6">
                        <form onSubmit={handleCreateTopic} className="space-y-6">
                            <input
                                placeholder="Título del tema…"
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold outline-none focus:border-blue-500"
                                value={newTopic.title}
                                maxLength={200}
                                onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                            />
                            <textarea
                                placeholder="Comparte tu conocimiento o duda…"
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-gray-300 text-sm outline-none focus:border-blue-500 min-h-[150px] resize-y"
                                value={newTopic.content}
                                maxLength={5000}
                                onChange={(e) => setNewTopic({ ...newTopic, content: e.target.value })}
                            />
                            <select
                                value={newTopic.category}
                                onChange={(e) => setNewTopic({ ...newTopic, category: e.target.value })}
                                className="w-full sm:w-auto bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
                            >
                                {CATEGORIES.filter((c) => c.id !== 'todos').map((c) => (
                                    <option key={c.id} value={c.id} className="bg-gray-900">
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            <div className="flex justify-end gap-6 items-center">
                                <button
                                    type="button"
                                    onClick={() => setIsCreating(false)}
                                    className="text-[10px] text-gray-500 font-black uppercase"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingTopic}
                                    className="bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20"
                                >
                                    {submittingTopic ? 'Publicando…' : 'Publicar en La Tribu'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {topicsError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 font-mono text-xs">
                        ⚠️ {topicsError}
                    </div>
                )}

                {topicsLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {visibleTopics.length === 0 ? (
                            <div className="text-center py-20 text-gray-600 font-mono text-sm">
                                {topics.length === 0
                                    ? 'No hay topics todavía. Sé el primero en publicar.'
                                    : 'Ningún topic matchea tu búsqueda.'}
                            </div>
                        ) : (
                            visibleTopics.map((topic) => (
                                <div
                                    key={topic.id}
                                    onClick={() => setSelectedTopicId(topic.id)}
                                    className="group bg-white/[0.02] border border-white/5 p-6 md:p-8 rounded-[2rem] hover:bg-white/[0.05] hover:border-blue-500/30 transition-all cursor-pointer relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start gap-6">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-4 flex-wrap">
                                                {topic.tags?.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 bg-blue-400/5 px-2.5 py-1 rounded border border-blue-400/10"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                <span className="text-[10px] text-gray-500 font-bold">
                                                    Hace {relTime(topic.createdAt)}
                                                </span>
                                            </div>
                                            <h3 className="text-xl md:text-2xl font-black text-white mb-3 group-hover:text-blue-400 transition-colors leading-tight italic uppercase tracking-tighter break-words">
                                                {topic.title}
                                            </h3>
                                            <p className="text-gray-500 text-sm md:text-base line-clamp-2 mb-6 font-medium leading-relaxed break-words">
                                                {topic.content}
                                            </p>
                                            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.1em] text-gray-600 group-hover:text-gray-400 transition-colors flex-wrap">
                                                <span className="flex items-center gap-2">
                                                    <Avatar
                                                        initial={topic.authorInitial || topic.authorName?.charAt(0).toUpperCase() || '?'}
                                                        colorIdx={topic.authorColorIdx ?? 0}
                                                        size="sm"
                                                    />
                                                    {topic.authorName}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Icons.Message size={14} className="text-blue-600" />
                                                    {topic.replyCount || 0}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Icons.Heart size={14} className="text-pink-500" />
                                                    {topic.likeCount || 0}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Icons.Eye size={14} className="text-gray-500" />
                                                    {topic.views || 0}
                                                </span>
                                            </div>
                                        </div>
                                        <Icons.ChevronRight size={28} className="text-gray-800 group-hover:text-blue-500 transition-all shrink-0" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </section>
        </div>
    );
};

export default ForumEngine;
