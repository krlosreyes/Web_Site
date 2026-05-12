import React, { useState, useEffect } from 'react';
import {
    createUserWithEmailAndPassword,
    updateProfile,
    onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { computeImr, bodyFatNavy, ENGINE_VERSION } from '../lib/imr/engine';
import type { ImrResult } from '../lib/types/user';
import { track } from '../lib/analytics/track';

/**
 * Quiz IMR — captura biometría + hábitos del visitante (anónimo o logueado).
 *
 * Flujo:
 *   1. Visitante anónimo: completa quiz → calcula IMR client-side con el motor
 *      canónico (lib/imr/engine) → guarda payload en sessionStorage → muestra
 *      pantalla de registro → tras `createUserWithEmailAndPassword`, llama a
 *      `POST /api/users/onboard` con el payload.
 *   2. Visitante autenticado: completa quiz → calcula IMR → llama a
 *      `POST /api/users/onboard` directamente con el ID token de su sesión.
 *
 * Antes este componente escribía directo a Firestore desde el cliente con
 * un shape ad-hoc. Ahora todo pasa por el endpoint server-side, que valida
 * el ID token y aplica el schema canónico v1 (SPEC-005) en `users/{uid}`.
 *
 * Ver specs/SPEC-006-onboarding-web-app.md
 */

const QUIZ_STORAGE_KEY = 'imr_quiz_payload';

interface QuizState {
    gender: 'male' | 'female';
    age: number;
    weight: number;
    height: number;
    waist: number;
    bodyFat: number;
    fastingHours: number;
    dinnerHour: number;
    exerciseMinutes: number;
    sleepQuality: number;
    hydrationLitros: number;
    lastMealHour: number;
}

interface OnboardPayload {
    profile: {
        gender: 'male' | 'female';
        age: number;
        goals: string[];
        pathologies: string[];
    };
    bio: {
        heightCm: number;
        weightKg: number;
        waistCm: number;
        neckCm: number | null;
        hipCm: number | null;
        bodyFatPct: number;
        leanMassPct: number;
    };
    habits: {
        fastingHours: number;
        dinnerHour: number;
        exerciseMinutesPerDay: number;
        sleepQuality: number;
        hydrationLitresPerDay: number;
        lastMealHour: number;
    };
    imrResult: ImrResult;
}

function quizToPayload(quiz: QuizState): OnboardPayload {
    // El quiz captura un bodyFat estimado (4 buckets); puede no ser exacto.
    // Calculamos un fallback Navy si tuviéramos perímetros de cuello, pero por
    // ahora el quiz no los pide explícitos — usamos el valor estimado del quiz.
    const bodyFat = quiz.bodyFat;
    const result: ImrResult = computeImr({
        heightCm: quiz.height,
        weightKg: quiz.weight,
        waistCm: quiz.waist,
        // Quiz actual no captura perímetros de cuello/cadera; el motor cae a
        // bodyFat explícito del quiz, así que neckCm es indiferente. Pasamos
        // un valor neutro para evitar NaN si el motor lo evalúa.
        neckCm: quiz.gender === 'male' ? 38 : 32,
        age: quiz.age,
        gender: quiz.gender,
        bodyFatPct: bodyFat,
        fastingHours: quiz.fastingHours,
        dinnerHour: quiz.dinnerHour,
        exerciseMinutes: quiz.exerciseMinutes,
        sleepQuality: quiz.sleepQuality,
        hydrationLitres: quiz.hydrationLitros,
        hydrationGoal: 3,
        lastMealHour: quiz.lastMealHour,
    });

    return {
        profile: {
            gender: quiz.gender,
            age: quiz.age,
            goals: [],
            pathologies: [],
        },
        bio: {
            heightCm: quiz.height,
            weightKg: quiz.weight,
            waistCm: quiz.waist,
            neckCm: null,
            hipCm: null,
            bodyFatPct: bodyFat,
            leanMassPct: 100 - bodyFat,
        },
        habits: {
            fastingHours: quiz.fastingHours,
            dinnerHour: quiz.dinnerHour,
            exerciseMinutesPerDay: quiz.exerciseMinutes,
            sleepQuality: quiz.sleepQuality,
            hydrationLitresPerDay: quiz.hydrationLitros,
            lastMealHour: quiz.lastMealHour,
        },
        imrResult: result,
    };
}

async function postOnboard(idToken: string, payload: OnboardPayload): Promise<void> {
    const res = await fetch('/api/users/onboard', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Onboard failed with status ${res.status}`);
    }
}

const IMRQuiz = () => {
    const [step, setStep] = useState(0);
    const [subStep, setSubStep] = useState(1);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);

    const [bioData, setBioData] = useState<QuizState>({
        gender: 'male',
        age: 35,
        weight: 75,
        height: 175,
        waist: 85,
        bodyFat: 20,
        fastingHours: 12,
        dinnerHour: 20,
        exerciseMinutes: 30,
        sleepQuality: 0.7,
        hydrationLitros: 2,
        lastMealHour: 20,
    });

    const [regData, setRegData] = useState({ name: '', email: '', pass: '' });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                setRegData((prev) => ({
                    ...prev,
                    name: user.displayName || '',
                    email: user.email || '',
                }));
            }
        });
        return () => unsubscribe();
    }, []);

    const nextSubStep = () => {
        // SPEC-080: bloqueo en step 1 si edad < 18. Ley 1581 de 2012 (Colombia)
        // exige autorización de tutor para tratamiento de datos de menores que
        // no podemos verificar online.
        if (subStep === 1 && bioData.age > 0 && bioData.age < 18) {
            alert(
                'Lo sentimos, debes tener 18 años o más para continuar. ' +
                'Por protección de datos personales no podemos crear cuentas para menores ' +
                'sin autorización de un tutor legal verificable.'
            );
            return;
        }
        if (subStep < 8) setSubStep(subStep + 1);
        else handleFinish();
    };

    const handleFinish = async () => {
        const payload = quizToPayload(bioData);

        // SPEC-084: tracking de funnel — quiz completado (anónimo o logueado).
        track('quiz_completado', {
            score: payload.imrResult.imrScore,
            label: payload.imrResult.label,
        });

        if (currentUser) {
            // User logueado: persistir directo via /api/users/onboard
            setIsSaving(true);
            try {
                const idToken = await currentUser.getIdToken();
                await postOnboard(idToken, payload);
                sessionStorage.removeItem(QUIZ_STORAGE_KEY);
                sessionStorage.setItem('imr_score', String(payload.imrResult.imrScore));
                sessionStorage.setItem('imr_label', payload.imrResult.label);
                window.location.href = '/dashboard';
            } catch (err) {
                console.error('[IMRQuiz] onboard error:', err);
                setIsSaving(false);
                alert('No pudimos guardar tu diagnóstico. Inténtalo de nuevo.');
            }
        } else {
            // Anónimo: guardar payload + ir a registro
            sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(payload));
            sessionStorage.setItem('imr_score', String(payload.imrResult.imrScore));
            sessionStorage.setItem('imr_label', payload.imrResult.label);
            setStep(2);
        }
    };

    const handleFinalRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const stored = sessionStorage.getItem(QUIZ_STORAGE_KEY);
        const payload: OnboardPayload = stored
            ? JSON.parse(stored)
            : quizToPayload(bioData);

        try {
            const userCred = await createUserWithEmailAndPassword(
                auth,
                regData.email,
                regData.pass
            );
            await updateProfile(userCred.user, { displayName: regData.name });
            const idToken = await userCred.user.getIdToken();
            await postOnboard(idToken, payload);

            // SPEC-084: tracking de funnel — registro completado vía quiz.
            track('registro_completado', { source: 'quiz' });

            sessionStorage.removeItem(QUIZ_STORAGE_KEY);
            sessionStorage.setItem('imr_score', String(payload.imrResult.imrScore));
            sessionStorage.setItem('imr_label', payload.imrResult.label);
            sessionStorage.setItem('imr_userName', regData.name);
            window.location.href = '/dashboard';
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setIsAlreadyRegistered(true);
            } else {
                console.error('[IMRQuiz] register error:', err);
                alert(err.message || 'Error al crear tu cuenta. Inténtalo de nuevo.');
            }
            setIsSaving(false);
        }
    };

    if (step === 0) {
        return (
            <div className="text-center py-12 sm:py-20 animate-fade-in flex flex-col items-center px-4">
                {/* SPEC-072: pill accent teal (no azul) en rounded-md */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/10 border border-accent/20 text-accent text-[11px] font-bold uppercase tracking-[0.2em] mb-8">
                    🧬 Diagnóstico gratuito · 2 minutos
                </div>

                {/* H1 expresivo: italic uppercase + gradient en palabra clave
                    (regla del system: UN h1 expresivo por vista). */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-text-primary italic uppercase tracking-tight leading-[1.1] mb-6 max-w-3xl break-words">
                    ¿Qué edad tiene tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C49A] to-emerald-400">metabolismo</span>?
                </h1>

                <p className="text-text-secondary text-base sm:text-lg max-w-xl mx-auto mb-3 font-medium leading-relaxed">
                    Tu cuerpo te está hablando. Vamos a traducirlo.
                </p>
                <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto mb-10 leading-relaxed">
                    Calcula tu <strong className="text-text-primary">Índice Metabólico Real (IMR)</strong> en menos de 2 minutos. Descubre tu edad metabólica estimada y la zona biológica donde te encuentras hoy.
                </p>

                {/* CTA primario — bg-accent sólido, sin gradient ni blur halo. */}
                <button
                    onClick={() => {
                        // SPEC-084: tracking de funnel — quiz iniciado.
                        track('quiz_iniciado');
                        setStep(1);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-accent text-bg-base font-semibold text-base sm:text-lg hover:bg-accent-strong transition-colors"
                >
                    Iniciar mi diagnóstico
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>

                {/* Trust signals — labels neutros, sin tracking-widest extremo */}
                <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 max-w-xl text-[11px] font-medium text-text-muted">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="text-accent">✓</span> Sin registro previo
                    </span>
                    <span className="text-white/[0.1]">·</span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="text-accent">✓</span> Resultado al instante
                    </span>
                    <span className="text-white/[0.1]">·</span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="text-accent">✓</span> Basado en evidencia
                    </span>
                </div>
            </div>
        );
    }

    if (step === 1) {
        const progress = (subStep / 8) * 100;
        // SPEC-072: helper para clases de botón seleccionable (genero, hora, sleep).
        // Estado activo = bg-accent + text-bg-base (consistente con btn-primary).
        // Estado inactivo = bg-bg-elevated + text-text-secondary.
        const optionBtn = (active: boolean) =>
            active
                ? 'bg-accent border-accent text-bg-base'
                : 'bg-bg-elevated border-white/[0.06] text-text-secondary hover:bg-white/[0.04] hover:border-white/[0.12]';

        return (
            <div className="max-w-2xl w-full mx-auto py-10 px-6 sm:px-10 bg-bg-surface border border-white/[0.06] rounded-2xl animate-fade-in">
                {/* Progress header */}
                <div className="mb-10">
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted mb-3">
                        <span>Fase {subStep} de 8 · {subStep <= 3 ? 'Estructura' : subStep <= 6 ? 'Metabolismo' : 'Conducta'}</span>
                        <span className="text-accent">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>

                <div className="min-h-[300px] flex flex-col justify-center">
                    {subStep === 1 && (
                        <div className="space-y-6 animate-slide-up text-center">
                            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">Empecemos por ti</h2>
                            <p className="text-text-secondary text-sm leading-relaxed">Necesitamos un par de datos para ajustar el algoritmo a tu biología.</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setBioData({...bioData, gender: 'male'})} className={`p-5 rounded-xl border font-semibold text-base transition-colors ${optionBtn(bioData.gender === 'male')}`}>Soy hombre</button>
                                <button onClick={() => setBioData({...bioData, gender: 'female'})} className={`p-5 rounded-xl border font-semibold text-base transition-colors ${optionBtn(bioData.gender === 'female')}`}>Soy mujer</button>
                            </div>
                            <div className="text-left mt-6">
                                <label className="text-[11px] font-bold text-text-muted uppercase tracking-[0.18em] ml-1">¿Cuántos años tienes?</label>
                                <input
                                    type="number"
                                    placeholder="Ej. 35"
                                    min={18}
                                    max={100}
                                    className="w-full bg-bg-base/60 border border-white/[0.08] rounded-lg py-4 px-5 text-text-primary outline-none focus:border-accent text-xl font-semibold mt-2 transition-colors"
                                    onChange={e => setBioData({...bioData, age: parseInt(e.target.value)})}
                                    value={bioData.age || ''}
                                />
                                {/* SPEC-080: edad mínima 18. Si menor, mostrar mensaje
                                    bloqueante. Conforme Ley 1581 Art. 7 (datos de menores
                                    requieren autorización de padres/tutores que no podemos
                                    verificar). */}
                                {bioData.age > 0 && bioData.age < 18 && (
                                    <div className="mt-3 p-3 rounded-lg bg-status-bad/10 border border-status-bad/30">
                                        <p className="text-sm text-status-bad font-semibold mb-1">Necesitas tener 18 años o más</p>
                                        <p className="text-xs text-text-secondary leading-relaxed">
                                            Por protección de datos personales (Ley 1581 de 2012), no podemos crear cuentas para menores sin autorización de tutor legal. Si tienes menos de 18 años, pídele a un adulto que use tu información.
                                        </p>
                                    </div>
                                )}
                                <p className="text-[11px] text-text-muted mt-2">
                                    Al continuar declaras que tienes 18 años o más y aceptas el{' '}
                                    <a href="/disclaimer-medico" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-strong underline underline-offset-2">aviso médico</a>.
                                </p>
                            </div>
                        </div>
                    )}

                    {subStep === 2 && (
                        <div className="space-y-6 animate-slide-up text-center">
                            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">Tu estructura física</h2>
                            <p className="text-text-secondary text-sm leading-relaxed">Esto nos ayuda a calcular tu masa magra y requerimientos básicos.</p>
                            <div className="grid gap-5 text-left">
                                <div>
                                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-[0.18em] ml-1">¿Cuánto pesas actualmente? (kg)</label>
                                    <input type="number" className="w-full bg-bg-base/60 border border-white/[0.08] rounded-lg py-4 px-5 text-text-primary outline-none focus:border-accent text-xl font-semibold mt-2 transition-colors" onChange={e => setBioData({...bioData, weight: parseFloat(e.target.value)})} value={bioData.weight || ''} />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-[0.18em] ml-1">¿Cuál es tu estatura? (cm)</label>
                                    <input type="number" className="w-full bg-bg-base/60 border border-white/[0.08] rounded-lg py-4 px-5 text-text-primary outline-none focus:border-accent text-xl font-semibold mt-2 transition-colors" onChange={e => setBioData({...bioData, height: parseFloat(e.target.value)})} value={bioData.height || ''} />
                                </div>
                            </div>
                        </div>
                    )}

                    {subStep === 3 && (
                        <div className="space-y-6 animate-slide-up text-center">
                            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">Tu centro de energía</h2>
                            <p className="text-text-secondary text-sm leading-relaxed">¿Cuánto mide tu cintura a la altura del ombligo? Es el mejor predictor de tu metabolismo.</p>
                            <input type="range" min="60" max="150" className="w-full h-2 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-accent mt-6" style={{ accentColor: '#00C49A' }} onChange={e => setBioData({...bioData, waist: parseInt(e.target.value)})} value={bioData.waist} />
                            <div className="text-5xl font-bold text-accent tracking-tight">{bioData.waist}<span className="text-base text-text-muted ml-2 font-medium">cm</span></div>
                        </div>
                    )}

                    {subStep === 4 && (
                        <div className="space-y-6 animate-slide-up text-center">
                            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">Tu composición corporal</h2>
                            <p className="text-text-secondary text-sm leading-relaxed">¿Cómo describirías tu porcentaje de grasa actual? Elige la opción que más se acerque.</p>
                            <div className="grid gap-3 text-left mt-4">
                                {[10, 18, 25, 35].map(bf => (
                                    <button key={bf} onClick={() => {setBioData({...bioData, bodyFat: bf}); nextSubStep();}} className="p-4 bg-bg-elevated border border-white/[0.06] rounded-xl text-left hover:border-accent/40 hover:bg-white/[0.04] transition-colors flex justify-between items-center group">
                                        <span className="text-text-primary font-medium text-sm">{bf < 15 ? 'Deportista / muy definido' : bf < 22 ? 'Promedio / saludable' : bf < 30 ? 'Algo de sobrepeso' : 'Necesito mejorar bastante'}</span>
                                        <span className="text-lg font-bold text-text-muted group-hover:text-accent transition-colors">~{bf}%</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {subStep === 5 && (
                        <div className="space-y-6 animate-slide-up text-center">
                            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">Tu descanso digestivo</h2>
                            <p className="text-text-secondary text-sm leading-relaxed">¿Cuántas horas sueles pasar sin comer desde tu cena hasta tu primer alimento del día siguiente?</p>
                            <div className="flex justify-center items-center gap-6 py-8">
                                <button onClick={() => setBioData({...bioData, fastingHours: Math.max(8, bioData.fastingHours - 1)})} className="w-12 h-12 bg-bg-elevated hover:bg-white/[0.06] transition-colors rounded-lg text-2xl font-semibold border border-white/[0.06] text-text-primary">−</button>
                                <div className="text-6xl font-bold text-text-primary tracking-tight">{bioData.fastingHours}<span className="text-xl text-text-muted ml-2 font-medium">hrs</span></div>
                                <button onClick={() => setBioData({...bioData, fastingHours: Math.min(24, bioData.fastingHours + 1)})} className="w-12 h-12 bg-bg-elevated hover:bg-white/[0.06] transition-colors rounded-lg text-2xl font-semibold border border-white/[0.06] text-text-primary">+</button>
                            </div>
                        </div>
                    )}

                    {subStep === 6 && (
                        <div className="space-y-6 animate-slide-up text-center">
                            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">Cierre de tu día</h2>
                            <p className="text-text-secondary text-sm leading-relaxed">¿A qué hora sueles terminar tu última comida pesada del día?</p>
                            <div className="grid grid-cols-3 gap-3 mt-6">
                                {[18, 19, 20, 21, 22, 23].map(h => (
                                    <button key={h} onClick={() => {setBioData({...bioData, dinnerHour: h, lastMealHour: h}); nextSubStep();}} className={`p-4 rounded-xl border font-semibold text-base transition-colors ${optionBtn(bioData.dinnerHour === h)}`}>
                                        {h}:00
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {subStep === 7 && (
                        <div className="space-y-6 animate-slide-up text-center">
                            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">¿Qué tal duermes?</h2>
                            <p className="text-text-secondary text-sm leading-relaxed">Del 1 (pésimo) al 5 (excelente), ¿cómo calificarías tu calidad de sueño y recuperación?</p>
                            <div className="flex justify-between gap-2 mt-4">
                                {[1, 2, 3, 4, 5].map(v => (
                                    <button key={v} onClick={() => {setBioData({...bioData, sleepQuality: v/5}); setTimeout(nextSubStep, 300);}} className={`flex-1 py-5 rounded-xl border font-bold text-xl transition-colors ${optionBtn(Math.round(bioData.sleepQuality * 5) === v)}`}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between text-[11px] font-medium text-text-muted px-1">
                                <span>Agotado</span>
                                <span>Excelente</span>
                            </div>
                        </div>
                    )}

                    {subStep === 8 && (
                        <div className="space-y-6 animate-slide-up text-center">
                            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">Movimiento y agua</h2>
                            <p className="text-text-secondary text-sm leading-relaxed">Ya casi terminamos. ¿Cómo van tus hábitos diarios generales?</p>
                            <div className="grid gap-5 text-left mt-4">
                                <div>
                                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-[0.18em] ml-1">¿Cuántos minutos sueles hacer de ejercicio al día?</label>
                                    <input type="number" className="w-full bg-bg-base/60 border border-white/[0.08] rounded-lg py-4 px-5 text-text-primary outline-none focus:border-accent text-xl font-semibold mt-2 transition-colors" onChange={e => setBioData({...bioData, exerciseMinutes: parseInt(e.target.value)})} value={bioData.exerciseMinutes || ''} />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-[0.18em] ml-1">¿Cuánta agua tomas al día? (litros)</label>
                                    <div className="flex items-center gap-5 mt-3 bg-bg-base/60 p-4 rounded-lg border border-white/[0.08]">
                                        <input type="range" min="0" max="5" step="0.5" className="flex-1 h-2 bg-white/[0.08] rounded-lg appearance-none cursor-pointer" style={{ accentColor: '#00C49A' }} onChange={e => setBioData({...bioData, hydrationLitros: parseFloat(e.target.value)})} value={bioData.hydrationLitros} />
                                        <span className="text-2xl font-bold text-accent">{bioData.hydrationLitros}L</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-10 flex justify-between gap-3">
                    {subStep > 1 && (
                        <button onClick={() => setSubStep(subStep - 1)} className="px-5 py-3 bg-bg-elevated text-text-secondary rounded-lg font-semibold text-sm border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                            ← Atrás
                        </button>
                    )}
                    <button onClick={nextSubStep} disabled={isSaving} className="flex-1 px-5 py-3 bg-accent disabled:bg-bg-elevated disabled:text-text-muted text-bg-base rounded-lg font-semibold text-sm hover:bg-accent-strong transition-colors">
                        {isSaving ? 'Guardando…' : (subStep === 8 ? 'Finalizar diagnóstico →' : 'Siguiente paso')}
                    </button>
                </div>
            </div>
        );
    }

    if (isAlreadyRegistered) {
        return (
            <div className="max-w-md w-full mx-auto py-10 px-6 sm:px-8 bg-bg-surface border border-white/[0.06] rounded-2xl text-center animate-fade-in">
                <div className="w-16 h-16 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-5 border border-accent/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-text-primary tracking-tight mb-3">Cuenta existente</h2>
                <p className="text-text-secondary text-sm leading-relaxed mb-8 max-w-sm mx-auto">
                    Detectamos que el correo <span className="text-text-primary font-semibold">{regData.email}</span> ya pertenece a un usuario activo de Metamorfosis Real.
                </p>
                <div className="space-y-3">
                    <a href="/login" className="block w-full bg-accent text-bg-base py-3 rounded-lg font-semibold text-base hover:bg-accent-strong transition-colors">
                        Iniciar sesión →
                    </a>
                    <button onClick={() => setIsAlreadyRegistered(false)} className="w-full py-2 text-text-muted text-sm font-medium hover:text-text-primary transition-colors">
                        Usar otro correo
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md w-full mx-auto py-10 px-6 sm:px-8 bg-bg-surface border border-white/[0.06] rounded-2xl text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight mb-2">Análisis completado</h2>
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-[0.18em] mb-5">Vincula tu identidad para recibir tu reporte IMR</p>

            {/* SPEC-085: pedagogía pre-registro. El user acaba de completar el
                quiz y va a ver un puntaje IMR — conviene que sepa qué es antes
                de comprometerse al registro. Link sutil para no robarle peso
                al CTA principal del form. */}
            <a
                href="/imr"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('cta_imr_explicacion', { source: 'quiz_resultado' })}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-strong transition-colors mb-7"
            >
                ¿Qué es el IMR? Conoce qué medimos →
            </a>

            <form onSubmit={handleFinalRegister} className="space-y-3 text-left">
                <input required type="text" placeholder="Tu nombre" className="w-full bg-bg-base/60 border border-white/[0.08] rounded-lg py-3 px-4 text-text-primary outline-none focus:border-accent text-base transition-colors placeholder:text-text-muted" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
                <input required type="email" placeholder="Email" className="w-full bg-bg-base/60 border border-white/[0.08] rounded-lg py-3 px-4 text-text-primary outline-none focus:border-accent text-base transition-colors placeholder:text-text-muted" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} />
                <input required type="password" placeholder="Crea una clave (mínimo 8 caracteres)" minLength={8} className="w-full bg-bg-base/60 border border-white/[0.08] rounded-lg py-3 px-4 text-text-primary outline-none focus:border-accent text-base transition-colors placeholder:text-text-muted" value={regData.pass} onChange={e => setRegData({...regData, pass: e.target.value})} />
                <button disabled={isSaving} type="submit" className="w-full bg-accent disabled:bg-bg-elevated disabled:text-text-muted text-bg-base py-3 rounded-lg font-semibold text-base hover:bg-accent-strong transition-colors mt-2">
                    {isSaving ? 'Generando reporte…' : 'Ver mis resultados →'}
                </button>
            </form>
        </div>
    );
};

export default IMRQuiz;
