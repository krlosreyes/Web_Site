import React, { useState } from 'react';

interface Question {
    question: string;
    options: string[];
    correctAnswer: number;
}

interface Article {
    id?: string;
    title: string;
    content: string;
    images: string[];
    references: string[];
    quiz: Question[];
}

interface ArticleEditorProps {
    article?: Article | null;
    onSave: (article: Article) => Promise<void>;
    onCancel: () => void;
}

/**
 * Lee un File del input y devuelve un dataUrl con la imagen comprimida y
 * redimensionada (máx 1200px de ancho, JPEG calidad 0.7).
 */
function resizeAndCompress(
    file: File,
    maxWidth = 1200,
    quality = 0.7
): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
        reader.onload = (event) => {
            const img = new Image();
            img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas 2D no disponible'));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Sube un dataUrl al endpoint server-side, que lo persiste en Firebase
 * Cloud Storage (SPEC-014) y devuelve una URL pública. Reemplaza el flujo
 * anterior que guardaba base64 inline en el doc Firestore.
 */
async function uploadImageToStorage(dataUrl: string, folder = 'posts/uploads'): Promise<string> {
    const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, folder }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || `Upload falló: HTTP ${res.status}`);
    }
    if (!data.url) {
        throw new Error('Respuesta sin URL');
    }
    return data.url as string;
}

const normalizeQuiz = (rawQuiz: any[]): Question[] => {
    if (!Array.isArray(rawQuiz)) return [];
    return rawQuiz.map((q: any) => {
        const question = q.question || q.pregunta || '';
        const options = q.options || q.opciones || ['', '', '', ''];
        
        let correctAnswer = 0;
        if (typeof q.correctAnswer === 'number') {
            correctAnswer = q.correctAnswer;
        } else if (typeof q.correctIndex === 'number') {
            correctAnswer = q.correctIndex;
        } else if (typeof q.respuesta_correcta === 'string') {
            // Buscar el índice de la respuesta correcta en las opciones
            const idx = options.findIndex((o: string) => o === q.respuesta_correcta);
            correctAnswer = idx >= 0 ? idx : 0;
        } else if (typeof q.correctAnswer === 'string') {
            const idx = options.findIndex((o: string) => o === q.correctAnswer);
            correctAnswer = idx >= 0 ? idx : 0;
        }

        return { question, options: Array.isArray(options) ? options : ['', '', '', ''], correctAnswer };
    });
};

const ArticleEditor: React.FC<ArticleEditorProps> = ({ article, onSave, onCancel }) => {
    // 1. ESTADOS (Todos al inicio)
    const [smartText, setSmartText] = useState('');
    const [title, setTitle] = useState(article?.title || '');
    const [content, setContent] = useState(article?.content || '');
    const [images, setImages] = useState<string[]>(article?.images || []);
    const [references, setReferences] = useState<string[]>(article?.references || []);
    const [quiz, setQuiz] = useState<Question[]>(normalizeQuiz(article?.quiz || []));
    
    const [isPublishing, setIsPublishing] = useState(false);
    const [showManual, setShowManual] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Sincronización forzada al cambiar de artículo
    React.useEffect(() => {
        if (article) {
            setTitle(article.title || '');
            setContent(article.content || '');
            setImages(article.images || []);
            setReferences(article.references || []);
            setQuiz(normalizeQuiz(article.quiz || []));
            setShowManual(true);
        }
    }, [article?.id, article?.content]); // Escuchar específicamente cambios en ID y Contenido

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError(null);
        setIsUploading(true);
        try {
            const dataUrl = await resizeAndCompress(file, 1200, 0.7);
            const url = await uploadImageToStorage(dataUrl, 'posts/uploads');
            setImages((prev) => [...prev, url]);
        } catch (err: any) {
            console.error('[ArticleEditor] Upload error:', err);
            setUploadError(err?.message || 'Error desconocido subiendo imagen');
        } finally {
            setIsUploading(false);
            // Resetear el input para permitir re-seleccionar el mismo archivo
            e.target.value = '';
        }
    };

    const handleSmartPaste = () => {
        try {
            const text = smartText;
            if (!text || text.trim().length === 0) {
                alert('Por favor, pega contenido antes de procesar.');
                return;
            }
            
            // Dividir por etiquetas explícitas [TAG] (v5.0)
            const parts = text.split(/\[(TITULO|CONTENIDO|IMAGENES|REFERENCIAS|QUIZ)\]/i);
            
            const getTagContent = (tag: string) => {
                const index = parts.findIndex(p => p?.toUpperCase() === tag);
                return index !== -1 && parts[index + 1] ? parts[index + 1].trim() : '';
            };

            try {
                const rawTitle = getTagContent('TITULO');
                if (rawTitle) setTitle(rawTitle.replace(/^#\s*|\*\*/g, '').trim());
            } catch (e) { console.warn('Error parsing TITULO:', e); }

            try {
                const rawContent = getTagContent('CONTENIDO');
                if (rawContent) setContent(rawContent.trim());
            } catch (e) { console.warn('Error parsing CONTENIDO:', e); }

            try {
                const rawImages = getTagContent('IMAGENES');
                if (rawImages) {
                    const urls = rawImages.match(/https?:\/\/[^\s\n\)]+/g) || [];
                    setImages(urls.filter(u => u.includes('unsplash') || u.includes('firebase')));
                }
            } catch (e) { console.warn('Error parsing IMAGENES:', e); }

            try {
                const rawRefs = getTagContent('REFERENCIAS');
                if (rawRefs) {
                    const lines = rawRefs.split('\n')
                        .map(l => l.trim().replace(/^[-*•\d.\s]+/, ''))
                        .filter(l => l.length > 5);
                    setReferences(lines);
                }
            } catch (e) { console.warn('Error parsing REFERENCIAS:', e); }

            try {
                const rawQuiz = getTagContent('QUIZ');
                if (rawQuiz) {
                    const jsonMatch = rawQuiz.match(/\[\s*\{[\s\S]*\}\s*\]/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (Array.isArray(parsed)) {
                            setQuiz(parsed);
                        }
                    }
                }
            } catch (e) { console.warn('Error parsing QUIZ JSON:', e); }

            setSmartText('');
            setShowManual(true);
        } catch (e: any) {
            console.error('Error en handleSmartPaste:', e);
            alert('Error al procesar el formato v5.0: ' + e.message);
        }
    };

    const handlePublish = async () => {
        if (!title || !content) {
            alert('Falta información para publicar.');
            return;
        }

        setIsPublishing(true);
        try {
            await onSave({
                id: article?.id,
                title,
                content,
                images: images.filter(img => img.trim() !== ''),
                references: references.filter(ref => ref.trim() !== ''),
                quiz
            });
            alert('🚀 ¡Artículo publicado con éxito!');
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="bg-[#0A0F1E] border border-white/5 rounded-3xl p-10 shadow-3xl max-w-4xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Mago IMR</h2>
                <button onClick={onCancel} className="text-gray-600 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">Cerrar</button>
            </div>

            <div className="space-y-8">
                {/* ÁREA DE PEGADO */}
                <div className="p-8 bg-blue-600/5 border border-white/10 rounded-3xl">
                    <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Entrada de Inteligencia Artificial</label>
                    <textarea 
                        className="w-full h-48 bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-gray-300 font-mono mb-4 focus:border-blue-500/50 outline-none"
                        placeholder="Pega aquí el resultado de Gemini..."
                        value={smartText}
                        onChange={(e) => setSmartText(e.target.value)}
                    />
                    <button 
                        onClick={handleSmartPaste}
                        className="w-full py-4 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                    >
                        ✨ Procesar Contenido
                    </button>
                </div>

                {/* ÁREA DE EDICIÓN POST-PROCESADO */}
                {title && (
                    <div className="space-y-6 pt-4 animate-fade-in">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-[#00C49A] uppercase tracking-widest">Título del Artículo</label>
                            <input 
                                value={title} 
                                onChange={e => setTitle(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-xl font-bold focus:border-[#00C49A] outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Cuerpo del Artículo (Editable)</label>
                                <div className="flex gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                                    <button 
                                        onClick={() => {
                                            const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
                                            const start = textarea.selectionStart;
                                            const end = textarea.selectionEnd;
                                            const text = textarea.value;
                                            const selected = text.substring(start, end);
                                            
                                            let newText;
                                            if (selected.startsWith('**') && selected.endsWith('**')) {
                                                newText = text.substring(0, start) + selected.slice(2, -2) + text.substring(end);
                                            } else {
                                                newText = text.substring(0, start) + `**${selected || 'texto'}**` + text.substring(end);
                                            }
                                            setContent(newText);
                                        }}
                                        className="px-3 py-1 hover:bg-white/10 rounded text-xs font-bold text-white" title="Negrita (Quitar/Poner)"
                                    >
                                        B
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
                                            const start = textarea.selectionStart;
                                            const text = textarea.value;
                                            const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                                            const isH2 = text.substring(lineStart, lineStart + 3) === '## ';
                                            
                                            let newText;
                                            if (isH2) {
                                                newText = text.substring(0, lineStart) + text.substring(lineStart + 3);
                                            } else {
                                                newText = text.substring(0, lineStart) + `## ` + text.substring(lineStart);
                                            }
                                            setContent(newText);
                                        }}
                                        className="px-3 py-1 hover:bg-white/10 rounded text-xs font-bold text-white" title="Título H2 (Quitar/Poner)"
                                    >
                                        H2
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
                                            const start = textarea.selectionStart;
                                            const text = textarea.value;
                                            const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                                            const isH3 = text.substring(lineStart, lineStart + 4) === '### ';
                                            
                                            let newText;
                                            if (isH3) {
                                                newText = text.substring(0, lineStart) + text.substring(lineStart + 4);
                                            } else {
                                                newText = text.substring(0, lineStart) + `### ` + text.substring(lineStart);
                                            }
                                            setContent(newText);
                                        }}
                                        className="px-3 py-1 hover:bg-white/10 rounded text-xs font-bold text-white" title="Título H3 (Quitar/Poner)"
                                    >
                                        H3
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
                                            const start = textarea.selectionStart;
                                            const text = textarea.value;
                                            const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                                            const isQuote = text.substring(lineStart, lineStart + 2) === '> ';
                                            
                                            let newText;
                                            if (isQuote) {
                                                newText = text.substring(0, lineStart) + text.substring(lineStart + 2);
                                            } else {
                                                newText = text.substring(0, lineStart) + `> ` + text.substring(lineStart);
                                            }
                                            setContent(newText);
                                        }}
                                        className="px-3 py-1 hover:bg-white/10 rounded text-xs font-bold text-white" title="Cita/Definición (Quitar/Poner)"
                                    >
                                        "
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
                                            const start = textarea.selectionStart;
                                            const text = textarea.value;
                                            const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                                            const isNumList = text.substring(lineStart, lineStart + 3) === '1. ';
                                            
                                            let newText;
                                            if (isNumList) {
                                                newText = text.substring(0, lineStart) + text.substring(lineStart + 3);
                                            } else {
                                                newText = text.substring(0, lineStart) + `1. ` + text.substring(lineStart);
                                            }
                                            setContent(newText);
                                        }}
                                        className="px-3 py-1 hover:bg-white/10 rounded text-xs font-bold text-white" title="Lista Numerada (Quitar/Poner)"
                                    >
                                        1.
                                    </button>
                                </div>
                            </div>
                            <textarea 
                                id="content-editor"
                                value={content} 
                                onChange={e => setContent(e.target.value)}
                                rows={16}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-base font-sans leading-relaxed focus:border-blue-500 outline-none transition-all resize-y min-h-[400px]"
                                placeholder="Modifica el contenido aquí..."
                            />
                        </div>

                        <button
                            disabled={isPublishing}
                            onClick={handlePublish}
                            className={`w-full py-6 rounded-2xl font-black text-lg uppercase tracking-widest transition-all shadow-2xl ${
                                isPublishing 
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-[#00C49A] to-blue-600 text-white hover:scale-[1.02] active:scale-95 shadow-[#00C49A]/20'
                            }`}
                        >
                            {isPublishing ? '⏳ PUBLICANDO...' : '🚀 PUBLICAR AHORA'}
                        </button>

                        <div className="flex justify-center">
                            <button 
                                onClick={() => setShowManual(!showManual)}
                                className="text-[10px] text-gray-600 uppercase font-bold tracking-widest hover:text-gray-400 flex items-center gap-2"
                            >
                                {showManual ? '🔼 Ocultar Extras' : '🛠️ Gestionar Imágenes y Referencias'}
                            </button>
                        </div>
                    </div>
                )}

                {/* HERRAMIENTAS EXTRAS (Imágenes/Ref) */}
                {showManual && (
                    <div className="space-y-8 pt-10 border-t border-white/5 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Imágenes (Subir o URL)</label>
                                        <label
                                            className={`cursor-pointer text-[10px] px-3 py-1 rounded-lg border transition-all ${
                                                isUploading
                                                    ? 'bg-gray-700 text-gray-400 border-gray-700 cursor-wait'
                                                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500 hover:text-white'
                                            }`}
                                        >
                                            <span>{isUploading ? '⏳ Subiendo…' : '📁 Subir Archivo'}</span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                                disabled={isUploading}
                                            />
                                        </label>
                                    </div>

                                    {uploadError && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] text-red-300 font-medium">
                                            ⚠️ {uploadError}
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        {images.map((img, idx) => (
                                            <div key={idx} className="relative group">
                                                {img.startsWith('http') || img.startsWith('data:') ? (
                                                    <img src={img} className="w-full h-24 object-cover rounded-xl border border-white/10" alt="Vista previa" />
                                                ) : (
                                                    <div className="w-full h-24 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-[8px] text-gray-500">URL Inválida</div>
                                                )}
                                                <button 
                                                    onClick={() => setImages(images.filter((_, i) => i !== idx))}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    ×
                                                </button>
                                                <input 
                                                    value={img} 
                                                    onChange={e => {
                                                        const newImgs = [...images];
                                                        newImgs[idx] = e.target.value;
                                                        setImages(newImgs);
                                                    }}
                                                    className="mt-2 w-full bg-black/40 border border-white/5 rounded-lg px-2 py-1 text-[8px] text-gray-500 truncate"
                                                    placeholder="URL o Base64"
                                                />
                                            </div>
                                        ))}
                                        <button 
                                            onClick={() => setImages([...images, ''])}
                                            className="w-full h-24 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-gray-600 hover:border-blue-500/50 hover:text-blue-500 transition-all"
                                        >
                                            <span className="text-2xl">+</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Referencias Científicas</label>
                                        <button onClick={() => setReferences([...references, ''])} className="text-[10px] bg-purple-500/10 text-purple-400 px-3 py-1 rounded-lg border border-purple-500/20">+</button>
                                    </div>
                                    {references.map((ref, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input 
                                                value={ref} 
                                                onChange={e => {
                                                    const newRefs = [...references];
                                                    newRefs[idx] = e.target.value;
                                                    setReferences(newRefs);
                                                }}
                                                className="flex-1 bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-xs text-gray-400"
                                                placeholder="Cita o DOI"
                                            />
                                            <button onClick={() => setReferences(references.filter((_, i) => i !== idx))} className="text-red-500/50 hover:text-red-500 text-xs px-2">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* EDITOR DE QUIZ */}
                            <div className="pt-8 border-t border-white/5 space-y-6">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                                        <label className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Quiz de Evaluación ({quiz.length})</label>
                                    </div>
                                    <button 
                                        onClick={() => setQuiz([...quiz, { question: '', options: ['', '', '', ''], correctAnswer: 0 }])}
                                        className="text-[10px] bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-xl border border-yellow-500/20 hover:bg-yellow-500 hover:text-black transition-all font-bold uppercase"
                                    >
                                        + Añadir Pregunta
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                    {quiz.map((q, qIdx) => (
                                        <div key={qIdx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative group hover:border-yellow-500/30 transition-all">
                                            <button 
                                                onClick={() => setQuiz(quiz.filter((_, i) => i !== qIdx))}
                                                className="absolute top-4 right-4 text-gray-600 hover:text-red-500 transition-colors"
                                            >
                                                <span className="text-xl">×</span>
                                            </button>

                                            <div className="space-y-4">
                                                <input 
                                                    value={q.question}
                                                    onChange={e => {
                                                        const newQuiz = [...quiz];
                                                        newQuiz[qIdx].question = e.target.value;
                                                        setQuiz(newQuiz);
                                                    }}
                                                    placeholder="Escribe la pregunta aquí..."
                                                    className="w-full bg-transparent border-b border-white/10 pb-2 text-white font-bold placeholder:text-gray-700 outline-none focus:border-yellow-500/50 transition-all"
                                                />

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {(q.options || ['', '', '', '']).map((opt, oIdx) => (
                                                        <div key={oIdx} className="flex items-center gap-3 group/opt">
                                                            <input 
                                                                type="radio" 
                                                                name={`correct-${qIdx}`}
                                                                checked={q.correctAnswer === oIdx}
                                                                onChange={() => {
                                                                    const newQuiz = [...quiz];
                                                                    newQuiz[qIdx].correctAnswer = oIdx;
                                                                    setQuiz(newQuiz);
                                                                }}
                                                                className="w-4 h-4 accent-[#00C49A] cursor-pointer"
                                                            />
                                                            <input 
                                                                value={opt}
                                                                onChange={e => {
                                                                    const newQuiz = [...quiz];
                                                                    newQuiz[qIdx].options[oIdx] = e.target.value;
                                                                    setQuiz(newQuiz);
                                                                }}
                                                                placeholder={`Opción ${oIdx + 1}`}
                                                                className={`flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs transition-all ${q.correctAnswer === oIdx ? 'text-[#00C49A] border-[#00C49A]/30 bg-[#00C49A]/5' : 'text-gray-400'}`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                )}
            </div>
        </div>
    );
};

export default ArticleEditor;
