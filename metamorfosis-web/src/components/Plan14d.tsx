/**
 * Plan14d — Plan IMR de 14 días personalizado por pilar débil (SPEC-100).
 *
 * Lee `users/{uid}.imr.current.blocks` desde Firestore, calcula el pilar
 * débil con `identifyWeakPillar` (SPEC-099) y renderiza el plan filtrado
 * de `getPlanForPillar`. La columna vertebral (14 días, fases, títulos,
 * descripciones) es común para todos; lo que cambia es la "acción del día"
 * según el pilar débil del usuario.
 *
 * Estados:
 *   - Loading: skeleton mientras carga el doc Firestore.
 *   - Sin auth: muestra CTA a /login. No redirige automáticamente para
 *     que el usuario pueda decidir si entra o sigue navegando.
 *   - Sin IMR: muestra CTA al quiz. El plan no tiene sentido sin
 *     diagnóstico previo.
 *   - Con IMR: renderiza los 14 días + cierre con CTA a ElenaApp.
 */
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/constants/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import type { UserDoc } from '../lib/types/user';
import { buildCanonicalPatch } from '../lib/legacy/elenaAppAdapter';
import { identifyWeakPillar } from '../lib/imr/weakPillar';
import { getPlanForPillar, pillarLabel, type DayPlanForUser } from '../lib/imr/plan14d';

interface PlanState {
    isLoading: boolean;
    needsAuth: boolean;
    needsImr: boolean;
    userName: string;
    weakPillarKey: 'E' | 'M' | 'C' | null;
    isOptimal: boolean;
    days: DayPlanForUser[];
}

const DEFAULT_STATE: PlanState = {
    isLoading: true,
    needsAuth: false,
    needsImr: false,
    userName: 'Biohacker',
    weakPillarKey: null,
    isOptimal: false,
    days: [],
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

                // SPEC-088: BD es fuente única del IMR. No recalculamos
                // en la web; solo leemos imr.current.blocks.
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
                // Si está óptimo, pasamos null al builder del plan para
                // que aplique rotación; si no, usamos el key del pilar
                // débil identificado.
                const pillarForPlan = weakPillar.isOptimal ? null : weakPillar.key;
                const days = getPlanForPillar(pillarForPlan);

                setState({
                    isLoading: false,
                    needsAuth: false,
                    needsImr: false,
                    userName: displayName || data.displayName || 'Biohacker',
                    weakPillarKey: weakPillar.isOptimal ? null : weakPillar.key,
                    isOptimal: weakPillar.isOptimal,
                    days,
                });

                // SPEC-100: tracking del usuario que efectivamente ve el plan.
                // Aplazado a un microtask para no bloquear el primer paint.
                queueMicrotask(() => {
                    if (typeof window !== 'undefined' && (window as any).umami) {
                        (window as any).umami.track('plan14d_visto', {
                            pillar: weakPillar.isOptimal ? 'optimal' : weakPillar.key,
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

    // ─── Plan completo ───────────────────────────────────────
    return (
        <div className="animate-fade-in space-y-8 pb-20">
            {/* Header */}
            <div className="border-b border-white/[0.06] pb-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent mb-2">
                    Tu plan IMR · 14 días
                </p>
                <h1 className="text-3xl md:text-4xl font-semibold text-text-primary tracking-tight mb-3">
                    {state.isOptimal ? (
                        <>Mantén tu balance, <span className="text-accent">{state.userName}</span></>
                    ) : (
                        <>Tu plan enfocado en <span className="text-accent">{pillarLabel(state.weakPillarKey)}</span></>
                    )}
                </h1>
                <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
                    {state.isOptimal
                        ? 'Los tres pilares están en zona óptima. Este plan rota acciones de los tres pilares cada día para que sigas explorando sin sobrecargar ninguno.'
                        : `Las 14 acciones siguientes están enfocadas en tu pilar de mayor oportunidad. La descripción de cada día es común; la acción concreta varía según el pilar que más impacta tu IMR hoy.`}
                </p>
            </div>

            {/* Cards de los 14 días */}
            <div className="space-y-4">
                {state.days.map((day) => {
                    const phaseColor = day.phase === 'Reset' ? '#00C49A' : '#10B981';
                    return (
                        <article
                            key={day.day}
                            className="bg-bg-surface border border-white/[0.06] rounded-xl p-5 md:p-6"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                {/* Día badge */}
                                <div
                                    className="flex-shrink-0 w-12 h-12 rounded-lg bg-accent/[0.08] border border-accent/30 flex flex-col items-center justify-center"
                                    style={{ borderColor: `${phaseColor}40` }}
                                >
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted leading-none">Día</span>
                                    <span className="text-base font-bold text-text-primary leading-none mt-0.5">{day.day}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p
                                        className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1"
                                        style={{ color: phaseColor }}
                                    >
                                        {day.phase}
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
                            <div className="bg-accent/[0.06] border border-accent/30 rounded-lg p-4">
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
                        </article>
                    );
                })}
            </div>

            {/* Cierre — CTA a ElenaApp / Cohorte */}
            <div className="bg-bg-surface border border-accent/30 rounded-2xl p-6 md:p-8 text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent mb-2">
                    Más allá de los 14 días
                </p>
                <h2 className="text-xl md:text-2xl font-semibold text-text-primary tracking-tight mb-3 max-w-lg mx-auto">
                    Sigue tu progreso con medición continua en ElenaApp
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-xl mx-auto">
                    Las primeras 1000 personas en sumarse tienen acceso anticipado y beneficios exclusivos. Tu lugar está conectado a tu correo automáticamente.
                </p>
                <a
                    href="/dashboard"
                    className="inline-block bg-accent hover:bg-accent-strong text-bg-base font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
                >
                    Volver a tu dashboard →
                </a>
            </div>
        </div>
    );
};

export default Plan14d;
