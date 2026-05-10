import React, { useState, useEffect } from 'react';
import {
    createUserWithEmailAndPassword,
    updateProfile,
    onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { computeImr, bodyFatNavy, ENGINE_VERSION } from '../lib/imr/engine';
import type { ImrResult } from '../lib/types/user';

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
        if (subStep < 8) setSubStep(subStep + 1);
        else handleFinish();
    };

    const handleFinish = async () => {
        const payload = quizToPayload(bioData);

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
                alert('No pudimos guardar tu diagnóstico. Probá de nuevo.');
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
                alert(err.message || 'Error al crear tu cuenta. Probá de nuevo.');
            }
            setIsSaving(false);
        }
    };

    if (step === 0) {
        return (
            <div className="text-center py-12 sm:py-20 animate-fade-in flex flex-col items-center px-4">
                {/* SPEC-047: chip eyebrow amigable, no jerga interna */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] mb-8">
                    🧬 Diagnóstico gratuito · 2 minutos
                </div>

                {/* SPEC-047: pregunta hook + responsive (regla SPEC-031) */}
                <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white italic uppercase tracking-tighter leading-[1.05] mb-6 max-w-3xl break-words">
                    ¿Qué edad tiene tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#00C49A]">metabolismo</span>?
                </h1>

                {/* SPEC-047: sub-copy con beneficio claro */}
                <p className="text-gray-300 text-base sm:text-lg max-w-xl mx-auto mb-2 font-medium leading-relaxed">
                    Tu cuerpo te está hablando. Vamos a traducirlo.
                </p>
                <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto mb-12 leading-relaxed">
                    Descubrí tu <strong className="text-white">Índice Metabólico Real (IMR)</strong> y recibí un reporte personalizado con los 5 pilares que tenés que ajustar para recuperar energía, claridad mental y composición corporal.
                </p>

                {/* CTA primario (mantenido visual, copy más imperativo y cálido) */}
                <button onClick={() => setStep(1)} className="relative group outline-none">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                    <div className="relative px-10 sm:px-14 py-5 sm:py-6 bg-gradient-to-r from-[#00C49A] to-teal-600 text-white text-lg sm:text-2xl font-black rounded-full border border-blue-400/50 flex items-center gap-4 hover:scale-105 transition-all shadow-2xl">
                        INICIAR MI DIAGNÓSTICO
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </div>
                </button>

                {/* SPEC-047: trust signals abajo */}
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-xl">
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest">
                        <span className="text-[#00C49A]">✓</span> Sin registro previo
                    </span>
                    <span className="text-gray-700">·</span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest">
                        <span className="text-[#00C49A]">✓</span> Resultado al instante
                    </span>
                    <span className="text-gray-700">·</span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-widest">
                        <span className="text-[#00C49A]">✓</span> Basado en evidencia
                    </span>
                </div>
            </div>
        );
    }

    if (step === 1) {
        const progress = (subStep / 8) * 100;
        return (
            <div className="max-w-2xl w-full mx-auto py-12 px-10 bg-[#0c1f31]/80 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-2xl animate-fade-in">
                <div className="mb-12">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-blue-400 mb-4">
                        <span>Fase {subStep} de 8: {subStep <= 3 ? 'Estructura' : subStep <= 6 ? 'Metabolismo' : 'Conducta'}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>

                <div className="min-h-[300px] flex flex-col justify-center">
                    {subStep === 1 && (
                        <div className="space-y-8 animate-slide-up text-center">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">Empecemos por ti</h2>
                            <p className="text-gray-400 text-sm">Necesitamos un par de datos para ajustar el algoritmo a tu biología.</p>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setBioData({...bioData, gender: 'male'})} className={`p-6 rounded-2xl border transition-all ${bioData.gender === 'male' ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>Soy Hombre</button>
                                <button onClick={() => setBioData({...bioData, gender: 'female'})} className={`p-6 rounded-2xl border transition-all ${bioData.gender === 'female' ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>Soy Mujer</button>
                            </div>
                            <div className="text-left mt-6">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">¿Cuántos años tienes?</label>
                                <input type="number" placeholder="Ej. 35" className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 px-8 text-white outline-none focus:border-blue-500 text-2xl font-black mt-2" onChange={e => setBioData({...bioData, age: parseInt(e.target.value)})} value={bioData.age || ''} />
                            </div>
                        </div>
                    )}

                    {subStep === 2 && (
                        <div className="space-y-8 animate-slide-up text-center">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">Tu Estructura Física</h2>
                            <p className="text-gray-400 text-sm">Esto nos ayuda a calcular tu masa magra y requerimientos básicos.</p>
                            <div className="grid gap-6 text-left">
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">¿Cuánto pesas actualmente? (kg)</label>
                                    <input type="number" className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 px-8 text-white outline-none focus:border-blue-500 text-2xl font-black mt-2" onChange={e => setBioData({...bioData, weight: parseFloat(e.target.value)})} value={bioData.weight || ''} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">¿Cuál es tu estatura? (cm)</label>
                                    <input type="number" className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 px-8 text-white outline-none focus:border-blue-500 text-2xl font-black mt-2" onChange={e => setBioData({...bioData, height: parseFloat(e.target.value)})} value={bioData.height || ''} />
                                </div>
                            </div>
                        </div>
                    )}

                    {subStep === 3 && (
                        <div className="space-y-8 animate-slide-up text-center">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">Tu Centro de Energía</h2>
                            <p className="text-gray-400 text-sm">¿Cuánto mide tu cintura a la altura del ombligo? Es el mejor predictor de tu metabolismo.</p>
                            <input type="range" min="60" max="150" className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-6" onChange={e => setBioData({...bioData, waist: parseInt(e.target.value)})} value={bioData.waist} />
                            <div className="text-6xl font-black text-blue-400 italic">{bioData.waist}<span className="text-xl text-gray-500 ml-2">cm</span></div>
                        </div>
                    )}

                    {subStep === 4 && (
                        <div className="space-y-8 animate-slide-up text-center">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">Tu Composición Corporal</h2>
                            <p className="text-gray-400 text-sm">¿Cómo describirías tu porcentaje de grasa actual? Elige la opción que más se acerque.</p>
                            <div className="grid gap-4 text-left mt-6">
                                {[10, 18, 25, 35].map(bf => (
                                    <button key={bf} onClick={() => {setBioData({...bioData, bodyFat: bf}); nextSubStep();}} className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-blue-500 hover:bg-white/10 transition-all flex justify-between items-center group">
                                        <span className="text-gray-300 font-bold uppercase text-xs tracking-widest">{bf < 15 ? 'Deportista / Muy Definido' : bf < 22 ? 'Promedio / Saludable' : bf < 30 ? 'Algo de Sobrepeso' : 'Necesito mejorar bastante'}</span>
                                        <span className="text-2xl font-black text-white/50 italic group-hover:text-blue-400 transition-colors">~{bf}%</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {subStep === 5 && (
                        <div className="space-y-8 animate-slide-up text-center">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">Tu Descanso Digestivo</h2>
                            <p className="text-gray-400 text-sm">¿Cuántas horas sueles pasar sin comer desde tu cena hasta tu primer alimento del día siguiente?</p>
                            <div className="flex justify-center items-center gap-8 py-10">
                                <button onClick={() => setBioData({...bioData, fastingHours: Math.max(8, bioData.fastingHours - 1)})} className="w-16 h-16 bg-white/5 hover:bg-white/10 transition-colors rounded-full text-3xl font-black border border-white/10">-</button>
                                <div className="text-8xl font-black text-white italic drop-shadow-lg">{bioData.fastingHours}<span className="text-2xl text-gray-500 not-italic ml-2">hrs</span></div>
                                <button onClick={() => setBioData({...bioData, fastingHours: Math.min(24, bioData.fastingHours + 1)})} className="w-16 h-16 bg-white/5 hover:bg-white/10 transition-colors rounded-full text-3xl font-black border border-white/10">+</button>
                            </div>
                        </div>
                    )}

                    {subStep === 6 && (
                        <div className="space-y-8 animate-slide-up text-center">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">Cierre de tu Día</h2>
                            <p className="text-gray-400 text-sm">¿A qué hora sueles terminar tu última comida pesada del día?</p>
                            <div className="grid grid-cols-3 gap-4 mt-8">
                                {[18, 19, 20, 21, 22, 23].map(h => (
                                    <button key={h} onClick={() => {setBioData({...bioData, dinnerHour: h, lastMealHour: h}); nextSubStep();}} className={`p-5 rounded-2xl border font-black text-lg transition-all ${bioData.dinnerHour === h ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'}`}>
                                        {h}:00
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {subStep === 7 && (
                        <div className="space-y-8 animate-slide-up text-center">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">¿Qué tal duermes?</h2>
                            <p className="text-gray-400 text-sm mb-6">Del 1 (pésimo) al 5 (excelente), ¿cómo calificarías tu calidad de sueño y recuperación?</p>
                            <div className="flex justify-between gap-3 mt-6">
                                {[1, 2, 3, 4, 5].map(v => (
                                    <button key={v} onClick={() => {setBioData({...bioData, sleepQuality: v/5}); setTimeout(nextSubStep, 300);}} className={`flex-1 py-6 rounded-2xl border font-black text-2xl transition-all ${Math.round(bioData.sleepQuality * 5) === v ? 'bg-[#00C49A] border-[#00C49A] text-black shadow-lg shadow-[#00C49A]/30 scale-105' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">
                                <span>Agotado</span>
                                <span>Excelente</span>
                            </div>
                        </div>
                    )}

                    {subStep === 8 && (
                        <div className="space-y-8 animate-slide-up text-center">
                            <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">Movimiento y Agua</h2>
                            <p className="text-gray-400 text-sm">Ya casi terminamos. ¿Cómo van tus hábitos diarios generales?</p>
                            <div className="grid gap-8 text-left mt-6">
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">¿Cuántos minutos sueles hacer de ejercicio al día?</label>
                                    <input type="number" className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 px-8 text-white outline-none focus:border-blue-500 text-2xl font-black mt-2" onChange={e => setBioData({...bioData, exerciseMinutes: parseInt(e.target.value)})} value={bioData.exerciseMinutes || ''} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">¿Cuánta agua tomas al día? (Litros)</label>
                                    <div className="flex items-center gap-6 mt-4 bg-white/5 p-6 rounded-2xl border border-white/10">
                                        <input type="range" min="0" max="5" step="0.5" className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500" onChange={e => setBioData({...bioData, hydrationLitros: parseFloat(e.target.value)})} value={bioData.hydrationLitros} />
                                        <span className="text-3xl font-black text-white italic">{bioData.hydrationLitros}L</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-12 flex justify-between gap-4">
                    {subStep > 1 && (
                        <button onClick={() => setSubStep(subStep - 1)} className="px-8 py-4 bg-white/5 text-gray-400 rounded-xl font-bold uppercase text-[10px] tracking-widest">Atrás</button>
                    )}
                    <button onClick={nextSubStep} disabled={isSaving} className="flex-1 px-8 py-4 bg-blue-600 disabled:bg-gray-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20">
                        {isSaving ? 'Guardando…' : (subStep === 8 ? 'Finalizar Escaneo →' : 'Siguiente Paso')}
                    </button>
                </div>
            </div>
        );
    }

    if (isAlreadyRegistered) {
        return (
            <div className="max-w-xl w-full mx-auto py-12 px-10 bg-[#0c1f31]/80 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-2xl text-center animate-fade-in">
                <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-4 leading-none">Cuenta Existente</h2>
                <p className="text-gray-400 text-sm font-medium mb-10 max-w-sm mx-auto">
                    Detectamos que el correo <span className="text-white font-bold">{regData.email}</span> ya pertenece a un Biohacker activo en Metamorfosis Real.
                </p>
                <div className="space-y-4">
                    <a href="/login" className="block w-full bg-blue-600 text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:bg-blue-500 transition-all">
                        Iniciar Sesión →
                    </a>
                    <button onClick={() => setIsAlreadyRegistered(false)} className="w-full py-4 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
                        Usar otro correo
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-xl w-full mx-auto py-12 px-10 bg-[#0c1f31]/60 backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-2xl text-center">
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-4 leading-none">Análisis Completado</h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-10">Vincula tu identidad para recibir el reporte SPEC-70.5</p>
            <form onSubmit={handleFinalRegister} className="space-y-4 text-left">
                <input required type="text" placeholder="Tu nombre..." className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 px-8 text-white outline-none focus:border-blue-500" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
                <input required type="email" placeholder="Email..." className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 px-8 text-white outline-none focus:border-blue-500" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} />
                <input required type="password" placeholder="Crea una clave..." minLength={8} className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 px-8 text-white outline-none focus:border-blue-500" value={regData.pass} onChange={e => setRegData({...regData, pass: e.target.value})} />
                <button disabled={isSaving} type="submit" className="w-full bg-blue-600 disabled:bg-gray-700 text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] shadow-xl hover:bg-blue-500 transition-all">
                    {isSaving ? "Generando Reporte..." : "Ver Resultados de Autoridad →"}
                </button>
            </form>
        </div>
    );
};

export default IMRQuiz;
