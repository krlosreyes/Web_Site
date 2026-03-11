
import React from 'react';
import { MANUAL_STEPS } from '../data/metabolicProtocol';

export default function ManualFase0() {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-blue-900/20 border border-blue-500/30 p-6 rounded-2xl">
                <h3 className="text-xl font-black text-blue-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                    Protocolo Fase 0
                </h3>
                <p className="text-gray-300 leading-relaxed mb-4">
                    Estás iniciando un reinicio del sistema operativo biológico. Estas son las directrices no negociables para la próxima semana.
                </p>
            </div>

            <div className="grid gap-4">
                {MANUAL_STEPS.map((step, idx) => (
                    <div key={idx} className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl hover:border-gray-700 transition-colors">
                        <h4 className="text-lg font-bold text-white mb-2">{step.title}</h4>
                        <p className="text-gray-400 font-mono text-sm leading-relaxed border-l-2 border-[#00C49A] pl-4">
                            {step.content}
                        </p>
                    </div>
                ))}
            </div>

            <div className="text-center pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest">Fin del Manual de Operaciones</p>
            </div>
        </div>
    );
}
