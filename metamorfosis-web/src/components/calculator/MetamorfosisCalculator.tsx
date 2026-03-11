import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ControlPanel from './ControlPanel'; // relative import
import MorphingSilhouette from './MorphingSilhouette';

import type { IMXVariables } from '../../utils/biometrics';
import { calculateWHR, calculateIMX } from '../../utils/biometrics';

// ─── Component ──────────────────────────────────────────────────────────────
const MetamorfosisCalculator = () => {
    // Capa B (Cuerpo)
    const [gender, setGender] = useState<'male' | 'female'>('female');
    const [weight, setWeight] = useState<number>(63);
    const [height, setHeight] = useState<number>(163);
    const [waist, setWaist] = useState<number>(60);
    const [hip, setHip] = useState<number>(90);
    const [neck, setNeck] = useState<number>(34);

    // Capa M (Metabolismo)
    const [fastingHours, setFastingHours] = useState<number>(12);
    const [energyScore, setEnergyScore] = useState<number>(5);

    // Capa H (Hábitos)
    const [nutritionScore, setNutritionScore] = useState<number>(5);
    const [exerciseDays, setExerciseDays] = useState<number>(2);
    const [sleepHours, setSleepHours] = useState<number>(6);

    // Cálculos Derivados Locales
    const whr = calculateWHR(waist, hip);
    const bmi = weight / Math.pow(height / 100, 2);

    // IMX Normalize Engine (0 - 100)
    const imxPayload: IMXVariables = {
        gender, waist, hip, height, neck,
        fastingHours, energyScore, nutritionScore, exerciseDays, sleepHours
    };
    const imx = calculateIMX(imxPayload);

    // Clasificación IMX
    // 0-30: Alto Riesgo (Ámbar)
    // 30-50: Deterioro (Amarillo)
    // 50-65: Zona de Transición 
    // 65-100: Saludable (Cian)
    const isCrisis = imx <= 30;
    const isWarning = imx > 30 && imx <= 50;
    const isOptimal = imx >= 65;

    // Colores base para la UI
    let accent = '#2DD4BF'; // Cian (Óptimo/Transición)
    let textColor = 'text-teal-400';
    let statusText = 'En Recuperación';

    if (isCrisis) {
        accent = '#EF4444'; // Rojo / Ámbar
        textColor = 'text-red-500';
        statusText = 'Riesgo Alto (Crisis)';
    } else if (isWarning) {
        accent = '#F59E0B'; // Amarillo
        textColor = 'text-amber-400';
        statusText = 'Deterioro Metabólico';
    } else if (isOptimal) {
        statusText = 'Óptimo (Saludable)';
    }

    const handleCheckout = (e: React.FormEvent) => {
        e.preventDefault();

        // Persist IMX score for Diagnostico.astro to read
        if (typeof window !== 'undefined') {
            sessionStorage.setItem("imx_score", imx.toString());
        }

        if (typeof window !== 'undefined' && (window as any).ePayco) {
            const handler = (window as any).ePayco.checkout.configure({ key: 'PUBLIC_KEY_EPAYCO', test: true });
            handler.open({
                name: 'Reporte de Longevidad PRO',
                description: 'Análisis Biométrico de Grasa Visceral y FFMI',
                currency: 'usd', amount: '1.99',
                tax_base: '0', tax: '0', country: 'co', lang: 'es',
                external: 'false', method: 'GET',
                confirmation: 'https://ejemplo.com/confirmation',
                response: window.location.origin + '/api/generate-pdf-report?status=success'
            });
        } else {
            alert('El módulo de pagos está cargando...');
        }
    };

    return (
        // ── Outer shell: full viewport below navbar ──────────────────────────
        <div className="fixed top-[80px] left-0 right-0 bottom-0 overflow-hidden text-white
                        bg-[radial-gradient(circle_at_30%_30%,_#0b1e2d_0%,_#07131f_60%,_#050c14_100%)]
                        flex items-center justify-center p-[20px] md:p-[40px] font-sans">

            {/* ── Independent Layout Wrapper ─────────────────────────────── */}
            <div className="w-full max-w-[1400px] h-full max-h-[85vh] flex overflow-hidden">
                <div className="w-full h-full grid grid-cols-1 grid-rows-[minmax(200px,1fr)_auto] md:grid-cols-[1.1fr_1fr] md:grid-rows-1 items-stretch gap-[32px] md:gap-[56px] z-10 min-h-0">

                    {/* ════════════════════════════════════════════════════════
                        LEFT PANEL — Holographic Silhouette
                    ════════════════════════════════════════════════════════ */}
                    <div className="relative flex items-center justify-center overflow-hidden
                                    bg-[#0c1f31]/60 backdrop-blur-xl rounded-[28px] border border-[#2DD4BF]/20 shadow-[0_0_30px_rgba(0,245,212,0.15)] order-1 p-[24px]">

                        {/* Sonar Grid Background */}
                        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-40">
                            <svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" className="absolute">
                                <circle cx="200" cy="300" r="280" fill="none" stroke="#2DD4BF" strokeWidth="0.5" />
                                <circle cx="200" cy="300" r="200" fill="none" stroke="#2DD4BF" strokeWidth="0.5" />
                                <circle cx="200" cy="300" r="120" fill="none" stroke="#2DD4BF" strokeWidth="0.5" />
                                <line x1="0" y1="300" x2="400" y2="300" stroke="#2DD4BF" strokeWidth="0.5" />
                                <line x1="200" y1="0" x2="200" y2="600" stroke="#2DD4BF" strokeWidth="0.5" />
                            </svg>
                        </div>

                        {/* MorphingSilhouette */}
                        <MorphingSilhouette imx={imx} />

                        {/* Metabolic Alert Banner */}
                        <AnimatePresence>
                            {isCrisis && (
                                <motion.div
                                    key="alert"
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 30, opacity: 0 }}
                                    className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-xs
                                               bg-amber-950/90 backdrop-blur-md rounded-xl px-4 py-2
                                               border border-amber-500/50 z-20 shadow-[0_0_20px_rgba(245,158,11,0.25)] min-w-[280px]"
                                >
                                    <span className="text-amber-400 font-bold">⚠ ALERTA METABÓLICA —</span>
                                    <span className="text-amber-300 ml-1">IMX {imx} (Crítico)</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ════════════════════════════════════════════════════════
                        RIGHT PANEL — Controls + Gauges + Payment
                    ════════════════════════════════════════════════════════ */}
                    <div className="flex flex-col justify-between overflow-hidden gap-[20px] md:gap-[32px] order-2 relative min-h-0">
                        {/* Data Card Content */}
                        <div className="w-full flex-1 flex flex-col bg-[#0c1f31]/60 backdrop-blur-xl rounded-[28px] border border-[#2DD4BF]/20 shadow-[0_0_30px_rgba(0,245,212,0.15)] p-[24px] md:p-[32px] min-h-0">

                            {/* Title strip (Status only) */}
                            <div className="flex-shrink-0 flex items-center justify-end mb-4">
                                <div className={`text-right ${textColor}`}>
                                    <div className="text-[10px] font-bold tracking-widest uppercase opacity-80">Estado</div>
                                    <div className="text-sm font-black">{statusText}</div>
                                </div>
                            </div>

                            {/* Control Panel Sliders */}
                            <div className="flex-shrink-0">
                                <ControlPanel
                                    gender={gender} setGender={setGender}
                                    weight={weight} setWeight={setWeight}
                                    height={height} setHeight={setHeight}
                                    waist={waist} setWaist={setWaist}
                                    hip={hip} setHip={setHip}
                                    neck={neck} setNeck={setNeck}
                                    fastingHours={fastingHours} setFastingHours={setFastingHours}
                                    energyScore={energyScore} setEnergyScore={setEnergyScore}
                                    nutritionScore={nutritionScore} setNutritionScore={setNutritionScore}
                                    exerciseDays={exerciseDays} setExerciseDays={setExerciseDays}
                                    sleepHours={sleepHours} setSleepHours={setSleepHours}
                                    textColor={textColor}
                                />
                            </div>

                            {/* ── Telemetry Gauges row (DIGITAL REPLACEMENT) ── */}
                            <div className="flex gap-3 flex-shrink-0 mt-auto pt-4 border-t border-white/5 relative z-10 w-full min-h-[90px] mx-2">
                                {/* IMX Master Card */}
                                <div
                                    className="flex-1 flex flex-col items-center justify-center p-3 rounded-2xl bg-[#0B1829] border shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-colors duration-300 relative overflow-hidden"
                                    style={{
                                        borderColor: isCrisis ? '#EF4444' : isWarning ? '#F59E0B' : '#2DD4BF',
                                        boxShadow: `0 0 25px ${isCrisis ? 'rgba(239,68,68,0.2)' : isWarning ? 'rgba(245,158,11,0.15)' : 'rgba(45,212,191,0.15)'}`
                                    }}
                                >
                                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent mix-blend-overlay"></div>
                                    <span className="text-[10px] md:text-xs font-bold text-gray-400 tracking-widest uppercase mb-1 text-center leading-tight relative z-10">Índice Metamorfosis</span>
                                    <div className="flex items-baseline gap-1 relative z-10">
                                        <span
                                            className="text-4xl md:text-5xl font-mono font-black tracking-tighter transition-colors duration-300 drop-shadow-md"
                                            style={{ color: isCrisis ? '#EF4444' : isWarning ? '#F59E0B' : '#FFFFFF' }}
                                        >
                                            {imx}
                                        </span>
                                        <span className="text-gray-500 font-bold text-sm">/ 100</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── CTA + Payment Footer ─────────────────────────── */}
                        <div className="flex flex-col gap-3 md:gap-4 flex-shrink-0 relative z-20">

                            {/* Primary CTA */}
                            <motion.button
                                onClick={(e) => {
                                    if (typeof window !== 'undefined') {
                                        sessionStorage.setItem("imx_score", imx.toString());
                                    }
                                    window.location.href = '/diagnostico';
                                }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full bg-[#00f5d4] hover:bg-[#00e3c5] text-[#0c1f31] text-sm md:text-lg font-black uppercase tracking-widest h-[56px] md:h-[64px] rounded-[16px] transition-all relative shadow-[0_0_20px_rgba(0,245,212,0.3)] hover:shadow-[0_0_30px_rgba(0,245,212,0.6)]"
                            >
                                <motion.div className="absolute inset-0 bg-[#00f5d4] opacity-20 rounded-[16px]" animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
                                VER MI DIAGNÓSTICO INICIAL
                            </motion.button>

                            {/* Payment Providers */}
                            <form onSubmit={handleCheckout} className="flex gap-3 md:gap-4">
                                {/* ePayco */}
                                <button type="submit" className="flex-1 bg-[#E02A2A] hover:bg-red-500 text-white font-black h-[48px] md:h-[56px] rounded-[16px] transition-all hover:scale-[1.02] shadow-lg flex justify-center items-center border border-red-500/50 hover:shadow-[0_0_15px_rgba(224,42,42,0.4)]">
                                    <span className="text-lg md:text-2xl italic tracking-tighter">ePayco</span>
                                </button>

                                {/* GPay / Apple Pay RESTYLED to Black/Gray */}
                                <div className="flex-1 bg-black text-white border border-[#1E293B] hover:border-gray-600 rounded-[16px] flex justify-center items-center gap-3 md:gap-6 shadow-lg cursor-pointer hover:bg-gray-900 transition-all font-black hover:scale-[1.02]">
                                    <svg className="h-4 md:h-6" viewBox="0 0 50 20" fill="currentColor">
                                        <text x="0" y="15" fontSize="16" fontWeight="bold">G Pay</text>
                                    </svg>
                                    <div className="w-px h-4 md:h-6 bg-[#1E293B]"></div>
                                    <svg className="h-4 md:h-6" viewBox="0 0 50 20" fill="currentColor">
                                        <path d="M12 9c0-1.8 1.4-2.8 2.2-3.3-1-1.1-2.6-1.3-3.1-1.3-1.3-.1-2.6.7-3.3.7-.7 0-1.7-.6-2.8-.6-1.5 0-2.9.8-3.6 2.1-1.6 2.8-.4 6.9 1.1 9.1.7 1.1 1.6 2.2 2.7 2.2 1.1 0 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-1.1 2.6-2.1.9-1.3 1.3-2.6 1.3-2.7 0-.1-2.5-1-2.5-3.8zm-1.8-6.1c.6-.7 1-1.7 1-2.7 0-.1 0-.2 0-.2-1 0-2 .6-2.6 1.4-.5.6-.9 1.6-.8 2.5.1 0 .2.1.2.1 1 0 1.7-.5 2.2-1.1z" />
                                        <text x="20" y="15" fontSize="16" fontWeight="bold">Pay</text>
                                    </svg>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MetamorfosisCalculator;
