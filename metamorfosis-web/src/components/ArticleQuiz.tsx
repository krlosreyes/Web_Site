import React, { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/constants/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface Question {
    question: string;
    options: string[];
    correctIndex?: number | string;
    correctAnswer?: number | string;
    rationale?: string;
}

interface Props {
    questions: Question[];
    articleId: string;
}

const ArticleQuiz: React.FC<Props> = ({ questions: rawQuestions, articleId }) => {
    // Normalizar preguntas: soportar esquema español (pregunta/opciones/respuesta_correcta) e inglés
    const questions = rawQuestions.map((q: any) => {
        const question = q.question || q.pregunta || '';
        const options = q.options || q.opciones || [];
        
        let correctIndex = q.correctIndex;
        let correctAnswer = q.correctAnswer;

        // Si viene en formato español con respuesta_correcta como texto
        if (q.respuesta_correcta !== undefined && correctIndex === undefined && correctAnswer === undefined) {
            const idx = options.findIndex((o: string) => o === q.respuesta_correcta);
            correctIndex = idx >= 0 ? idx : 0;
        }

        return { question, options, correctIndex, correctAnswer: correctAnswer ?? correctIndex, rationale: q.rationale || q.explicacion || '' };
    });

    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [answered, setAnswered] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const checkIsCorrect = (index: number, q: any) => {
        const correct = q.correctIndex !== undefined ? q.correctIndex : q.correctAnswer;
        if (correct === undefined) return false;
        
        if (typeof correct === 'number') return index === correct;
        if (typeof correct === 'string') {
            const str = correct.trim().toUpperCase();
            if (!isNaN(Number(str))) return index === Number(str);
            if (str === 'A') return index === 0;
            if (str === 'B') return index === 1;
            if (str === 'C') return index === 2;
            if (str === 'D') return index === 3;
            if (q.options?.[index]?.trim().toLowerCase() === correct.trim().toLowerCase()) return true;
        }
        return false;
    };

    const handleAnswer = (index: number) => {
        if (answered) return;
        setSelectedIndex(index);
        setAnswered(true);
        if (checkIsCorrect(index, questions[currentIndex])) {
            setScore(prev => prev + 1);
        }
    };

    const nextQuestion = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setAnswered(false);
            setSelectedIndex(null);
        } else {
            handleFinish();
        }
    };

    const handleFinish = async () => {
        setShowResults(true);
        const finalPercentage = Math.round((score / questions.length) * 100);
        const dateIso = new Date().toISOString();

        if (currentUser) {
            try {
                // SPEC-005.4: doc keyado por uid (Firebase Auth), no por email.
                // Las Firestore rules de SPEC-008 requieren request.auth.uid == uid;
                // si seguimos usando email, las rules nos bloquean.
                // El array `completedQuizzes` se mantiene en el doc raíz (no en
                // subcolección) por simplicidad — la rule de update sobre
                // users/{uid} permite cambios excepto en app.*, así que este
                // campo arbitrario está habilitado.
                const profileRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
                await setDoc(profileRef, {
                    completedQuizzes: arrayUnion({
                        articleId,
                        score: finalPercentage,
                        date: dateIso
                    })
                }, { merge: true });
                // Despacha un evento por si necesitamos reaccionar en el dashboard
                window.dispatchEvent(new CustomEvent('imr_quiz_completed'));
                localStorage.setItem('imr_article_read', 'true');
            } catch (err: any) {
                console.error("Error saving quiz score:", err);
                alert("Error al guardar tus resultados: " + err.message);
            }
        } else {
            // SPEC-024: anónimo. Persistimos el quiz pendiente en sessionStorage
            // para que el flush post-registro/login lo recoja en la misma sesión.
            // Si cierra el browser sin registrarse, se descarta (esperado).
            try {
                sessionStorage.setItem('imr_pending_quiz', JSON.stringify({
                    articleId,
                    score,
                    total: questions.length,
                    percentage: finalPercentage,
                    date: dateIso,
                }));
            } catch (err) {
                // sessionStorage puede fallar en modo restringido; no es crítico
                console.warn('[ArticleQuiz] sessionStorage no disponible:', err);
            }
            // Marcar imr_article_read para habilitar el tab "Crear Perfil" en /login
            localStorage.setItem('imr_article_read', 'true');
        }
    };

    if (showResults) {
        const percentage = Math.round((score / questions.length) * 100);

        // SPEC-024: gating del score para anónimos. Forzamos registro/login
        // para revelar el resultado y persistir el quiz en su perfil.
        if (!currentUser) {
            return (
                <div className="bg-[#0c1f31]/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 text-center animate-fade-in shadow-2xl">
                    <div className="text-6xl mb-6">🔒</div>
                    <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">
                        Tu puntaje está listo
                    </h3>

                    {/* Score blurreado como teaser */}
                    <div className="inline-flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-8 py-6 mb-8 relative overflow-hidden">
                        <span
                            className="text-5xl font-black text-blue-400 select-none"
                            style={{ filter: 'blur(12px)' }}
                            aria-hidden="true"
                        >
                            ?/?
                        </span>
                        <div className="text-left border-l border-white/10 pl-6">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Puntuación</p>
                            <p
                                className="text-2xl font-black text-[#00C49A] select-none"
                                style={{ filter: 'blur(10px)' }}
                                aria-hidden="true"
                            >
                                ??%
                            </p>
                        </div>
                    </div>

                    <p className="text-gray-300 mb-3 max-w-md mx-auto font-medium leading-relaxed">
                        Registrate para ver tu puntaje, acceder al dashboard
                        y entrar a la <span className="text-[#00C49A] font-bold">lista de espera de ElenaApp</span>.
                    </p>
                    <p className="text-[10px] text-gray-600 font-mono mb-8 uppercase tracking-widest">
                        Tu progreso queda guardado en tu perfil tras el registro.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-8 py-4 bg-white/5 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all"
                        >
                            Reintentar
                        </button>
                        <a
                            href="/login"
                            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30"
                        >
                            Registrate y ver puntaje →
                        </a>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-[#0c1f31]/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 text-center animate-fade-in shadow-2xl">
                <div className="text-6xl mb-6">{percentage >= 70 ? '🏆' : '📚'}</div>
                <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">Resultados</h3>
                <div className="inline-flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-8 py-6 mb-8">
                    <span className="text-5xl font-black text-blue-400">{score}/{questions.length}</span>
                    <div className="text-left border-l border-white/10 pl-6">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Puntuación</p>
                        <p className="text-2xl font-black text-[#00C49A]">{percentage}%</p>
                    </div>
                </div>
                <p className="text-gray-400 mb-8 max-w-sm mx-auto font-medium">
                    {percentage >= 70
                        ? '¡Excelente! Has dominado la teoría de este pilar biológico.'
                        : 'Buen intento, pero te recomendamos repasar los conceptos técnicos.'}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={() => window.location.reload()} className="px-8 py-4 bg-white/5 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all">Reintentar</button>
                    <a href="/dashboard" className="px-8 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20">Ir al Dashboard →</a>
                </div>
            </div>
        );
    }

    const q = questions[currentIndex];
    const progress = ((currentIndex + 1) / questions.length) * 100;

    if (!q) {
        return <div className="p-10 text-white text-center">Error: Pregunta no encontrada en el índice {currentIndex}</div>;
    }

    if (!Array.isArray(q.options)) {
        return (
            <div className="p-10 text-white text-center bg-red-900/50 rounded-2xl border border-red-500">
                <h3 className="font-bold text-red-400 mb-2">Error Crítico de Datos (CMS)</h3>
                <p className="text-xs font-mono mb-4 text-left p-4 bg-black/50 rounded-lg overflow-auto">
                    La propiedad 'options' no es un array. Estructura recibida:<br/>
                    {JSON.stringify(q, null, 2)}
                </p>
            </div>
        );
    }

    return (
        <div className="bg-[#0c1f31]/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl">
            <div className="mb-10">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-blue-400 mb-4">
                    <span>Evaluación: {currentIndex + 1}/{questions.length}</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
            </div>

            <h3 className="text-2xl font-black text-white italic uppercase tracking-tight mb-8 leading-tight">{q.question}</h3>
            
            <div className="space-y-3 mb-8">
                {q.options.map((opt, i) => (
                    <button 
                        key={i} 
                        onClick={() => handleAnswer(i)}
                        disabled={answered}
                        className={`w-full text-left p-5 rounded-2xl border transition-all text-sm font-bold uppercase tracking-tight flex items-center gap-4
                            ${!answered ? 'bg-white/5 border-white/5 hover:border-blue-500/50 hover:bg-white/10 text-gray-300' : 
                              checkIsCorrect(i, q) ? 'bg-green-500/20 border-green-500 text-green-400' : 
                              i === selectedIndex ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-black/20 border-white/5 text-gray-600'}`}
                    >
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${checkIsCorrect(i, q) && answered ? 'bg-green-500 border-none text-black' : 'border-white/10 text-gray-500'}`}>
                            {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                    </button>
                ))}
            </div>

            {answered && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl mb-8">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">{checkIsCorrect(selectedIndex!, q) ? '¡Correcto!' : 'Explicación Técnica'}</p>
                        <p className="text-gray-300 text-xs leading-relaxed font-medium">
                            {q.rationale || (checkIsCorrect(selectedIndex!, q) ? 'Has seleccionado la respuesta correcta basándonos en la evidencia de este artículo.' : 'La respuesta seleccionada no es correcta según los fundamentos de este módulo.')}
                        </p>
                        
                        {/* DEBUG DATA (Solo visible si hay falla de consistencia y no se definió ni index ni answer) */}
                        {!checkIsCorrect(selectedIndex!, q) && q.correctIndex === undefined && q.correctAnswer === undefined && (
                            <div className="mt-4 p-3 bg-black/40 border border-white/5 rounded-xl text-[9px] font-mono text-gray-500 overflow-hidden">
                                <span className="text-red-400 font-bold">Error CMS | </span> 
                                El artículo no tiene definida la respuesta correcta (faltan correctIndex y correctAnswer).
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end">
                        <button onClick={nextQuestion} className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-lg">
                            {currentIndex < questions.length - 1 ? 'Siguiente Pregunta →' : 'Finalizar Evaluación'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArticleQuiz;
