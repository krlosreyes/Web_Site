
import React from 'react';
import { DAILY_PROTOCOL } from '../data/metabolicProtocol';

interface BioDashboardProps {
    currentDay: number;
    completedDays: number[];
    userName: string;
    onCheckDay: (day: number) => void;
}

export default function BioDashboard({ currentDay, completedDays, userName, onCheckDay }: BioDashboardProps) {

    // Money Page State (Day 7 Completed)
    if (completedDays.includes(7)) {
        return (
            <div className="animate-fade-in-up py-12 text-center">
                <div className="inline-block p-4 rounded-full bg-[#00C49A]/20 border border-[#00C49A] mb-6">
                    <svg className="w-16 h-16 text-[#00C49A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">
                    SISTEMA REINICIADO
                </h2>
                <p className="text-xl text-gray-300 mb-8 max-w-lg mx-auto">
                    {DAILY_PROTOCOL[6].message.replace('{nombre}', userName)}
                </p>

                <div className="p-8 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-3xl shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[#007BFF]/10 z-0"></div>
                    <div className="relative z-10">
                        <h3 className="text-2xl font-bold text-white mb-2">Protocolo de Longevidad</h3>
                        <p className="text-gray-400 mb-6">Acceso Vitalicio a ElenaApp</p>
                        <a
                            href="https://buy.stripe.com/test_link_elena_app"
                            target="_blank"
                            className="block w-full py-4 bg-[#007BFF] hover:bg-[#0069d9] text-white font-black text-lg rounded-xl shadow-[0_0_20px_rgba(0,123,255,0.5)] hover:shadow-[0_0_30px_rgba(0,123,255,0.7)] transform hover:scale-[1.02] transition-all animate-pulse"
                        >
                            DESBLOQUEAR ELENA APP ➔
                        </a>
                        <p className="text-xs text-gray-600 mt-4">Encriptación Segura 256-bit</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-end mb-6 border-b border-gray-800 pb-4">
                <div>
                    <span className="text-xs font-mono text-[#00C49A] uppercase tracking-widest">Sujeto de Prueba</span>
                    <h2 className="text-2xl font-bold text-white">{userName}</h2>
                </div>
                <div className="text-right">
                    <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Estado</span>
                    <div className="text-xl font-bold text-blue-400">Día {currentDay} / 7</div>
                </div>
            </div>

            <div className="space-y-4">
                {DAILY_PROTOCOL.map((item) => {
                    const isCompleted = completedDays.includes(item.day);
                    const isActive = currentDay === item.day && !isCompleted; // Active if it's current day AND not yet checked
                    const isLocked = item.day > currentDay;

                    // Past completed days (Collapsed)
                    if (isCompleted) {
                        return (
                            <div key={item.day} className="flex items-center justify-between p-4 bg-gray-900/30 border border-[#00C49A]/30 rounded-xl opacity-60">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-[#00C49A]/20 text-[#00C49A] flex items-center justify-center border border-[#00C49A]">✓</div>
                                    <span className="text-gray-400 font-mono text-sm">Día {item.day}: {item.title}</span>
                                </div>
                            </div>
                        )
                    }

                    // Locked days (Blur)
                    if (isLocked) {
                        return (
                            <div key={item.day} className="flex items-center justify-between p-4 bg-black/20 border border-gray-800 rounded-xl opacity-40 blur-[1px] select-none">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full border border-gray-700 text-gray-700 flex items-center justify-center text-xs">{item.day}</div>
                                    <span className="text-gray-600 font-mono text-sm">Bloqueado</span>
                                </div>
                                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                            </div>
                        )
                    }

                    // Active Day (Expanded)
                    return (
                        <div key={item.day} className="relative p-1 rounded-2xl bg-gradient-to-r from-blue-600 to-[#00C49A]">
                            <div className="bg-gray-900 rounded-xl p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="py-1 px-3 bg-blue-900/30 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-lg uppercase tracking-wider">
                                        Día {item.day} Activo
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">{item.title}</h3>
                                <p className="text-gray-300 leading-relaxed mb-6 border-l-2 border-blue-500 pl-4">
                                    {item.message.replace('{nombre}', userName)}
                                </p>

                                <button
                                    onClick={() => onCheckDay(item.day)}
                                    className="w-full py-4 bg-[#00C49A] hover:bg-[#00a380] text-gray-900 font-black text-lg rounded-xl shadow-[0_0_15px_rgba(0,196,154,0.4)] transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    MARCAR OBJETIVO CUMPLIDO
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
