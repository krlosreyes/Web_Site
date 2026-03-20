/**
 * IMR DIGITAL DISPLAY - Ecosistema Metamorfosis
 * Visualización técnica y autoritaria del Índice Metamorfosis Real.
 */

import React from 'react';

interface IMRDisplayProps {
    report: {
        imrScore: number;
        label: 'Eficiente' | 'Inflamado' | 'Riesgo';
        metabolicAge: number;
        ica: number;
        recommendations: {
            science: string;
            advice: string;
        };
    };
}

export const IMRDisplay: React.FC<IMRDisplayProps> = ({ report }) => {
    const { imrScore, label, metabolicAge, ica, recommendations } = report;

    // Colores basados en el estado
    const statusColors = {
        Eficiente: 'text-emerald-400 border-emerald-400/50 bg-emerald-950/20',
        Inflamado: 'text-amber-400 border-amber-400/50 bg-amber-950/20',
        Riesgo: 'text-red-400 border-red-400/50 bg-red-950/20'
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 font-sans antialiased text-slate-100">
            
            {/* Cabecera IMR: El Valor de Autoridad */}
            <div className={`p-6 border rounded-xl backdrop-blur-sm transition-all duration-300 ${statusColors[label]}`}>
                <div className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
                    <div>
                        <h3 className="text-sm font-bold tracking-widest uppercase opacity-80">Índice Metamorfosis Real</h3>
                        <p className="text-4xl font-black uppercase tracking-tighter md:text-5xl">{label}</p>
                    </div>
                    
                    <div className="flex flex-col items-center">
                        <span className="text-6xl font-black md:text-7xl">{imrScore}</span>
                        <span className="text-xs font-bold uppercase tracking-widest opacity-60">Puntaje IMR</span>
                    </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-current/20 grid grid-cols-2 gap-4 text-center">
                    <div className="flex flex-col">
                        <span className="text-xs uppercase opacity-60">ICA Ratio</span>
                        <span className="text-xl font-mono font-bold tracking-tight">{ica.toFixed(4)}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs uppercase opacity-60">Edad Metabólica Est.</span>
                        <span className="text-xl font-mono font-bold tracking-tight">{metabolicAge} años</span>
                    </div>
                </div>
            </div>

            {/* Cajas de Información Crítica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Caja Azul: CIENCIA */}
                <div className="p-5 bg-blue-900/20 border border-blue-500/30 rounded-lg shadow-inner">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <h4 className="text-sm font-black uppercase tracking-wider text-blue-400">Pilar Ciencia: ¿Por qué el ICA?</h4>
                    </div>
                    <p className="text-sm leading-relaxed text-blue-100/80">
                        {recommendations.science}
                    </p>
                </div>

                {/* Caja Verde: CONSEJO/PROTOCOLO */}
                <div className="p-5 bg-emerald-900/20 border border-emerald-500/30 rounded-lg shadow-inner">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h4 className="text-sm font-black uppercase tracking-wider text-emerald-400">Pilar Protocolo: Pasos a seguir</h4>
                    </div>
                    <p className="text-sm leading-relaxed text-emerald-100/80 italic">
                        {recommendations.advice}
                    </p>
                </div>

            </div>

            {/* Footer Técnico */}
            <p className="text-[10px] text-center uppercase tracking-widest opacity-40 font-mono">
                IMR-ENGINE V01 // ALRGORITHM DOMINATED BY WHtR (WAIST-TO-HEIGHT RATIO) // METAMORFOSIS REAL ECOSYSTEM
            </p>

        </div>
    );
};
