
import React, { useState } from 'react';
import { Timestamp } from 'firebase/firestore';

interface DailyLog {
    day: number;
    completed: boolean;
    checkFasting: boolean;
    checkFood: boolean;
    checkExercise: boolean;
    timestamp: Timestamp;
}

interface DailyStepProps {
    day: number;
    title: string;
    food: string;
    exercise: string;
    isLocked: boolean;
    isCompleted: boolean;
    isActive: boolean;
    onComplete: (day: number, checkFasting: boolean, checkFood: boolean, checkExercise: boolean) => void;
    log?: DailyLog;
}

const DailyStep: React.FC<DailyStepProps> = ({
    day,
    title,
    food,
    exercise,
    isLocked,
    isCompleted,
    isActive,
    onComplete,
    log
}) => {
    const [checkFasting, setCheckFasting] = useState(false);
    const [checkFood, setCheckFood] = useState(false);
    const [checkExercise, setCheckExercise] = useState(false);

    // Fasting Timer State
    const [lastMealTime, setLastMealTime] = useState("");
    const [nextMealTime, setNextMealTime] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLastMealTime(val);
        if (val) {
            const [hours, minutes] = val.split(':').map(Number);
            const nextMeal = new Date();
            nextMeal.setHours(hours + 16);
            nextMeal.setMinutes(minutes);

            const formatter = new Intl.DateTimeFormat('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            setNextMealTime(formatter.format(nextMeal));
        } else {
            setNextMealTime("");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Simulate network delay for better UX feel
        setTimeout(() => {
            onComplete(day, checkFasting, checkFood, checkExercise);
            setIsSubmitting(false);
        }, 800);
    };

    // State: LOCKED
    if (isLocked) {
        return (
            <div className="relative p-6 rounded-2xl bg-gray-900/50 border border-gray-800 opacity-60 backdrop-blur-sm">
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700 shadow-xl">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    </div>
                </div>
                <div className="filter blur-sm select-none pointer-events-none">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-500 font-bold uppercase tracking-widest text-sm">Día {day}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-300 mb-2">{title}</h3>
                    <p className="text-gray-500 line-clamp-2">Comida: {food}</p>
                    <p className="text-gray-500 line-clamp-2 mt-1">Ejercicio: {exercise}</p>
                </div>
            </div>
        );
    }

    // State: COMPLETED
    if (isCompleted) {
        return (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#00C49A]/10 to-green-900/10 border border-[#00C49A]/30 shadow-lg relative overflow-hidden group hover:border-[#00C49A]/50 transition-all">
                <div className="absolute top-4 right-4">
                    <div className="w-8 h-8 bg-[#00C49A] rounded-full flex items-center justify-center shadow-lg shadow-[#00C49A]/20">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                    <span className="text-[#00C49A] font-bold uppercase tracking-widest text-sm">Día {day} • Completado</span>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>

                <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2">
                    <div className="text-center bg-black/20 rounded-lg p-2 flex flex-col items-center">
                        <div className="text-[10px] text-gray-400 uppercase mb-1">Ayuno</div>
                        <div className={`w-3 h-3 rounded-full ${log?.checkFasting ? 'bg-[#00C49A]' : 'bg-red-500/50'}`}></div>
                    </div>
                    <div className="text-center bg-black/20 rounded-lg p-2 flex flex-col items-center">
                        <div className="text-[10px] text-gray-400 uppercase mb-1">Comida</div>
                        <div className={`w-3 h-3 rounded-full ${log?.checkFood ? 'bg-[#00C49A]' : 'bg-red-500/50'}`}></div>
                    </div>
                    <div className="text-center bg-black/20 rounded-lg p-2 flex flex-col items-center">
                        <div className="text-[10px] text-gray-400 uppercase mb-1">Ejercicio</div>
                        <div className={`w-3 h-3 rounded-full ${log?.checkExercise ? 'bg-[#00C49A]' : 'bg-red-500/50'}`}></div>
                    </div>
                </div>
            </div>
        );
    }

    const checklistItems = [
        {
            id: 'fasting',
            title: 'Ayuno 16h completado',
            description: 'Solo consumí agua, café negro o té verde. Cero calorías en mi ventana de ayuno.',
            checked: checkFasting,
            onChange: () => setCheckFasting(!checkFasting)
        },
        {
            id: 'food',
            title: 'Alimentación limpia',
            description: 'Cero azúcar, cero harinas refinadas. Prioricé proteína animal y grasas saludables.',
            checked: checkFood,
            onChange: () => setCheckFood(!checkFood)
        },
        {
            id: 'workout',
            title: 'Movimiento intencional',
            description: 'Completé la recomendación de ejercicio de hoy (fuerza o caminata activa).',
            checked: checkExercise,
            onChange: () => setCheckExercise(!checkExercise)
        }
    ];

    // State: ACTIVE
    return (
        <div className="p-1 rounded-2xl bg-gradient-to-r from-[#00C49A] to-[#007BFF] shadow-2xl shadow-blue-500/20 transform scale-[1.02] transition-transform">
            <div className="bg-gray-900 rounded-xl p-6 h-full">
                <div className="flex justify-between items-center mb-6">
                    <span className="inline-block py-1 px-3 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                        DÍA ACTIVO
                    </span>
                    <span className="text-gray-400 font-mono text-sm">Protocolo 7D</span>
                </div>

                <h3 className="text-2xl font-black text-white mb-3">{title}</h3>
                <div className="space-y-3 mb-8">
                    <div className="bg-black/30 p-4 rounded-xl border-l-4 border-[#00C49A]">
                        <span className="text-xs text-[#00C49A] font-bold uppercase block mb-1">Comida</span>
                        <p className="text-gray-200">{food}</p>
                    </div>
                    <div className="bg-black/30 p-4 rounded-xl border-l-4 border-blue-500">
                        <span className="text-xs text-blue-400 font-bold uppercase block mb-1">Ejercicio</span>
                        <p className="text-gray-200">{exercise}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 bg-black/20 p-6 rounded-xl border border-white/5">
                    {/* Fasting Timer */}
                    <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50">
                        <label className="block text-gray-300 text-sm font-bold mb-3">
                            <span className="mr-2">⏱</span> Calculadora de Ayuno
                        </label>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="w-full sm:w-1/2">
                                <span className="text-xs text-gray-500 uppercase block mb-1">Última comida ayer:</span>
                                <input
                                    type="time"
                                    value={lastMealTime}
                                    onChange={handleTimeChange}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00C49A] transition-colors"
                                />
                            </div>
                            {nextMealTime && (
                                <div className="w-full sm:w-1/2 bg-[#00C49A]/10 border border-[#00C49A]/30 p-3 rounded-lg flex flex-col justify-center items-center h-full">
                                    <span className="text-[10px] text-[#00C49A] font-bold uppercase tracking-wider">Ventana Abierta</span>
                                    <span className="text-xl font-black text-[#00C49A]">{nextMealTime}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 mt-6">Checklist Diario</h4>
                    <div className="space-y-3">
                        {checklistItems.map(item => (
                            <div
                                key={item.id}
                                className="flex items-start p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
                                onClick={item.onChange}
                            >
                                <div className={`mt-0.5 shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${item.checked ? 'bg-[#00C49A] border-[#00C49A]' : 'border-gray-500'}`}>
                                    {item.checked && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                </div>
                                <div className="ml-3">
                                    <span className="block text-white font-medium">{item.title}</span>
                                    <span className="block text-sm text-gray-400 mt-1">{item.description}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={(!checkFasting && !checkFood && !checkExercise) || isSubmitting}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all transform ${(checkFasting || checkFood || checkExercise) && !isSubmitting
                            ? 'bg-gradient-to-r from-[#00C49A] to-[#007BFF] text-white hover:scale-[1.02] shadow-lg hover:shadow-blue-500/25'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Guardando...
                            </span>
                        ) : "Completar Día"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default DailyStep;
