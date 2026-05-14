import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/constants/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import type { UserDoc } from '../lib/types/user';
import { buildCanonicalPatch } from '../lib/legacy/elenaAppAdapter';

const Icons = {
    Estructura: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    Metabolismo: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
    Conducta: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    Rocket: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>,
    ArrowRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
};

interface DashboardStats {
    imr: number;
    userName: string;
    zona: string;
    blocks: { E: number; M: number; C: number };
    bodyFatPct: number | null;
    leanMassPct: number | null;
    metabolicAge: number | null;
    completedQuizzes?: any[];
    isLoading: boolean;
    /** Sin perfil completo: el user nunca onboardeó en ningún lado. */
    needsOnboarding?: boolean;
    /** SPEC-088: tiene perfil completo pero `imr.current` aún no se escribió.
     *  Caso típico: user registrado en ElenaApp que aún no completó su
     *  primera medición o cuya app aún no deployó canonical-mirror. */
    hasProfileNoImr?: boolean;
    /** SPEC-057: si el user es fundador, mostramos su número + beneficios. */
    founderNumber: number | null;
}

const DEFAULT_STATS: DashboardStats = {
    imr: 0,
    userName: 'Biohacker',
    zona: 'Analizando...',
    blocks: { E: 0, M: 0, C: 0 },
    bodyFatPct: null,
    leanMassPct: null,
    metabolicAge: null,
    isLoading: true,
    founderNumber: null,
};

const BioDashboard = () => {
    const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);

    useEffect(() => {
        const fetchUserData = async (uid: string, displayName: string | null) => {
            try {
                const userRef = doc(db, COLLECTIONS.USERS, uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    setStats({
                        ...DEFAULT_STATS,
                        userName: displayName || 'Biohacker',
                        zona: 'Sin diagnóstico',
                        isLoading: false,
                        needsOnboarding: true,
                    });
                    return;
                }

                // SPEC-087 + SPEC-088: si el doc viene en shape legacy de
                // ElenaApp, mapeamos campos canónicos en memoria
                // (displayName, bio, habits, meta) para esta render. El
                // patch NO incluye `imr.current` — el sitio NO calcula
                // IMR: la BD es fuente única. Si el doc no tiene
                // imr.current, mostramos copy honesto.
                const rawData = userSnap.data() as Record<string, unknown>;
                const { patch } = buildCanonicalPatch(rawData);
                const mergedData = patch ? { ...rawData, ...patch } : rawData;
                const data = mergedData as UserDoc;
                const current = data.imr?.current;

                // SPEC-088: distinguimos "user sin perfil" de "user con
                // perfil pero sin IMR escrito por nadie todavía".
                const hasProfile =
                    !!data.bio?.heightCm ||
                    typeof (data as any).height === 'number';

                setStats({
                    imr: current?.imrScore ?? 0,
                    userName: displayName || data.displayName || 'Biohacker',
                    zona: current?.label ?? 'Sin diagnóstico',
                    blocks: current?.blocks ?? { E: 0, M: 0, C: 0 },
                    bodyFatPct: data.bio?.bodyFatPct ?? null,
                    leanMassPct: data.bio?.leanMassPct ?? null,
                    metabolicAge: current?.metabolicAge ?? null,
                    completedQuizzes: (data as any).completedQuizzes ?? [],
                    isLoading: false,
                    needsOnboarding: !current && !hasProfile,
                    hasProfileNoImr: !current && hasProfile,
                    // SPEC-057: fallback visual de los beneficios fundador
                    // si el email transaccional no llegó al user.
                    founderNumber: data.founder?.isFounder
                        ? (data.founder?.number ?? null)
                        : null,
                });
            } catch (err) {
                console.error('[BioDashboard] fetch error:', err);
                setStats((prev) => ({
                    ...prev,
                    userName: displayName || 'Biohacker',
                    isLoading: false,
                }));
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchUserData(user.uid, user.displayName);
            } else {
                // No logueado: fallback a sessionStorage (resultado del quiz anónimo)
                const localScore = sessionStorage.getItem('imr_score');
                const localLabel = sessionStorage.getItem('imr_label');
                const localName = sessionStorage.getItem('imr_userName');
                if (localScore) {
                    setStats({
                        ...DEFAULT_STATS,
                        imr: parseInt(localScore, 10) || 0,
                        userName: localName || 'Biohacker',
                        zona: localLabel || 'Diagnóstico IMR',
                        blocks: { E: 0.5, M: 0.4, C: 0.6 },
                        isLoading: false,
                    });
                } else {
                    // Anónimo sin quiz previo: mostrar CTA al onboarding
                    setStats((prev) => ({ ...prev, isLoading: false, needsOnboarding: true }));
                }
            }
        });
        return () => unsubscribe();
    }, []);

    const imrColor = stats.imr < 40 ? '#EF4444' : stats.imr < 60 ? '#F59E0B' : '#10B981';

    const blocksMapping = [
        { key: 'E', label: 'Estructura', icon: <Icons.Estructura /> },
        { key: 'M', label: 'Metabolismo', icon: <Icons.Metabolismo /> },
        { key: 'C', label: 'Conducta', icon: <Icons.Conducta /> }
    ];

    const getBestQuizzes = () => {
        if (!stats.completedQuizzes || stats.completedQuizzes.length === 0) return [];
        const bestScores = new Map<string, any>();
        stats.completedQuizzes.forEach((quiz: any) => {
            if (!bestScores.has(quiz.articleId) || bestScores.get(quiz.articleId).score < quiz.score) {
                bestScores.set(quiz.articleId, quiz);
            }
        });
        return Array.from(bestScores.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const bestQuizzes = getBestQuizzes();

    return (
        <div className="animate-fade-in space-y-12 pb-20">
            {/* SPEC-057 + SPEC-096: banner de acceso anticipado. Visible solo
                si el user pertenece al cohorte de los primeros 1000
                (founder.isFounder=true en el schema interno). Cumple doble
                función:
                  1. Reconocimiento permanente — el user sabe que está adentro.
                  2. Fallback al email transaccional: si por cualquier motivo
                     el correo de bienvenida no llegó, los beneficios siguen
                     visibles en el dashboard.
                SPEC-096: copy reescrito sin "fundador" para reducir fricción
                transaccional. El schema interno (founder.*) se mantiene. */}
            {stats.founderNumber !== null && !stats.isLoading && (
                <div className="bg-bg-surface border border-accent/30 rounded-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5">
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl shrink-0">
                            🚀
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent mb-1">
                                Acceso anticipado
                            </div>
                            <div className="text-base font-semibold text-text-primary leading-tight">
                                Tu lugar en ElenaApp está reservado
                            </div>
                        </div>
                    </div>

                    {/* Lado derecho — beneficios concisos */}
                    <div className="flex-1 min-w-0 md:border-l md:border-white/[0.06] md:pl-6">
                        <p className="text-sm text-text-secondary leading-relaxed">
                            <span className="text-text-primary font-semibold">Precio preferencial</span> en ElenaApp + <span className="text-text-primary font-semibold">beneficios exclusivos</span> de lanzamiento.
                        </p>
                        <p className="mt-2 text-[11px] text-text-muted uppercase tracking-wider">
                            Sin acción requerida — te identificamos por tu correo
                        </p>
                    </div>
                </div>
            )}

            {/* Banner: user sin perfil (nunca onboardeó). */}
            {stats.needsOnboarding && !stats.isLoading && (
                <div className="bg-bg-surface border border-accent/20 rounded-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                            <Icons.Estructura />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold text-text-primary mb-1">Tu diagnóstico está vacío</h3>
                            <p className="text-sm text-text-secondary leading-relaxed">Haz tu diagnóstico IMR en 2 minutos y desbloquea tu reporte completo.</p>
                        </div>
                    </div>
                    <a href="/quiz" className="bg-accent hover:bg-accent-strong text-bg-base font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap shrink-0">
                        Iniciar diagnóstico →
                    </a>
                </div>
            )}

            {/* SPEC-088: banner cuando el user tiene perfil completo
                pero ningún cliente (app o sitio) escribió todavía
                imr.current. Caso típico: user registrado en ElenaApp
                que aún no completó su primera medición o cuya app aún
                no deployó canonical-mirror. Copy honesto, sin números
                inventados. */}
            {stats.hasProfileNoImr && !stats.isLoading && (
                <div className="bg-bg-surface border border-accent/20 rounded-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                            <Icons.Metabolismo />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold text-text-primary mb-1">Tu IMR aún no está disponible</h3>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                Completa tu primera medición en <span className="text-text-primary font-semibold">ElenaApp</span> y tu Índice Metabólico Real aparecerá aquí automáticamente.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SPEC-072: header proporcionado al dashboard (no es el hero
                principal del sitio, así que NO usamos italic+uppercase+gradient
                grande — esa decoración queda reservada al Hero de la home).
                Saludo en text-3xl Inter sans, nombre en color accent sólido. */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-white/[0.06] pb-6">
                <div className="min-w-0 flex-1">
                    <h1 className="text-3xl md:text-4xl font-semibold text-text-primary tracking-tight break-words">
                        Hola, <span className="text-accent">{stats.userName}</span>
                    </h1>
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">Tu reporte IMR</p>
                </div>
                {/* Badge de estado con label */}
                <div className="inline-flex items-center gap-3 bg-bg-surface border border-white/[0.06] px-4 py-2.5 rounded-lg shrink-0 self-start md:self-center">
                    <span
                        className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                        style={{ backgroundColor: imrColor }}
                    ></span>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Estado</span>
                        <span className="text-xs font-semibold text-text-primary">{stats.zona}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* IMR Main Card — SPEC-072: rounded-2xl (no rounded-[3rem]),
                    sin backdrop-blur ni shadow-2xl, círculo más proporcionado
                    (200px), tipografía limpia sin italic en stats. */}
                <div className="lg:col-span-5">
                    <div className="bg-bg-surface border border-white/[0.06] rounded-2xl p-6 md:p-8 text-center relative overflow-hidden">
                        {/* Línea superior de color según zona */}
                        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: imrColor }}></div>

                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.25em] mb-6">Puntaje IMR</p>

                        {/* Gauge circular — 200px (de 240px), centrado */}
                        <div className="relative w-[200px] h-[200px] mx-auto mb-6">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 240 240">
                                <circle cx="120" cy="120" r="108" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/[0.04]" />
                                <circle cx="120" cy="120" r="108" stroke={imrColor} strokeWidth="10" fill="transparent"
                                    strokeDasharray={678}
                                    strokeDashoffset={678 - (678 * stats.imr) / 100}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-5xl font-bold tracking-tight" style={{ color: imrColor }}>{stats.imr}</span>
                                <span className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mt-1">/ 100</span>
                            </div>
                        </div>

                        <p className="text-sm text-text-secondary max-w-[280px] mx-auto leading-relaxed mb-5">
                            {stats.imr < 40 ? 'Tu metabolismo necesita ajustes estructurales profundos.' :
                             stats.imr < 60 ? 'Estás en zona de transición. Hay fundamentos por corregir.' :
                             'Tu metabolismo opera con alta eficiencia.'}
                        </p>

                        {/* SPEC-085: link explicativo a /imr. El usuario nuevo ve un
                            número sin contexto si no le damos puerta a la pedagogía.
                            Estilo destacado (bg-accent/10 + border accent) para que se
                            note sin pelearse con el círculo del puntaje. */}
                        <a
                            href="/imr"
                            data-umami-event="cta_imr_explicacion"
                            data-umami-event-source="dashboard"
                            className="inline-flex items-center gap-2 px-4 py-2.5 mb-8 rounded-lg bg-accent/[0.08] border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/[0.15] hover:border-accent/50 transition-colors"
                        >
                            <span>🤔</span>
                            ¿Qué significa este puntaje?
                            <span className="ml-0.5">→</span>
                        </a>

                        {/* Grid pilares — cards compactas rounded-lg, sin italic */}
                        <div className="grid grid-cols-3 gap-2">
                            {blocksMapping.map((b: any) => (
                                <div key={b.key} className="bg-bg-base/60 p-3 rounded-lg border border-white/[0.04] flex flex-col items-center gap-1.5">
                                    <div className="text-accent">{b.icon}</div>
                                    <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{b.label}</div>
                                    <div className="text-base font-bold text-text-primary">{Math.round((stats.blocks?.[b.key as 'E' | 'M' | 'C'] || 0) * 100)}%</div>
                                </div>
                            ))}
                        </div>

                        {/* Composición corporal estimada (SPEC-006) */}
                        {(stats.bodyFatPct !== null || stats.leanMassPct !== null || stats.metabolicAge !== null) && (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                {stats.bodyFatPct !== null && (
                                    <div className="bg-bg-base/60 p-3 rounded-lg border border-white/[0.04] flex flex-col items-center gap-1.5">
                                        <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider">% Grasa</div>
                                        <div className="text-base font-bold text-text-primary">{Math.round(stats.bodyFatPct)}%</div>
                                    </div>
                                )}
                                {stats.leanMassPct !== null && (
                                    <div className="bg-bg-base/60 p-3 rounded-lg border border-white/[0.04] flex flex-col items-center gap-1.5">
                                        <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Masa magra</div>
                                        <div className="text-base font-bold text-text-primary">{Math.round(stats.leanMassPct)}%</div>
                                    </div>
                                )}
                                {stats.metabolicAge !== null && (
                                    <div className="bg-bg-base/60 p-3 rounded-lg border border-white/[0.04] flex flex-col items-center gap-1.5">
                                        <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Edad metab.</div>
                                        <div className="text-base font-bold text-text-primary">{stats.metabolicAge}<span className="text-xs text-text-muted ml-0.5">a</span></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna derecha — cards apiladas con gap consistente. */}
                <div className="lg:col-span-7 flex flex-col gap-5">

                    {/* CARD 1: ELENA APP */}
                    <div className="bg-bg-surface border border-accent/20 rounded-xl p-5 md:p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-lg flex items-center justify-center text-accent shrink-0">
                                <Icons.Rocket />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-text-primary font-semibold text-base mb-1">ElenaApp · Lista de espera</h4>
                                <p className="text-text-secondary text-sm leading-relaxed">
                                    Estás en lista de espera para conocer <span className="text-text-primary font-medium">ElenaApp</span>, la herramienta que te ayudará a elevar tu IMR.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CARD 2: COMUNIDAD */}
                    <a
                        href="/comunidad"
                        className="bg-bg-surface border border-white/[0.06] rounded-xl p-5 md:p-6 group hover:border-accent/30 transition-colors flex items-center justify-between gap-4"
                    >
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-lg flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-bg-base transition-colors shrink-0">
                                <Icons.ArrowRight />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-text-primary font-semibold text-base">La Tribu Biohacker</h4>
                                <p className="text-[11px] text-text-muted font-bold uppercase tracking-[0.18em] mt-0.5">Foros y comunidad</p>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-accent text-bg-base rounded-lg font-semibold text-xs whitespace-nowrap shrink-0 group-hover:bg-accent-strong transition-colors">
                            Entrar
                        </div>
                    </a>

                    {/* CARD 3: DOMINIO TEÓRICO (resultados de quizzes) */}
                    <div className="bg-bg-surface border border-white/[0.06] rounded-xl p-5 md:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-text-primary font-semibold text-base">Dominio teórico</h4>
                            <span className="inline-flex items-center px-2.5 py-1 bg-accent/10 text-accent rounded-md text-[11px] font-semibold border border-accent/20">
                                {bestQuizzes.length} {bestQuizzes.length === 1 ? 'módulo' : 'módulos'}
                            </span>
                        </div>

                        {bestQuizzes.length > 0 ? (
                            <div className="space-y-2.5">
                                {bestQuizzes.slice(0, 2).map((quiz: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between gap-4 p-3.5 bg-bg-base/60 rounded-lg border border-white/[0.04] hover:border-white/[0.1] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {quiz.score >= 70 ? (
                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-sm bg-status-good/10 text-status-good border border-status-good/20 shrink-0">
                                                    ✓
                                                </div>
                                            ) : (
                                                <a
                                                    href={`/posts/${quiz.articleId}`}
                                                    className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-sm bg-status-warn/10 text-status-warn border border-status-warn/20 hover:bg-status-warn hover:text-bg-base transition-colors shrink-0"
                                                    title="Reintentar módulo"
                                                >
                                                    ↻
                                                </a>
                                            )}
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Pilar evaluado</span>
                                                <span className="text-text-secondary text-xs font-medium leading-snug line-clamp-2 break-words">{quiz.articleId.replace(/-/g, ' ')}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end shrink-0">
                                            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Score</span>
                                            <span className={`text-lg font-bold leading-none ${quiz.score >= 70 ? 'text-status-good' : 'text-status-warn'}`}>
                                                {quiz.score}%
                                            </span>
                                            {quiz.score < 70 && (
                                                <a href={`/posts/${quiz.articleId}`} className="text-[10px] text-status-warn font-semibold hover:text-status-warn/80 mt-1">
                                                    Reintentar →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-bg-base/60 rounded-lg border border-white/[0.04]">
                                <p className="text-text-muted text-xs mb-3">Aún no has completado evaluaciones</p>
                                <a
                                    href="/biblioteca"
                                    className="inline-block px-4 py-2 bg-white/[0.04] text-text-secondary rounded-lg text-xs font-medium hover:bg-white/[0.08] hover:text-text-primary transition-colors"
                                >
                                    Explorar biblioteca →
                                </a>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BioDashboard;
