/**
 * Plan14d — Plan IMR de 14 días con progresión secuencial (SPEC-100 + SPEC-101).
 *
 * UX: el usuario solo ve el día actual abierto. Los días anteriores
 * aparecen colapsados con check. Los días futuros aparecen con candado.
 * Al marcar el día actual como completado, se persiste en Firestore y
 * la UI avanza al siguiente día.
 *
 * Sustento (SPEC-101): Lally 2010 (formación de hábitos), Locke & Latham
 * 2002 (goal setting + feedback), Zeigarnik effect. Patrón mainstream:
 * Duolingo, Couch to 5K, Headspace.
 *
 * Persistencia: escritura directa al doc `users/{uid}.plan14d` con
 * `updateDoc` (Web SDK). Coherente con el patrón de `bio`/`habits`.
 * Rules ya permiten al dueño escribir su doc.
 */
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/constants/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import type { UserDoc, UserPlan14d } from '../lib/types/user';
import { buildCanonicalPatch } from '../lib/legacy/elenaAppAdapter';
import { identifyWeakPillar } from '../lib/imr/weakPillar';
import { getPlanForPillar, pillarLabel, PLAN_TOTAL_DAYS, type DayPlanForUser } from '../lib/imr/plan14d';
import {
    INITIAL_PROGRESS,
    getCurrentDay,
    isDayCompleted,
    isDayLocked,
    canCompleteDay,
    canUndoLastDay,
    isPlanFinished,
    markDayComplete,
    undoLastDay,
} from '../lib/imr/plan14dProgress';

interface PlanState {
    isLoading: boolean;
    needsAuth: boolean;
    needsImr: boolean;
    uid: string | null;
    userName: string;
    weakPillarKey: 'E' | 'M' | 'C' | null;
    isOptimal: boolean;
    days: DayPlanForUser[];
    progress: UserPlan14d;
    /** true mientras un updateDoc está en vuelo — desactiva botones para evitar doble click. */
    isSavingProgress: boolean;
}

const DEFAULT_STATE: PlanState = {
    isLoading: true,
    needsAuth: false,
    needsImr: false,
    uid: null,
    userName: 'Biohacker',
    weakPillarKey: null,
    isOptimal: false,
    days: [],
    progress: INITIAL_PROGRESS,
    isSavingProgress: false,
};

const Plan14d = () => {
    const [state, setState] = useState<PlanState>(DEFAULT_STATE);

    useEffect(() => {
        const fetchUserAndBuildPlan = async (
            uid: string,
            displayName: string | null
        ) => {
            try {
                const userRef = doc(db, COLLECTIONS.USERS, uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    setState({
                        ...DEFAULT_STATE,
                        userName: displayName || 'Biohacker',
                        isLoading: false,
                        needsImr: true,
                    });
                    return;
                }

                const rawData = userSnap.data() as Record<string, unknown>;
                const { patch } = buildCanonicalPatch(rawData);
                const mergedData = patch ? { ...rawData, ...patch } : rawData;
                const data = mergedData as UserDoc;
                const current = data.imr?.current;

                if (!current || !current.blocks) {
                    setState({
                        ...DEFAULT_STATE,
                        userName: displayName || data.displayName || 'Biohacker',
                        isLoading: false,
                        needsImr: true,
                    });
                    return;
                }

                const weakPillar = identifyWeakPillar(current.blocks);
                const pillarForPlan = weakPillar.isOptimal ? null : weakPillar.key;
                const days = getPlanForPillar(pillarForPlan);
                const progress = data.plan14d ?? INITIAL_PROGRESS;

                setState({
                    isLoading: false,
                    needsAuth: false,
                    needsImr: false,
                    uid,
                    userName: displayName || data.displayName || 'Biohacker',
                    weakPillarKey: weakPillar.isOptimal ? null : weakPillar.key,
                    isOptimal: weakPillar.isOptimal,
                    days,
                    progress,
                    isSavingProgress: false,
                });

                queueMicrotask(() => {
                    if (typeof window !== 'undefined' && (window as any).umami) {
                        (window as any).umami.track('plan14d_visto', {
                            pillar: weakPillar.isOptimal ? 'optimal' : weakPillar.key,
                            currentDay: getCurrentDay(progress),
                            completedCount: progress.completedDays.length,
                        });
                    }
                });
            } catch (err) {
                console.error('[Plan14d] fetch error:', err);
                setState((prev) => ({ ...prev, isLoading: false, needsImr: true }));
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchUserAndBuildPlan(user.uid, user.displayName);
            } else {
                setState({
                    ...DEFAULT_STATE,
                    isLoading: false,
                    needsAuth: true,
                });
            }
        });
        return () => unsubscribe();
    }, []);

    /**
     * Persiste el nuevo progreso a Firestore. Optimista en la UI: si
     * la escritura falla, hace rollback al estado previo y avisa.
     */
    const persistProgress = async (newProgress: UserPlan14d) => {
        if (!state.uid) return;
        const prevProgress = state.progress;
        setState((s) => ({ ...s, progress: newProgress, isSavingProgress: true }));
        try {
            const userRef = doc(db, COLLECTIONS.USERS, state.uid);
            await updateDoc(userRef, { plan14d: newProgress });
            setState((s) => ({ ...s, isSavingProgress: false }));
        } catch (err) {
            console.error('[Plan14d] persistProgress error:', err);
            setState((s) => ({ ...s, progress: prevProgress, isSavingProgress: false }));
            alert('No se pudo guardar el progreso. Inténtalo de nuevo.');
        }
    };

    const handleMarkComplete = async (day: number) => {
        if (state.isSavingProgress) return;
        if (!canCompleteDay(state.progress, day)) return;
        const pillarForInitial = state.isOptimal ? null : state.weakPillarKey;
        const newProgress = markDayComplete(
            state.progress,
            day,
            pillarForInitial,
            new Date().toISOString()
        );

        // Tracking ANTES del persist (más fiable; sendBeacon-like).
        if (typeof window !== 'undefined' && (window as any).umami) {
            const daysSinceStart = newProgress.startedAt
                ? Math.floor(
                      (Date.now() - new Date(newProgress.startedAt).getTime()) /
                          86400000
                  )
                : 0;
            (window as any).umami.track('plan14d_dia_completado', {
                day,
                pillar: state.weakPillarKey ?? 'optimal',
                daysSinceStart,
            });
            if (day === PLAN_TOTAL_DAYS) {
                (window as any).umami.track('plan14d_finalizado', {
                    pillar: state.weakPillarKey ?? 'optimal',
                    daysSinceStart,
                });
            }
        }

        await persistProgress(newProgress);
    };

    const handleUndoLast = async () => {
        if (state.isSavingProgress) return;
        if (!canUndoLastDay(state.progress)) return;
        const newProgress = undoLastDay(state.progress);

        if (typeof window !== 'undefined' && (window as any).umami) {
            (window as any).umami.track('plan14d_undo', {
                undoneDay:
                    state.progress.completedDays[
                        state.progress.completedDays.length - 1
                    ] ?? null,
            });
        }

        await persistProgress(newProgress);
    };

    // ─── Loading skeleton ────────────────────────────────────
    if (state.isLoading) {
        return (
            <div className="animate-pulse space-y-6 pb-20">
                <div className="h-32 bg-bg-surface border border-white/[0.06] rounded-2xl"></div>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-48 bg-bg-surface border border-white/[0.06] rounded-xl"></div>
                ))}
            </div>
        );
    }

    // ─── Sin auth ────────────────────────────────────────────
    if (state.needsAuth) {
        return (
            <div className="bg-bg-surface border border-white/[0.06] rounded-2xl p-8 md:p-10 text-center max-w-xl mx-auto">
                <h2 className="text-2xl font-bold text-text-primary tracking-tight mb-3">
                    Inicia sesión para ver tu plan
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-md mx-auto">
                    Tu plan IMR de 14 días está vinculado a tu cuenta y a tu pilar de mayor oportunidad.
                </p>
                <a
                    href="/login"
                    className="inline-block bg-accent hover:bg-accent-strong text-bg-base font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
                >
                    Iniciar sesión →
                </a>
            </div>
        );
    }

    // ─── Sin IMR todavía ─────────────────────────────────────
    if (state.needsImr) {
        return (
            <div className="bg-bg-surface border border-white/[0.06] rounded-2xl p-8 md:p-10 text-center max-w-xl mx-auto">
                <h2 className="text-2xl font-bold text-text-primary tracking-tight mb-3">
                    Aún no tienes diagnóstico IMR
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-md mx-auto">
                    El plan de 14 días se personaliza con base en tu pilar de mayor oportunidad. Primero completa el quiz (toma 2 minutos).
                </p>
                <a
                    href="/quiz"
                    className="inline-block bg-accent hover:bg-accent-strong text-bg-base font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
                >
                    Iniciar diagnóstico IMR →
                </a>
            </div>
        );
    }

    // ─── Plan completo con progresión ────────────────────────
    const currentDay = getCurrentDay(state.progress);
    const finished = isPlanFinished(state.progress);

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            {/* Header */}
            <div className="border-b border-white/[0.06] pb-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent mb-2">
                    Tu plan IMR · {state.progress.completedDays.length} / {PLAN_TOTAL_DAYS} días
                </p>
                <h1 className="text-3xl md:text-4xl font-semibold text-text-primary tracking-tight mb-3">
                    {state.isOptimal ? (
                        <>Mantén tu balance, <span className="text-accent">{state.userName}</span></>
                    ) : (
                        <>Tu plan enfocado en <span className="text-accent">{pillarLabel(state.weakPillarKey)}</span></>
                    )}
                </h1>
                <p className="text-sm text-text-secondary leading-relaxed max-w-2xl mb-4">
                    {finished
                        ? 'Has completado los 14 días. Tu nuevo baseline está abajo — el siguiente paso es medición continua.'
                        : 'Cada día se desbloquea cuando marcas el anterior como completado. Avanza a tu ritmo — la consistencia importa más que la velocidad.'}
                </p>

                {/* Barra de progreso */}
                <div className="w-full bg-bg-base/60 rounded-full h-2 overflow-hidden">
                    <div
                        className="bg-accent h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${(state.progress.completedDays.length / PLAN_TOTAL_DAYS) * 100}%`,
                        }}
                    ></div>
                </div>

                {/* Botón undo */}
                {canUndoLastDay(state.progress) && !finished && (
                    <button
                        type="button"
                        onClick={handleUndoLast}
                        disabled={state.isSavingProgress}
                        className="mt-4 text-xs font-semibold text-text-muted hover:text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        ← Desmarcar último día
                    </button>
                )}
            </div>

            {/* Cards de los 14 días */}
            <div className="space-y-4">
                {state.days.map((day) => {
                    const completed = isDayCompleted(state.progress, day.day);
                    const locked = isDayLocked(state.progress, day.day);
                    const isCurrent = day.day === currentDay && !finished;
                    const phaseColor = day.phase === 'Reset' ? '#00C49A' : '#10B981';

                    // ─── Día COMPLETADO ──────────────────────────
                    if (completed) {
                        return (
                            <article
                                key={day.day}
                                className="bg-bg-surface border border-accent/30 rounded-xl p-4 md:p-5 opacity-70"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/[0.12] border border-accent/40 flex items-center justify-center text-accent">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className="text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5"
                                            style={{ color: phaseColor }}
                                        >
                                            Día {day.day} · {day.phase} · Completado
                                        </p>
                                        <p className="text-sm font-semibold text-text-primary leading-tight">
                                            {day.title}
                                        </p>
                                    </div>
                                </div>
                            </article>
                        );
                    }

                    // ─── Día LOCKED (futuro) ─────────────────────
                    if (locked) {
                        return (
                            <article
                                key={day.day}
                                className="bg-bg-surface/40 border border-white/[0.04] rounded-xl p-4 md:p-5"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-bg-base/60 border border-white/[0.06] flex items-center justify-center text-text-muted">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted mb-0.5">
                                            Día {day.day} · {day.phase} · Bloqueado
                                        </p>
                                        <p className="text-sm font-medium text-text-muted leading-tight">
                                            {day.title}
                                        </p>
                                    </div>
                                </div>
                            </article>
                        );
                    }

                    // ─── Día ACTUAL (current) — render completo ──
                    if (isCurrent) {
                        return (
                            <article
                                key={day.day}
                                className="bg-bg-surface border-2 border-accent/40 rounded-xl p-5 md:p-6 shadow-lg shadow-accent/5"
                            >
                                <div className="flex items-start gap-4 mb-4">
                                    <div
                                        className="flex-shrink-0 w-12 h-12 rounded-lg bg-accent/[0.12] border-2 flex flex-col items-center justify-center"
                                        style={{ borderColor: phaseColor }}
                                    >
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted leading-none">Día</span>
                                        <span className="text-base font-bold text-text-primary leading-none mt-0.5">{day.day}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p
                                            className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1"
                                            style={{ color: phaseColor }}
                                        >
                                            {day.phase} · Día actual
                                        </p>
                                        <h3 className="text-base md:text-lg font-semibold text-text-primary leading-tight break-words">
                                            {day.title}
                                        </h3>
                                    </div>
                                </div>

                                <p className="text-sm text-text-secondary leading-relaxed mb-4">
                                    {day.description}
                                </p>

                                {/* Acción específica */}
                                <div className="bg-accent/[0.06] border border-accent/30 rounded-lg p-4 mb-5">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-2">
                                        Acción del día · {pillarLabel(day.sourcePillar as any)}
                                    </p>
                                    <p className="text-sm font-semibold text-text-primary leading-snug mb-1.5">
                                        {day.action.title}
                                    </p>
                                    {day.action.detail && (
                                        <p className="text-xs text-text-secondary leading-relaxed">
                                            {day.action.detail}
                                        </p>
                                    )}
                                    {day.action.references && day.action.references.length > 0 && (
                                        <details className="mt-3">
                                            <summary className="text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary cursor-pointer transition-colors">
                                                Ver referencias ({day.action.references.length})
                                            </summary>
                                            <ul className="mt-2 space-y-1">
                                                {day.action.references.map((ref, i) => (
                                                    <li key={i} className="text-[10px] text-text-muted leading-relaxed pl-3 border-l border-white/[0.06]">
                                                        {ref}
                                                    </li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                </div>

                                {/* CTA marcar completado */}
                                <button
                                    type="button"
                                    onClick={() => handleMarkComplete(day.day)}
                                    disabled={state.isSavingProgress}
                                    className="w-full bg-accent hover:bg-accent-strong disabled:bg-bg-elevated disabled:text-text-muted text-bg-base font-semibold text-sm px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {state.isSavingProgress ? (
                                        'Guardando…'
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                            Marcar día como completado
                                        </>
                                    )}
                                </button>
                            </article>
                        );
                    }

                    // No debería llegar acá, pero defensive return.
                    return null;
                })}
            </div>

            {/* Cierre — solo se muestra cuando el plan está finalizado */}
            {finished && (
                <div className="bg-bg-surface border border-accent/30 rounded-2xl p-6 md:p-8 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent mb-2">
                        Plan completado
                    </p>
                    <h2 className="text-xl md:text-2xl font-semibold text-text-primary tracking-tight mb-3 max-w-lg mx-auto">
                        Has completado tu plan IMR de 14 días
                    </h2>
                    <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-xl mx-auto">
                        Tu nuevo baseline está consolidado. El siguiente paso es medición continua con ElenaApp — las primeras 1000 personas tienen acceso anticipado.
                    </p>
                    <a
                        href="/dashboard"
                        className="inline-block bg-accent hover:bg-accent-strong text-bg-base font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
                    >
                        Volver a tu dashboard →
                    </a>
                </div>
            )}
        </div>
    );
};

export default Plan14d;
