import React, { useState } from 'react';

// === PROXY SCORE MAPS ===
// Each question answer maps directly to IMX sub-scores (S1–S8) without needing raw biometrics.
// Final IMX = 100 × (0.4B + 0.3M + 0.3H) — coherent with IMX-V01 canonical spec.

interface ProxyScores {
    s1: number; // WHtR proxy
    s2: number; // WHR proxy
    s3adj: number; // B layer adjustment (fat distribution)
    s4: number; // Fasting
    s5: number; // Energy
    s6: number; // Nutrition
    s7: number; // Exercise
    s8: number; // Sleep
    gender: 'male' | 'female';
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const calculateProxyIMX = (p: ProxyScores): number => {
    const rawB = (0.5 * p.s1) + (0.3 * p.s2) + (0.2 * 0.5); // S3 neutral baseline
    const capaB = clamp(rawB + p.s3adj, 0, 1);
    const capaM = (0.6 * p.s4) + (0.4 * p.s5);
    const capaH = (0.4 * p.s6) + (0.4 * p.s7) + (0.2 * p.s8);
    return clamp(Math.round(100 * (0.4 * capaB + 0.3 * capaM + 0.3 * capaH)), 0, 100);
};

interface Question {
    id: string;
    layer: 'B' | 'M' | 'H' | 'META';
    layerLabel: string;
    title: string;
    subtitle?: string;
    options: {
        text: string;
        emoji: string;
        scores: Partial<ProxyScores>;
    }[];
}

const questions: Question[] = [
    {
        id: 'gender',
        layer: 'META',
        layerLabel: 'Perfil',
        title: '¿Con qué género te identificas?',
        subtitle: 'Necesitamos esto para calibrar los umbrales de composición corporal.',
        options: [
            { text: 'Masculino', emoji: '♂', scores: { gender: 'male' } },
            { text: 'Femenino', emoji: '♀', scores: { gender: 'female' } },
        ]
    },
    {
        id: 'abdomen',
        layer: 'B',
        layerLabel: 'Capa B — Cuerpo',
        title: '¿Cómo describirías tu abdomen actualmente?',
        subtitle: 'Sé honesto/a. Esto calibra tu score corporal.',
        options: [
            { text: 'Plano, sin grasa visible', emoji: '🎯', scores: { s1: 0.95, s2: 0.90 } },
            { text: 'Ligera acumulación abdominal', emoji: '🟡', scores: { s1: 0.70, s2: 0.68 } },
            { text: 'Barriga moderada', emoji: '🟠', scores: { s1: 0.45, s2: 0.40 } },
            { text: 'Barriga pronunciada (grasa visceral)', emoji: '🔴', scores: { s1: 0.15, s2: 0.12 } },
        ]
    },
    {
        id: 'fat_distribution',
        layer: 'B',
        layerLabel: 'Capa B — Cuerpo',
        title: '¿Dónde tiendes a acumular más grasa?',
        subtitle: 'La distribución revela el patrón metabólico de tu cuerpo.',
        options: [
            { text: 'Distribuida uniformemente', emoji: '✅', scores: { s3adj: 0.05 } },
            { text: 'Caderas y muslos (subcutánea)', emoji: '🦵', scores: { s3adj: 0 } },
            { text: 'Barriga y costados', emoji: '⚠️', scores: { s3adj: -0.05 } },
            { text: 'Cuello, papada y abdomen', emoji: '🚨', scores: { s3adj: -0.12 } },
        ]
    },
    {
        id: 'fasting',
        layer: 'M',
        layerLabel: 'Capa M — Metabolismo',
        title: '¿Cuántas horas pasan entre tu última comida del día y el desayuno?',
        subtitle: 'Esto mide tu flexibilidad metabólica — la capacidad de quemar grasa.',
        options: [
            { text: 'Más de 16 horas (ayuno avanzado)', emoji: '⚡', scores: { s4: 0.98 } },
            { text: '14 a 16 horas', emoji: '🔥', scores: { s4: 0.73 } },
            { text: '12 a 13 horas', emoji: '🌙', scores: { s4: 0.27 } },
            { text: 'Menos de 12 horas', emoji: '🍪', scores: { s4: 0.07 } },
        ]
    },
    {
        id: 'energy',
        layer: 'M',
        layerLabel: 'Capa M — Metabolismo',
        title: '¿Cómo te sientes después de almorzar?',
        subtitle: 'La energía post-comida es el termómetro de la estabilidad glucémica.',
        options: [
            { text: 'Con energía plena y claridad mental', emoji: '🧠', scores: { s5: 0.90 } },
            { text: 'Normal, sin cambios notables', emoji: '😐', scores: { s5: 0.65 } },
            { text: 'Somnoliento/a o un poco pesado/a', emoji: '😴', scores: { s5: 0.35 } },
            { text: 'Muy pesado/a, necesito siesta', emoji: '🛋️', scores: { s5: 0.10 } },
        ]
    },
    {
        id: 'nutrition',
        layer: 'H',
        layerLabel: 'Capa H — Hábitos',
        title: '¿Cómo describirías la calidad de tu alimentación?',
        subtitle: 'No el volumen, sino la calidad de los alimentos que consumes.',
        options: [
            { text: 'Mayormente natural, sin procesados', emoji: '🥗', scores: { s6: 0.90 } },
            { text: 'Mayormente casera con algo procesado', emoji: '🍳', scores: { s6: 0.65 } },
            { text: 'Mitad procesada, mitad natural', emoji: '🌮', scores: { s6: 0.40 } },
            { text: 'Mayormente ultraprocesada', emoji: '🍔', scores: { s6: 0.10 } },
        ]
    },
    {
        id: 'exercise',
        layer: 'H',
        layerLabel: 'Capa H — Hábitos',
        title: '¿Cuántos días a la semana haces ejercicio?',
        subtitle: 'Cuenta cualquier actividad física estructurada de al menos 30 minutos.',
        options: [
            { text: '5 o más días', emoji: '🏋️', scores: { s7: 1.0 } },
            { text: '3 a 4 días', emoji: '🚴', scores: { s7: 0.70 } },
            { text: '1 a 2 días', emoji: '🚶', scores: { s7: 0.35 } },
            { text: 'No hago ejercicio', emoji: '🛋️', scores: { s7: 0.0 } },
        ]
    },
    {
        id: 'sleep',
        layer: 'H',
        layerLabel: 'Capa H — Hábitos',
        title: '¿Cuántas horas duermes normalmente?',
        subtitle: 'El sueño regula el cortisol, la leptina y la insulina — hormonas clave de la composición corporal.',
        options: [
            { text: '8 horas o más', emoji: '🌟', scores: { s8: 1.0 } },
            { text: '7 horas aprox.', emoji: '😴', scores: { s8: 0.67 } },
            { text: '6 horas aprox.', emoji: '⏰', scores: { s8: 0.33 } },
            { text: '5 horas o menos', emoji: '☕', scores: { s8: 0.0 } },
        ]
    },
];

const LAYER_COLORS: Record<string, string> = {
    B: '#F59E0B',   // Amber
    M: '#3B82F6',   // Blue
    H: '#10B981',   // Green
    META: '#8B5CF6' // Purple
};

const IMXQuiz = () => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [hasStarted, setHasStarted] = useState(false);
    const [showNameInput, setShowNameInput] = useState(false);
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [scores, setScores] = useState<ProxyScores>({
        s1: 0.5, s2: 0.5, s3adj: 0,
        s4: 0.5, s5: 0.5,
        s6: 0.5, s7: 0.5, s8: 0.5,
        gender: 'male',
    });

    const currentQuestion = questions[currentQuestionIndex];
    const progress = Math.round((currentQuestionIndex / questions.length) * 100);
    const layerColor = LAYER_COLORS[currentQuestion?.layer || 'META'];

    const handleStart = () => setHasStarted(true);

    const handleAnswer = (optionScores: Partial<ProxyScores>) => {
        const newScores = { ...scores, ...optionScores };
        setScores(newScores);

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            setShowNameInput(true);
        }
    };

    const handleLeadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (userName.trim().length < 2) { setFormError('Por favor ingresa un nombre válido.'); return; }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userEmail)) { setFormError('Por favor ingresa un correo electrónico válido.'); return; }

        setIsSaving(true);
        const finalIMX = calculateProxyIMX(scores);

        try {
            const { db } = await import('../lib/firebase');
            const { collection, addDoc, query, where, getDocs, serverTimestamp } = await import('firebase/firestore');

            // ─── UNIQUE EMAIL CHECK ───
            const q = query(collection(db, 'waitlist_leads'), where('email', '==', userEmail.trim().toLowerCase()));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                setFormError('Ya has realizado tu diagnóstico y estás en lista de espera. Pronto te contactaremos.');
                setIsSaving(false);
                return;
            }

            await addDoc(collection(db, 'waitlist_leads'), {
                name: userName.trim(),
                email: userEmail.trim().toLowerCase(),
                estimated_imx: finalIMX,
                quiz_type: 'proxy_v1',
                proxy_scores: scores,
                created_at: serverTimestamp()
            });

            sessionStorage.setItem('imx_score', finalIMX.toString());
            sessionStorage.setItem('imx_userName', userName.trim());
            window.location.href = '/diagnostico';
        } catch (error) {
            console.error("Error saving lead:", error);
            setFormError('Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.');
            setIsSaving(false);
        }
    };

    // ─── INTRO SCREEN ──────────────────────────────────────────────────────────
    if (!hasStarted) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/20 text-white text-center">
                <div className="inline-flex items-center gap-2 bg-[#00C49A]/10 border border-[#00C49A]/30 rounded-full px-4 py-1.5 text-sm text-[#00C49A] font-semibold mb-4">
                    <span className="w-2 h-2 rounded-full bg-[#00C49A] animate-pulse"></span>
                    Motor IMX-V01 activo
                </div>
                <h2 className="text-3xl font-extrabold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-[#00C49A] to-[#007BFF]">
                    Diagnóstico Metabólico
                </h2>
                <p className="text-lg text-gray-200 mb-6 leading-relaxed max-w-md mx-auto">
                    Descubre tu <span className="font-bold text-[#00C49A]">Índice de Metamorfosis (IMX)</span> — el score que mide tu salud metabólica real, no solo tu peso.
                </p>
                <div className="grid grid-cols-3 gap-3 mb-8 max-w-sm mx-auto">
                    {[
                        { label: 'Capa B', desc: 'Cuerpo', color: '#F59E0B' },
                        { label: 'Capa M', desc: 'Metabolismo', color: '#3B82F6' },
                        { label: 'Capa H', desc: 'Hábitos', color: '#10B981' },
                    ].map(l => (
                        <div key={l.label} className="rounded-xl p-3 text-center" style={{ background: `${l.color}15`, border: `1px solid ${l.color}40` }}>
                            <div className="text-xs font-bold" style={{ color: l.color }}>{l.label}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{l.desc}</div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={handleStart}
                    className="w-full sm:w-auto px-8 py-4 bg-[#00C49A] hover:bg-[#00A885] text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-[#00C49A]/20"
                >
                    Calcular mi IMX — Gratis
                </button>
                <p className="text-xs text-gray-500 mt-4">8 preguntas · ~2 minutos · Sin cuentas</p>
            </div>
        );
    }

    // ─── LEAD CAPTURE ──────────────────────────────────────────────────────────
    if (showNameInput) {
        return (
            <div className="w-full max-w-2xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/20 text-white text-center animate-fade-in">
                <div className="mb-8">
                    <div className="w-20 h-20 bg-[#00C49A]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#00C49A]/40 text-4xl">
                        🔒
                    </div>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-white">Tu diagnóstico está listo.</h2>
                <p className="text-gray-300 mb-6 max-w-sm mx-auto text-sm">Ingresa tus datos para ver el reporte completo y asegurar tu lugar en la fase piloto de Elena.</p>
                <form onSubmit={handleLeadSubmit} className="max-w-xs mx-auto space-y-3">
                    <input type="text" value={userName} onChange={(e) => { setUserName(e.target.value); setFormError(''); }}
                        placeholder="Tu nombre" required disabled={isSaving}
                        className="w-full bg-black/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00C49A] text-center text-lg disabled:opacity-50" autoFocus />
                    <input type="email" value={userEmail} onChange={(e) => { setUserEmail(e.target.value); setFormError(''); }}
                        placeholder="tu@correo.com" required disabled={isSaving}
                        className="w-full bg-black/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00C49A] text-center text-lg disabled:opacity-50" />
                    {formError && <p className="text-red-400 text-sm font-medium">{formError}</p>}
                    <button type="submit" disabled={isSaving}
                        className="w-full px-8 py-3 bg-[#00C49A] hover:bg-[#00A885] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-[#00C49A]/20 flex items-center justify-center gap-2">
                        {isSaving ? (<><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Calculando IMX...</>) : ('Ver Mi Diagnóstico Completo')}
                    </button>
                    <p className="text-xs text-gray-500">Tus datos están protegidos. Cero Spam.</p>
                </form>
            </div>
        );
    }

    // ─── QUESTION SCREEN ───────────────────────────────────────────────────────
    return (
        <div className="w-full max-w-2xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/20 text-white">
            {/* Progress */}
            <div className="mb-5">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span style={{ color: layerColor }} className="font-semibold">{currentQuestion.layerLabel}</span>
                    <span>Pregunta {currentQuestionIndex + 1} de {questions.length}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress}%`, background: `linear-gradient(to right, ${layerColor}, ${layerColor}99)` }}></div>
                </div>
            </div>

            {/* Question */}
            <h3 className="text-xl sm:text-2xl font-bold mb-2 text-white">{currentQuestion.title}</h3>
            {currentQuestion.subtitle && (
                <p className="text-sm text-gray-400 mb-5">{currentQuestion.subtitle}</p>
            )}

            {/* Options */}
            <div className="space-y-2.5">
                {currentQuestion.options.map((option, index) => (
                    <button
                        key={index}
                        onClick={() => handleAnswer(option.scores)}
                        className="w-full text-left p-4 rounded-xl border border-gray-600 bg-gray-800/50 hover:bg-white/10 transition-all duration-200 group flex items-center gap-4"
                        style={{ '--hover-border': layerColor } as React.CSSProperties}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = layerColor)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
                    >
                        <span className="text-2xl flex-shrink-0">{option.emoji}</span>
                        <span className="text-gray-200 group-hover:text-white font-medium text-sm sm:text-base">{option.text}</span>
                        <div className="ml-auto w-5 h-5 rounded-full border border-gray-500 group-hover:border-current flex-shrink-0" style={{ color: layerColor }}></div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default IMXQuiz;
