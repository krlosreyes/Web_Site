import React, { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

/**
 * Reactions de artículo (SPEC-032).
 *
 * Anónimo: muestra contadores + CTA registro.
 * Logueado: vota 👍/👎; permite cambiar/quitar voto.
 * Optimistic update + rollback en error.
 */

type ReactionValue = 'like' | 'dislike' | null;

interface Counts {
    likes: number;
    dislikes: number;
}

interface Props {
    slug: string;
    initialReactions?: Counts;
    /** SPEC-035: si el artículo tiene quiz, anónimos reciben CTA al test
     *  (en la misma página) en lugar de redirigir a /login. */
    hasQuiz?: boolean;
}

const PostReactions: React.FC<Props> = ({ slug, initialReactions, hasQuiz = false }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [counts, setCounts] = useState<Counts>(
        initialReactions ?? { likes: 0, dislikes: 0 }
    );
    const [userReaction, setUserReaction] = useState<ReactionValue>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setAuthLoading(false);
            if (u) {
                // Trae el voto actual del user
                try {
                    const idToken = await u.getIdToken();
                    const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/react`, {
                        headers: { Authorization: `Bearer ${idToken}` },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.success) {
                            setUserReaction(data.userReaction ?? null);
                            if (data.counts) setCounts(data.counts);
                        }
                    }
                } catch (err) {
                    console.error('[PostReactions] fetch initial state:', err);
                }
            }
        });
        return () => unsub();
    }, [slug]);

    const submitReaction = async (next: ReactionValue) => {
        if (!user || submitting) return;
        const previous = userReaction;
        const previousCounts = counts;

        // Optimistic update
        const optimistic: Counts = { ...counts };
        if (previous === 'like') optimistic.likes -= 1;
        if (previous === 'dislike') optimistic.dislikes -= 1;
        if (next === 'like') optimistic.likes += 1;
        if (next === 'dislike') optimistic.dislikes += 1;
        optimistic.likes = Math.max(0, optimistic.likes);
        optimistic.dislikes = Math.max(0, optimistic.dislikes);

        setUserReaction(next);
        setCounts(optimistic);
        setSubmitting(true);

        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/react`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ value: next }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.success) {
                setUserReaction(data.userReaction ?? null);
                if (data.counts) setCounts(data.counts);
            }
        } catch (err) {
            console.error('[PostReactions] submit error:', err);
            // Rollback
            setUserReaction(previous);
            setCounts(previousCounts);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClick = (intent: 'like' | 'dislike') => {
        if (!user) return; // anónimo: no hace nada (CTA visible aparte)
        // Toggle: si ya votaste lo mismo, quitar voto
        const next: ReactionValue = userReaction === intent ? null : intent;
        submitReaction(next);
    };

    const isLiked = userReaction === 'like';
    const isDisliked = userReaction === 'dislike';

    return (
        <section
            id="post-reactions"
            className="mt-16 p-8 md:p-10 bg-white/[0.02] border border-white/10 rounded-2xl relative overflow-hidden"
            aria-labelledby="post-reactions-title"
        >
            <h3
                id="post-reactions-title"
                className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-2"
            >
                ¿Te resultó útil este artículo?
            </h3>
            <p className="text-gray-400 text-sm mb-8 max-w-md">
                Tu reacción nos ayuda a entender qué temas profundizar y cuáles ajustar.
            </p>

            <div className="flex flex-wrap items-center gap-4">
                <button
                    type="button"
                    onClick={() => handleClick('like')}
                    disabled={!user || submitting}
                    aria-pressed={isLiked}
                    aria-label={`Me gusta — ${counts.likes} reacciones`}
                    className={`group flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all font-bold text-sm
                        ${isLiked
                            ? 'bg-[#00C49A]/15 border-[#00C49A]/50 text-[#00C49A] shadow-lg shadow-[#00C49A]/10'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:border-[#00C49A]/30 hover:bg-[#00C49A]/5'
                        }
                        ${!user ? 'opacity-60 cursor-not-allowed' : ''}
                        ${submitting ? 'opacity-70 cursor-wait' : ''}`}
                >
                    <span className="text-2xl leading-none">👍</span>
                    <span className="font-black tabular-nums text-lg">{counts.likes}</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-70">
                        Me gustó
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => handleClick('dislike')}
                    disabled={!user || submitting}
                    aria-pressed={isDisliked}
                    aria-label={`No me gusta — ${counts.dislikes} reacciones`}
                    className={`group flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all font-bold text-sm
                        ${isDisliked
                            ? 'bg-red-500/15 border-red-500/50 text-red-300 shadow-lg shadow-red-500/10'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:border-red-500/30 hover:bg-red-500/5'
                        }
                        ${!user ? 'opacity-60 cursor-not-allowed' : ''}
                        ${submitting ? 'opacity-70 cursor-wait' : ''}`}
                >
                    <span className="text-2xl leading-none">👎</span>
                    <span className="font-black tabular-nums text-lg">{counts.dislikes}</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-70">
                        No me gustó
                    </span>
                </button>

                {/* SPEC-035: CTA adaptativo para anónimos.
                    - Con quiz: scroll suave al test (mismo flow del artículo).
                    - Sin quiz: fallback a /login. */}
                {!authLoading && !user && hasQuiz && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            const target = document.getElementById('quiz-section');
                            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="ml-2 flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-300 hover:bg-blue-600/20 hover:border-blue-500/50 transition-all text-xs font-bold uppercase tracking-widest cursor-pointer"
                    >
                        🧪 Contesta el test para reaccionar
                    </button>
                )}
                {!authLoading && !user && !hasQuiz && (
                    <a
                        href="/login"
                        className="ml-2 flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-300 hover:bg-blue-600/20 hover:border-blue-500/50 transition-all text-xs font-bold uppercase tracking-widest"
                    >
                        🔒 Registrate para reaccionar
                    </a>
                )}

                {/* Indicador para logueados con voto */}
                {user && userReaction && (
                    <span className="ml-2 text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                        Tu voto: {userReaction === 'like' ? '👍' : '👎'} · Click de nuevo para quitarlo
                    </span>
                )}
            </div>
        </section>
    );
};

export default PostReactions;
