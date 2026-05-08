import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { calculateSPEC705 } from '../utils/imr-engine';

const IMRQuiz = () => {
    const [step, setStep] = useState(0); 
    const [subStep, setSubStep] = useState(1); // 1-8 pasos técnicos
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);

    // Estado del Motor SPEC-70.5
    const [bioData, setBioData] = useState({
        gender: 'male' as 'male' | 'female',
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
        lastMealHour: 20
    });

    // Estado de Registro
    const [regData, setRegData] = useState({ name: '', email: '', pass: '' });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                setRegData(prev => ({ ...prev, name: user.displayName || '', email: user.email || '' }));
            }
        });
        return () => unsubscribe();
    }, []);

    const nextSubStep = () => {
        if (subStep < 8) setSubStep(subStep + 1);
        else handleFinish();
    };

    const handleFinish = async () => {
        const result = calculateSPEC705({
            ...bioData,
            hydrationGoal: 3, // Meta estándar
        });

        if (currentUser) {
            await autoSave(result);
        } else {
            setStep(2); // Ir a Registro
        }
    };

    const autoSave = async (result: any) => {
        setIsSaving(true);
        try {
            const profileRef = doc(db, 'users', currentUser.email.toLowerCase());
            await setDoc(profileRef, {
                imr: result.imr,
                zona: result.zona,
                blocks: result.blocks,
                ffmi: result.ffmi,
                whtr: result.whtr,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            sessionStorage.setItem('imr_score', result.imr.toString());
            window.location.href = '/dashboard';
        } catch (err) {
            console.error(err);
            setStep(2);
        }
    };

    const handleFinalRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const result = calculateSPEC705({ ...bioData, hydrationGoal: 3 });
        try {
            const userCred = await createUserWithEmailAndPassword(auth, regData.email, regData.pass);
            await updateProfile(userCred.user, { displayName: regData.name });
            const profileRef = doc(db, 'users', regData.email.toLowerCase());
            await setDoc(profileRef, {
                imr: result.imr,
                zona: result.zona,
                blocks: result.blocks,
                updatedAt: new Date().toISOString()
            });
            sessionStorage.setItem('imr_score', result.imr.toString());
            window.location.href = '/dashboard';
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setIsAlreadyRegistered(true);
            } else {
                alert(err.message);
            }
            setIsSaving(false);
        }
    };

    if (step === 0) {
        return (
            <div className="text-center py-20 animate-fade-in flex flex-col items-center">
                <div className="mb-12">
                   <h2 className="text-blue-400 text-xs font-black uppercase tracking-[0.6em] mb-4">Protocolo SPEC-70.5</h2>
                   <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-[#00C49A] mx-auto"></div>
                </div>
                <button onClick={() => setStep(1)} className="relative group outline-none">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                    <div className="relative px-14 py-6 bg-gradient-to-r from-[#00C49A] to-teal-600 text-white text-2xl font-black rounded-full border border-blue-400/50 flex items-center gap-4 hover:scale-105 transition-all shadow-2xl">
                        INICIAR ESCANEO IMR
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </div>
                </button>
                <p className="mt-12 text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Basado en Composición Visceral y Ritmos Circadianos</p>
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
                    <button onClick={nextSubStep} className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20">
                        {subStep === 8 ? 'Finalizar Escaneo →' : 'Siguiente Paso'}
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
                <input required type="password" placeholder="Crea una clave..." className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 px-8 text-white outline-none focus:border-blue-500" value={regData.pass} onChange={e => setRegData({...regData, pass: e.target.value})} />
                <button disabled={isSaving} type="submit" className="w-full bg-blue-600 text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] shadow-xl hover:bg-blue-500 transition-all">
                    {isSaving ? "Generando Reporte..." : "Ver Resultados de Autoridad →"}
                </button>
            </form>
        </div>
    );
};

export default IMRQuiz;
