import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/constants/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const Icons = {
    Estructura: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    Metabolismo: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
    Conducta: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    Rocket: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>,
    ArrowRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
};

const BioDashboard = () => {
    const [stats, setStats] = useState<any>({
        imr: 0,
        userName: 'Biohacker',
        zona: 'Analizando...',
        blocks: { E: 0, M: 0, C: 0 },
        isLoading: true
    });

    useEffect(() => {
        const fetchUserData = async (email: string, displayName: string | null) => {
            let mergedData: any = {};
            let errors: any[] = [];
            
            try {
                // TODO(SPEC-005.3): borrar tras migración. La colección 'profiles'
                // se elimina cuando el script migrate-users-schema-v1 corra y
                // mueva los docs a users/{uid}. No se agrega como constante en
                // COLLECTIONS porque no debe usarse en código nuevo.
                const profileRef = doc(db, 'profiles', email.toLowerCase());
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists()) mergedData = { ...profileSnap.data() };
            } catch (e: any) {
                errors.push("profiles: " + e.message);
            }

            try {
                // TODO(SPEC-005.4): cambiar key de email a uid tras migración.
                const userRef = doc(db, COLLECTIONS.USERS, email.toLowerCase());
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) mergedData = { ...mergedData, ...userSnap.data() };
            } catch (e: any) {
                errors.push("users: " + e.message);
            }

            if (Object.keys(mergedData).length > 0) {
                setStats((prev: any) => ({ ...prev, ...mergedData, userName: displayName || 'Biohacker', isLoading: false, debugErrors: errors }));
            } else {
                setStats((prev: any) => ({ ...prev, userName: displayName || 'Biohacker', isLoading: false, debugErrors: errors, debugMsg: "No data in DB" }));
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && user.email) fetchUserData(user.email, user.displayName);
            else {
                const localScore = sessionStorage.getItem('imr_score');
                const localName = sessionStorage.getItem('imr_userName');
                if (localScore) {
                    setStats({ imr: parseInt(localScore), userName: localName || 'Biohacker', zona: 'Análisis SPEC-70.5', blocks: { E: 0.5, M: 0.4, C: 0.6 }, isLoading: false });
                } else {
                    setStats((prev: any) => ({ ...prev, isLoading: false }));
                }
            }
        });
        return () => unsubscribe();
    }, []);

    const imrColor = stats.imr < 40 ? '#EF4444' : stats.imr < 60 ? '#F59E0B' : '#10B981';

    const blocksMapping = [
        { key: 'E', label: 'Estructura', icon: <Icons.Estructura /> },
        { key: 'M', label: 'Metabolismo', icon: <Icons.Metabolismo /> },
        { key: 'C', label: 'Conducta', icon: <Icons.Conducta /> }
    ];

    const getBestQuizzes = () => {
        if (!stats.completedQuizzes || stats.completedQuizzes.length === 0) return [];
        const bestScores = new Map<string, any>();
        stats.completedQuizzes.forEach((quiz: any) => {
            if (!bestScores.has(quiz.articleId) || bestScores.get(quiz.articleId).score < quiz.score) {
                bestScores.set(quiz.articleId, quiz);
            }
        });
        return Array.from(bestScores.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const bestQuizzes = getBestQuizzes();

    return (
        <div className="animate-fade-in space-y-12 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                <div>
                    <h1 className="text-6xl font-black text-white italic uppercase tracking-tight leading-none">
                        Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#00C49A]">{stats.userName}</span>
                    </h1>
                    <p className="mt-4 text-gray-500 text-[10px] font-black uppercase tracking-[0.4em]">Reporte de Diagnóstico SPEC-70.5</p>
                </div>
                <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#00C49A] animate-pulse"></span>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{stats.zona}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* IMR Main Circle Card */}
                <div className="lg:col-span-5 h-full">
                    <div className="bg-[#0c1f31]/40 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 text-center relative overflow-hidden shadow-2xl h-full flex flex-col justify-center">
                        <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: imrColor }}></div>
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-10">Puntaje Global IMR</h3>
                        
                        <div className="relative w-60 h-60 mx-auto mb-10">
                            <svg className="w-full h-full -rotate-90">
                                <circle cx="120" cy="120" r="108" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                                <circle cx="120" cy="120" r="108" stroke={imrColor} strokeWidth="10" fill="transparent" 
                                    strokeDasharray={678}
                                    strokeDashoffset={678 - (678 * stats.imr) / 100}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-6xl font-black text-white italic tracking-tighter" style={{ color: imrColor }}>{stats.imr}</span>
                                <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">/ 100</span>
                            </div>
                        </div>

                        <p className="text-sm font-medium text-gray-400 max-w-[250px] mx-auto leading-relaxed mb-10">
                            {stats.imr < 40 ? 'Tu metabolismo necesita ajustes estructurales profundos.' : 
                             stats.imr < 60 ? 'Estás en zona de transición. Hay fundamentos por corregir.' : 
                             'Tu metabolismo opera con alta eficiencia.'}
                        </p>

                        <div className="grid grid-cols-3 gap-3">
                            {blocksMapping.map((b: any) => (
                                <div key={b.key} className="bg-black/40 p-3 rounded-2xl border border-white/5 flex flex-col items-center gap-1 group">
                                    <div className="text-[#00C49A] opacity-60 scale-90">{b.icon}</div>
                                    <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{b.label}</div>
                                    <div className="text-lg font-black text-white italic">{Math.round((stats.blocks?.[b.key] || 0) * 100)}%</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Pillars & Actions */}
                <div className="lg:col-span-7 flex flex-col gap-8 h-full justify-between">
                    
                    {/* CARD 1: ELENA APP - COMPACTA */}
                    <div className="bg-gradient-to-br from-[#00C49A]/10 to-transparent border border-[#00C49A]/20 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-[#00C49A]/20 rounded-2xl flex items-center justify-center text-[#00C49A] border border-[#00C49A]/20 shrink-0">
                                <Icons.Rocket />
                            </div>
                            <div>
                                <h4 className="text-white font-black text-lg uppercase tracking-tighter italic leading-none mb-2">Elena App: Lista de Espera</h4>
                                <p className="text-gray-400 text-sm leading-snug">
                                    Ya estás en lista de espera para conocer <span className="text-white font-bold italic">Elena App</span>, la herramienta que te ayudará a elevar tu IMR y mejorar tu metabolismo.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CARD 2: COMUNIDAD */}
                    <a href="/comunidad" className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 group hover:border-blue-400/40 transition-all shadow-2xl flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="w-12 h-12 bg-blue-400/10 rounded-2xl flex items-center justify-center text-blue-400 group-hover:bg-blue-400 group-hover:text-black transition-all">
                                <Icons.ArrowRight />
                            </div>
                            <div>
                                <h4 className="text-white font-black text-2xl uppercase tracking-tighter italic leading-none">La <span className="text-blue-400">Tribu</span> Biohacker</h4>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Acceso a Foros y Comunidad</p>
                            </div>
                        </div>
                        <div className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] group-hover:bg-blue-500 transition-all shadow-lg">
                            Entrar Ahora
                        </div>
                    </a>

                    {/* CARD 3: RESULTADOS DE EVALUACIONES (BIBLIOTECA) */}
                    <div className="bg-[#0c1f31]/40 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-white font-black text-lg uppercase tracking-tighter italic leading-none">
                                Dominio Teórico
                            </h4>
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
                                {bestQuizzes.length} Módulos
                            </span>
                        </div>
                        
                        {bestQuizzes.length > 0 ? (
                            <div className="space-y-3">
                                {bestQuizzes.slice(0, 2).map((quiz: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-4">
                                            {quiz.score >= 70 ? (
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border bg-[#00C49A]/10 text-[#00C49A] border-[#00C49A]/30">
                                                    ✓
                                                </div>
                                            ) : (
                                                <a href={`/posts/${quiz.articleId}`} className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border bg-yellow-500/10 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500 hover:text-black transition-colors" title="Reintentar Módulo">
                                                    ↻
                                                </a>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em]">Pilar Evaluado</span>
                                                <span className="text-gray-300 text-xs font-bold uppercase tracking-widest max-w-[200px] truncate">{quiz.articleId.replace(/-/g, ' ')}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] mb-1">Score</span>
                                                <span className={`text-xl font-black italic leading-none ${quiz.score >= 70 ? 'text-[#00C49A]' : 'text-yellow-500'}`}>
                                                    {quiz.score}%
                                                </span>
                                            </div>
                                            {quiz.score < 70 && (
                                                <a href={`/posts/${quiz.articleId}`} className="text-[9px] text-yellow-500 font-black uppercase tracking-widest hover:text-yellow-400 mt-1">
                                                    Reintentar →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-8 bg-black/40 rounded-2xl border border-white/5">
                                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">No hay evaluaciones recientes</p>
                                <a href="/biblioteca" className="inline-block px-6 py-3 bg-white/5 text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all">
                                    Explorar Biblioteca Teórica →
                                </a>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BioDashboard;
