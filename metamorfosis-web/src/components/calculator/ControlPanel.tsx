import React from 'react';

// Isolated Slider Component
interface SliderFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    unit: string;
    setter: (val: number) => void;
    activeColor: string;
}

export const SliderField: React.FC<SliderFieldProps> = ({ label, value, min, max, unit, setter, activeColor }) => {
    return (
        <div className="w-full relative mb-4">
            <div className="flex items-center justify-between mb-1">
                <label className="text-gray-400 font-sans text-xs uppercase tracking-widest">{label}</label>
                <div className="flex items-center">
                    <span className={`font-black text-lg ${activeColor} transition-colors`}>{value}</span>
                    <span className="text-gray-500 text-xs ml-1 font-bold">{unit}</span>
                </div>
            </div>
            <div className="relative flex items-center h-4">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => setter(Number(e.target.value))}
                    className="absolute z-10 w-full h-full opacity-0 cursor-pointer"
                />

                {/* Custom Track */}
                <div className="absolute w-full h-[2px] bg-[#07131f] rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[#00f5d4] transition-all duration-150 ease-out"
                        style={{ width: `${((value - min) / (max - min)) * 100}%` }}
                    />
                </div>

                {/* Custom Thumb */}
                <div
                    className="absolute w-3 h-3 bg-[#00f5d4] rounded-full shadow-[0_0_12px_rgba(0,245,212,1)] pointer-events-none transition-all duration-150 ease-out"
                    style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 6px)` }}
                />
            </div>
        </div>
    );
};

export interface ControlPanelProps {
    gender: 'male' | 'female';
    setGender: (g: 'male' | 'female') => void;
    // Capa B
    weight: number; setWeight: (w: number) => void;
    height: number; setHeight: (h: number) => void;
    waist: number; setWaist: (w: number) => void;
    hip: number; setHip: (h: number) => void;
    neck: number; setNeck: (n: number) => void;
    // Capa M
    fastingHours: number; setFastingHours: (h: number) => void;
    energyScore: number; setEnergyScore: (s: number) => void;
    // Capa H
    nutritionScore: number; setNutritionScore: (s: number) => void;
    exerciseDays: number; setExerciseDays: (d: number) => void;
    sleepHours: number; setSleepHours: (h: number) => void;

    textColor: string;
}

const ControlPanel: React.FC<ControlPanelProps> = (props) => {
    return (
        <div className="w-full flex flex-col z-10 relative overflow-y-auto pr-2 max-h-[500px] custom-scrollbar">
            <h2 className="text-lg md:text-xl font-black uppercase tracking-widest text-[#00f5d4] mb-4 drop-shadow-[0_0_8px_rgba(0,245,212,0.5)] sticky top-0 bg-[#0c1f31]/90 backdrop-blur-md z-20 py-2">
                EVALUACIÓN IMX
            </h2>

            <div className="flex gap-4 mb-6">
                <button
                    className={`flex-1 py-2 rounded-xl border ${props.gender === 'male' ? 'bg-gradient-to-r from-[#00ebcb] to-[#00f5d4] border-transparent text-[#0c1f31] shadow-[0_0_15px_rgba(0,245,212,0.4)]' : 'bg-[#050c14] border-gray-700 text-gray-500'} uppercase text-sm font-bold tracking-widest transition-all duration-300`}
                    onClick={() => props.setGender('male')}
                >MASCULINO</button>
                <button
                    className={`flex-1 py-2 rounded-xl border ${props.gender === 'female' ? 'bg-gradient-to-r from-[#00ebcb] to-[#00f5d4] border-transparent text-[#0c1f31] shadow-[0_0_15px_rgba(0,245,212,0.4)]' : 'bg-[#050c14] border-gray-700 text-gray-500'} uppercase text-sm font-bold tracking-widest transition-all duration-300`}
                    onClick={() => props.setGender('female')}
                >FEMENINO</button>
            </div>

            {/* Capa B: Cuerpo */}
            <div className="mb-6 space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-700/50 pb-1">Capa B: Cuerpo</h3>
                <SliderField label="Peso" value={props.weight} min={40} max={150} unit="kg" setter={props.setWeight} activeColor={props.textColor} />
                <SliderField label="Altura" value={props.height} min={140} max={220} unit="cm" setter={props.setHeight} activeColor={props.textColor} />
                <SliderField label="Cintura" value={props.waist} min={50} max={150} unit="cm" setter={props.setWaist} activeColor={props.textColor} />
                <SliderField label="Cadera" value={props.hip} min={50} max={160} unit="cm" setter={props.setHip} activeColor={props.textColor} />
                <SliderField label="Cuello" value={props.neck} min={25} max={60} unit="cm" setter={props.setNeck} activeColor={props.textColor} />
            </div>

            {/* Capa M: Metabolismo */}
            <div className="mb-6 space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-700/50 pb-1">Capa M: Metabolismo</h3>
                <SliderField label="Ayuno Promedio" value={props.fastingHours} min={0} max={24} unit="h" setter={props.setFastingHours} activeColor={props.textColor} />
                <SliderField label="Vitalidad (Energía)" value={props.energyScore} min={0} max={10} unit="/10" setter={props.setEnergyScore} activeColor={props.textColor} />
            </div>

            {/* Capa H: Hábitos */}
            <div className="space-y-2 pb-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-700/50 pb-1">Capa H: Hábitos</h3>
                <SliderField label="Dieta (0=Chatarra, 10=Limpio)" value={props.nutritionScore} min={0} max={10} unit="/10" setter={props.setNutritionScore} activeColor={props.textColor} />
                <SliderField label="Ejercicio Semanal" value={props.exerciseDays} min={0} max={7} unit="días" setter={props.setExerciseDays} activeColor={props.textColor} />
                <SliderField label="Sueño" value={props.sleepHours} min={0} max={12} unit="h" setter={props.setSleepHours} activeColor={props.textColor} />
            </div>

        </div>
    );
};

export default ControlPanel;
