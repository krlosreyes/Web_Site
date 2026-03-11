import React, { useState } from 'react';
import { METABOLIC_ANALYST_SOP } from '../../lib/constants/prompts';

const PromptGenerator = () => {
    const [url, setUrl] = useState('');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [copied, setCopied] = useState(false);

    const handleGenerate = (e: React.FormEvent) => {
        e.preventDefault();

        if (!url.trim() || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
            alert('Por favor, ingresa una URL válida de YouTube.');
            return;
        }

        const promptTemplate = METABOLIC_ANALYST_SOP(url);

        setGeneratedPrompt(promptTemplate);
        setCopied(false);
    };

    const handleCopy = () => {
        if (!generatedPrompt) return;
        navigator.clipboard.writeText(generatedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleClear = () => {
        setUrl('');
        setGeneratedPrompt('');
        setCopied(false);
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col h-full relative overflow-hidden">
            {/* Terminal Top Bar */}
            <div className="flex items-center gap-2 mb-6 border-b border-gray-800 pb-4">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="ml-2 font-mono text-xs text-gray-500 uppercase tracking-widest">Sys.Prompt.Gen</span>
                <span className="ml-auto px-2 py-1 rounded bg-blue-900/30 text-blue-400 border border-blue-500/50 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                    METABOLIC LAB
                </span>
            </div>

            <form onSubmit={handleGenerate} className="flex flex-col gap-4 mb-6">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                        <span>Fuente de Extracción (YouTube URL)</span>
                        <button
                            type="button"
                            onClick={handleClear}
                            title="Limpiar campos"
                            className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>
                        </button>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Ej: https://youtu.be/..."
                            required
                            className="flex-1 bg-black border border-gray-700 rounded-lg p-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                        />
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-sm px-6 py-3 rounded-lg transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)] whitespace-nowrap"
                        >
                            Generar Prompt
                        </button>
                    </div>
                </div>
            </form>

            <div className="flex-1 flex flex-col min-h-0 relative group">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        SOP Resultante (Solo Lectura)
                    </label>
                    {generatedPrompt && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={`text-xs font-bold tracking-widest uppercase px-3 py-1 rounded transition-colors ${copied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                        >
                            {copied ? '¡Copiado!' : 'Copiar SOP'}
                        </button>
                    )}
                </div>
                <textarea
                    value={generatedPrompt}
                    readOnly
                    placeholder="El Master Prompt optimizado aparecerá aquí..."
                    className="w-full h-full min-h-[300px] bg-black border border-gray-700 rounded-lg p-4 text-blue-400 font-mono text-sm focus:outline-none transition-colors resize-none shadow-inner"
                    spellCheck="false"
                />
            </div>
        </div>
    );
};

export default PromptGenerator;
