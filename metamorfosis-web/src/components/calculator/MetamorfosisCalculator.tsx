import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ControlPanel from './ControlPanel'; 
import MorphingSilhouette from './MorphingSilhouette';
import { IMRDisplay } from './IMRDisplay';

import type { IMRResult } from '../../utils/imr-engine';

const MetamorfosisCalculator = () => {
    // 1. Estados Biométricos & IMR
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [weight, setWeight] = useState<number>(85);
    const [height, setHeight] = useState<number>(180);
    const [waist, setWaist] = useState<number>(95);
    const [hip, setHip] = useState<number>(100);
    const [neck, setNeck] = useState<number>(40);
    const [age, setAge] = useState<number>(48);
    const [pathologies, setPathologies] = useState<string[]>(['insulin_resistance']);

    // 2. Estados de Estilo de Vida
    const [fastingHours, setFastingHours] = useState<number>(12);
    const [energyScore, setEnergyScore] = useState<number>(5);
    const [nutritionScore, setNutritionScore] = useState<number>(5);
    const [exerciseDays, setExerciseDays] = useState<number>(2);
    const [sleepHours, setSleepHours] = useState<number>(6);

    // 3. Estado de Resultados (IMR Engine)
    const [result, setResult] = useState<IMRResult | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    const togglePathology = (path: string) => {
        setPathologies(prev => 
            prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
        );
    };

    // Motor de Cálculo IMR
    const calculateIMR = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/calculate-imr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    heightCm: height,
                    currentWeightKg: weight,
                    waistCircumferenceCm: waist,
                    neckCircumferenceCm: neck,
                    pathologies,
                    age,
                    gender
                })
            });

            if (response.ok) {
                const data = await response.json();
                setResult(data.result);
                
                // Persistencia para Diagnóstico
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem("imr_score", data.result.imrScore.toString());
                    sessionStorage.setItem("imr_label", data.result.label);
                    sessionStorage.setItem("ica_ratio", data.result.ica.toString());
                }
            }
        } catch (error) {
            console.error("Error calcutating IMR:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
            calculateIMR();
        }, 500);
        return () => {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        };
    }, [gender, weight, height, waist, hip, neck, age, pathologies, fastingHours, energyScore, nutritionScore, exerciseDays, sleepHours]);

    const imrScore = result?.imrScore || 0;
    const textColor = result?.label === 'Riesgo' ? 'text-red-500' : result?.label === 'Inflamado' ? 'text-amber-400' : 'text-teal-400';

    const handleRedirect = () => {
        window.location.href = '/diagnostico';
    };

    return (
        <div className="fixed top-[80px] left-0 right-0 bottom-0 overflow-y-auto no-scrollbar text-white
                        bg-[radial-gradient(circle_at_30%_30%,_#0b1e2d_0%,_#07131f_60%,_#050c14_100%)]
                        p-[20px] md:p-[40px] font-sans">

            <div className="w-full max-w-[1400px] mx-auto min-h-full flex flex-col gap-8 pb-20">
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    
                    {/* IZQUIERDA: SILUETA & CONTROLES */}
                    <div className="space-y-8">
                        <div className="relative aspect-square md:aspect-video lg:aspect-square bg-[#0c1f31]/60 backdrop-blur-xl rounded-[28px] border border-[#2DD4BF]/20 flex items-center justify-center p-8 overflow-hidden">
                             <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-10">
                                <svg width="100%" height="100%" viewBox="0 0 400 600">
                                    <circle cx="200" cy="300" r="280" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-teal-500" />
                                </svg>
                            </div>
                            <MorphingSilhouette imr={imrScore} />
                        </div>

                        <div className="bg-[#0c1f31]/60 backdrop-blur-xl rounded-[28px] border border-[#2DD4BF]/20 p-8">
                            <ControlPanel
                                gender={gender} setGender={setGender}
                                weight={weight} setWeight={setWeight}
                                height={height} setHeight={setHeight}
                                waist={waist} setWaist={setWaist}
                                hip={hip} setHip={setHip}
                                neck={neck} setNeck={setNeck}
                                age={age} setAge={setAge}
                                pathologies={pathologies} togglePathology={togglePathology}
                                fastingHours={fastingHours} setFastingHours={setFastingHours}
                                energyScore={energyScore} setEnergyScore={setEnergyScore}
                                nutritionScore={nutritionScore} setNutritionScore={setNutritionScore}
                                exerciseDays={exerciseDays} setExerciseDays={setExerciseDays}
                                sleepHours={sleepHours} setSleepHours={setSleepHours}
                                textColor={textColor}
                            />
                        </div>
                    </div>

                    {/* DERECHA: REPORTE IMR TÉCNICO */}
                    <div className="lg:sticky lg:top-0 space-y-6">
                        {result ? (
                            <IMRDisplay report={result} />
                        ) : (
                            <div className="h-64 flex items-center justify-center bg-[#0c1f31]/40 rounded-[28px] border border-white/5">
                                <span className="text-gray-500 font-mono animate-pulse uppercase tracking-widest text-xs">Calculando Predicción Metabólica...</span>
                            </div>
                        )}
                        
                        <div className="flex flex-col gap-4">
                            <motion.button 
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={handleRedirect}
                                className="w-full bg-[#00f5d4] hover:bg-[#00e3c5] text-[#0c1f31] h-16 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all"
                            >
                                Activar Protocolo Metamorfosis
                            </motion.button>
                            <div className="flex gap-4">
                                <button className="flex-1 bg-white/5 border border-white/10 h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all text-gray-400">
                                    Exportar Reporte Técnico
                                </button>
                                <button className="flex-1 bg-black h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                    <span>G Pay</span>
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MetamorfosisCalculator;
