import React, { useState } from 'react';

interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    rationale: string;
}

interface ArticleQuizProps {
    quizData: QuizQuestion[];
}

const ArticleQuiz: React.FC<ArticleQuizProps> = ({ quizData }) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);

    if (!quizData || quizData.length !== 4) return null; // Fallback in case Gemini failed to generate 4 exactly

    const handleOptionSelect = (index: number) => {
        if (isAnswered) return;
        setSelectedOption(index);
        setIsAnswered(true);

        if (index === quizData[currentQuestion].correctIndex) {
            setScore(prev => prev + 1);
        }
    };

    const nextQuestion = () => {
        if (currentQuestion < quizData.length - 1) {
            setCurrentQuestion(prev => prev + 1);
            setSelectedOption(null);
            setIsAnswered(false);
        } else {
            setQuizFinished(true);
        }
    };

    if (quizFinished) {
        return (
            <div className="bg-[#0A0A0A] border border-gray-800 rounded-2xl p-8 shadow-2xl mt-12 mb-12 relative overflow-hidden text-center">
                <div className={`absolute inset-0 opacity-10 transition-colors ${score >= 3 ? 'bg-[#00C49A]' : score === 2 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-4 relative z-10">Evaluación Completada</h3>
                <div className="flex justify-center items-center gap-4 mb-6 relative z-10">
                    <span className={`text-6xl font-black ${score >= 3 ? 'text-[#00C49A]' : score === 2 ? 'text-amber-500' : 'text-red-500'}`}>{score}</span>
                    <span className="text-3xl font-bold text-gray-600">/ 4</span>
                </div>
                
                <p className="text-gray-400 font-mono text-sm relative z-10 mb-8">
                    {score === 4 && "¡Excelente comprensión de lectura! Eres un maestro en salud metabólica."}
                    {score === 3 && "Buen trabajo. Has captado los conceptos principales del artículo."}
                    {score === 2 && "Aprobado con lo justo. Te recomendamos repasar los conceptos errados."}
                    {score <= 1 && "Parece que hubo confusión. Te invitamos a leer el artículo detenidamente una vez más."}
                </p>

                <button 
                    onClick={() => {
                        setCurrentQuestion(0);
                        setSelectedOption(null);
                        setIsAnswered(false);
                        setScore(0);
                        setQuizFinished(false);
                    }}
                    className="relative z-10 px-6 py-3 rounded-xl border border-gray-700 hover:bg-gray-800 text-white font-bold uppercase tracking-widest text-xs transition-colors"
                >
                    Reintentar Evaluación
                </button>
            </div>
        );
    }

    const question = quizData[currentQuestion];

    return (
        <div className="bg-[#0A0A0A] border border-gray-800 rounded-2xl p-6 shadow-2xl mt-12 mb-12 relative">
            {/* Header del Test */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
                <h3 className="font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Test de Comprensión
                </h3>
                <span className="text-xs font-mono font-bold text-gray-500 bg-gray-900 px-3 py-1 rounded-md border border-gray-800">
                    Pregunta {currentQuestion + 1} de 4
                </span>
            </div>

            {/* Pregunta */}
            <h4 className="text-lg font-medium text-gray-200 mb-6 leading-relaxed">
                {question.question}
            </h4>

            {/* Opciones */}
            <div className="space-y-3 mb-8">
                {question.options.map((opt, index) => {
                    let btnClass = "w-full text-left px-5 py-4 rounded-xl border transition-all text-sm font-medium ";
                    
                    if (!isAnswered) {
                        btnClass += "bg-gray-900 border-gray-800 hover:border-purple-500/50 hover:bg-purple-500/5 text-gray-400 hover:text-white";
                    } else if (index === question.correctIndex) {
                        btnClass += "bg-[#00C49A]/10 border-[#00C49A]/50 text-[#00C49A] shadow-[0_0_15px_rgba(0,196,154,0.1)]"; // Correcta SIEMPRE se ilumina en cian
                    } else if (index === selectedOption) {
                        btnClass += "bg-red-500/10 border-red-500/50 text-red-400"; // Errada (si la tocó el usuario) se ilumina en rojo
                    } else {
                        btnClass += "bg-gray-900/50 border-gray-800/50 text-gray-600 opacity-50"; // Las demás erradas se apagan
                    }

                    return (
                        <button
                            key={index}
                            onClick={() => handleOptionSelect(index)}
                            disabled={isAnswered}
                            className={btnClass}
                        >
                            <span className="font-mono mr-3 opacity-50 uppercase">{String.fromCharCode(65 + index)}.</span>
                            {opt}
                        </button>
                    );
                })}
            </div>

            {isAnswered && (
                <div className={`p-4 rounded-xl border animate-fade-in-up mb-6 text-sm
                    ${selectedOption === question.correctIndex ? 'bg-[#00C49A]/10 border-[#00C49A]/30' : 'bg-red-500/10 border-red-500/30'}`}
                >
                    <p className={`font-bold uppercase tracking-wider text-xs mb-2 
                        ${selectedOption === question.correctIndex ? 'text-[#00C49A]' : 'text-red-400'}`}>
                        {selectedOption === question.correctIndex ? '✔ Respuesta Correcta' : '✖ Respuesta Incorrecta'}
                    </p>
                    <p className="text-gray-300 leading-relaxed font-mono text-xs">{question.rationale}</p>
                </div>
            )}

            {/* Next Button */}
            <div className="flex justify-end">
                <button
                    onClick={nextQuestion}
                    disabled={!isAnswered}
                    className={`px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all flex items-center gap-2
                        ${isAnswered 
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                            : 'bg-gray-900 text-gray-600 cursor-not-allowed border border-gray-800'}`}
                >
                    {currentQuestion === 3 ? 'Finalizar Test' : 'Siguiente Pregunta'} <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </button>
            </div>
        </div>
    );
};

export default ArticleQuiz;
