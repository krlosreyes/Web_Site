import React, { useState, useEffect } from 'react';
import { validatePostSchema } from '../../lib/validators/postValidator'; // <-- NUEVO PATH
import { sanitizeJsonString } from '../../lib/utils/jsonSanitizer';
const ManualPostInjection = () => {
    const [jsonInput, setJsonInput] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [validationMessage, setValidationMessage] = useState('');
    const [sanitizationAlerts, setSanitizationAlerts] = useState<string[]>([]);
    const [isInjecting, setIsInjecting] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [injectionPhase, setInjectionPhase] = useState<string>('');
    const [qaLogs, setQaLogs] = useState<{ path: string, model: string, timeMs: number }[]>([]);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Manual Dispatch Prompts
    const [extractedPrompts, setExtractedPrompts] = useState<string[]>([]);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Debounce validation
    useEffect(() => {
        const timer = setTimeout(() => {
            setSuccessMessage('');
            setError(null);
            setSanitizationAlerts([]); // Reset sanitizer alerts

            if (!jsonInput.trim()) {
                setIsValid(false);
                setValidationMessage('');
                return;
            }

            // 1. Capa de Auto-Sanitización
            const { sanitizedJson, wasModified, modifications } = sanitizeJsonString(jsonInput);

            if (wasModified) {
                setSanitizationAlerts(modifications);
            }

            // 2. Capa de Validación sobre el JSON sanitizado
            let { isValid: newIsValid, message: newMessage } = validatePostSchema(sanitizedJson);

            // 3. Taxonomía Estricta: Validación extra de Categoría
            if (newIsValid) {
                try {
                    const parsed = JSON.parse(sanitizedJson);
                    const cat = parsed.metadata?.category;
                    const validCategories = ["Ayuno", "Nutricion", "Ejercicio"];

                    if (typeof cat !== 'string') {
                        newIsValid = false;
                        newMessage = `⛔ ERROR DE TAXONOMÍA (AMBIGÜEDAD): La categoría no puede ser un arreglo ni múltiple. Debe ser una única palabra oficial.`;
                    } else if (!validCategories.includes(cat)) {
                        newIsValid = false;
                        newMessage = `⛔ ERROR DE CATEGORÍA: "${cat}" no permitida.\nDebe ser EXCLUSIVAMENTE UNA (1) de: ${validCategories.join(', ')}`;
                    } else if (!parsed.metadata?.youtubeUrl) {
                        newIsValid = false;
                        newMessage = `⛔ ERROR DE ORIGEN: youtubeUrl es OBLIGATORIO para trazabilidad.`;
                    } else {
                        // Extracción de Image Prompts para Dispatch Manual
                        if (parsed.image_prompts && Array.isArray(parsed.image_prompts)) {
                            setExtractedPrompts(parsed.image_prompts);
                        } else {
                            setExtractedPrompts([]);
                        }
                    }
                } catch (e) { /* ignored, validation handles syntax */ }
            } else {
                setExtractedPrompts([]); // Limpiar prompts si el JSON se rompe
            }

            setIsValid(newIsValid);
            setValidationMessage(newMessage || '');
        }, 500);

        return () => clearTimeout(timer);
    }, [jsonInput]);

    // ==========================================
    // MANUAL DISPATCH: COPY PROMPTS
    // ==========================================
    const handleCopyPrompt = (promptDesc: string, idx: number) => {
        navigator.clipboard.writeText(promptDesc);
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleInject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        setIsInjecting(true);
        setInjectionPhase('Iniciando procesamiento...');
        setError(null);
        setSuccessMessage('');
        setQaLogs([]);

        try {
            // Asegurarse de usar la versión sanitarizada si hace click rápido
            const { sanitizedJson } = sanitizeJsonString(jsonInput);
            let parsedJson = JSON.parse(sanitizedJson);

            // ==========================================
            // NUEVO FLUJO: AUTOMATIZACIÓN DE IMÁGENES
            // ==========================================
            if (parsedJson.image_prompts && Array.isArray(parsedJson.image_prompts) && parsedJson.image_prompts.length > 0) {
                setInjectionPhase('Generando y subiendo imágenes (esto puede tardar 60s)...');

                const slug = parsedJson.metadata?.slug || 'draft';
                const seoTitle = parsedJson.metadata?.seoTitle || 'Untitled';
                const category = parsedJson.metadata?.category || 'Sin Clasificar';

                const imageRes = await fetch('/api/auto-generate-images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_prompts: parsedJson.image_prompts,
                        slug: slug,
                        title: seoTitle,
                        category: category
                    })
                });

                const imageData = await imageRes.json();

                let firebaseUrls: string[] = [];
                if (!imageRes.ok || !imageData.success) {
                    console.warn('Falló la generación automática de imágenes. Activando placeholders de emergencia.', imageData.error);
                } else {
                    if (imageData.telemetry) {
                        setQaLogs(imageData.telemetry);
                    }
                    firebaseUrls = imageData.urls || [];
                }

                // Asegurar que siempre haya la misma cantidad de URLs que prompts, llenando los faltantes con el Placeholder de Emergencia
                const expectedCount = parsedJson.image_prompts.length;
                while (firebaseUrls.length < expectedCount) {
                    firebaseUrls.push('https://placehold.co/600x400?text=Metamorfosis+Real');
                }

                // Reemplazar los placeholders estáticos en el body HTML
                if (parsedJson.content?.body && firebaseUrls.length > 0) {
                    let bodyStr = parsedJson.content.body;
                    let urlIndex = 0;

                    // Reemplaza cada aparición de https://placehold.co/... con la siguiente URL generada
                    bodyStr = bodyStr.replace(/https:\/\/placehold\.co\/[^\s'"]+/g, (match: string) => {
                        const nextUrl = firebaseUrls[urlIndex];
                        if (nextUrl) {
                            urlIndex++;
                            return nextUrl;
                        }
                        return match; // Si no hay suficientes URLs, conserva el placeholder
                    });

                    // Anti-fallos: Garantizar atomicidad cambiando comillas dobles residuales a simples.
                    bodyStr = bodyStr.replace(/="([^"]*)"/g, "='$1'");

                    parsedJson.content.body = bodyStr;

                    // Lógica de Estatus Automático
                    if (firebaseUrls.length === parsedJson.image_prompts.length) {
                        parsedJson.metadata.status = 'published';
                    } else {
                        parsedJson.metadata.status = 'pending_verification';
                    }

                    // Actualizar UI con el super JSON inyectado final
                    setJsonInput(JSON.stringify(parsedJson, null, 2));
                }
            } else {
                // Si no hay prompts visuales, definimos como publicado directo
                parsedJson.metadata.status = 'published';
            }

            setInjectionPhase('Guardando artículo en Base de Datos...');

            const response = await fetch('/api/inject-manual', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(parsedJson)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSuccessMessage('¡Inyección Directa Exitosa! Módulo subido a Firestore.');
                setJsonInput(''); // Limpiar tras éxito
                setSanitizationAlerts([]);
            } else {
                throw new Error(data.error || 'Fallo desconocido en la inyección.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al inyectar JSON');
        } finally {
            setIsInjecting(false);
            setInjectionPhase('');
        }
    };

    const handleRegenerateImages = async () => {
        if (!isValid) return;

        setIsRegenerating(true);
        setInjectionPhase('🔄 Extrayendo Prompts Visules del documento en memoria...');
        setError(null);
        setSuccessMessage('');
        setQaLogs([]);

        try {
            const { sanitizedJson } = sanitizeJsonString(jsonInput);
            let parsedJson = JSON.parse(sanitizedJson);

            if (!parsedJson.image_prompts || !Array.isArray(parsedJson.image_prompts) || parsedJson.image_prompts.length === 0) {
                throw new Error('No hay prompts de imagen en este JSON para regenerar.');
            }

            const slug = parsedJson.metadata?.slug || 'draft';
            const seoTitle = parsedJson.metadata?.seoTitle || 'Untitled';
            const category = parsedJson.metadata?.category || 'Sin Clasificar';

            setInjectionPhase('🔄 Llamando a Gemini imagen-3 para reescribir visuales...');

            const imageRes = await fetch('/api/auto-generate-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_prompts: parsedJson.image_prompts,
                    slug: slug,
                    title: seoTitle,
                    category: category
                })
            });

            const imageData = await imageRes.json();

            let firebaseUrls: string[] = [];
            if (!imageRes.ok || !imageData.success) {
                console.warn('Falló la regeneración de imágenes en Gemini.', imageData.error);
            } else {
                if (imageData.telemetry) {
                    setQaLogs(imageData.telemetry);
                }
                firebaseUrls = imageData.urls || [];
            }

            const expectedCount = parsedJson.image_prompts.length;
            while (firebaseUrls.length < expectedCount) {
                firebaseUrls.push('https://placehold.co/600x400?text=Metamorfosis+Real');
            }

            setInjectionPhase('🔄 Sustituyendo placeholders e Inyectando Atomización a Firestore...');

            if (parsedJson.content?.body && firebaseUrls.length > 0) {
                let bodyStr = parsedJson.content.body;
                let urlIndex = 0;

                bodyStr = bodyStr.replace(/https:\/\/placehold\.co\/[^\s'"]+/g, (match: string) => {
                    const nextUrl = firebaseUrls[urlIndex];
                    if (nextUrl) {
                        urlIndex++;
                        return nextUrl;
                    }
                    return match;
                });

                // Anti-fallos: Garantizar atomicidad cambiando comillas dobles residuales a simples.
                bodyStr = bodyStr.replace(/="([^"]*)"/g, "='$1'");

                parsedJson.content.body = bodyStr;

                // POST de Inyección Atómica: ¡SOLO el TEXTO HTML MODIFICADO!
                const updateRes = await fetch('/api/update-post-body', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        slug,
                        body: bodyStr
                    })
                });

                const updateData = await updateRes.json();

                if (!updateRes.ok || !updateData.success) {
                    throw new Error(updateData.error || 'Falló la persistencia atómica en Firestore.');
                }

                setJsonInput(JSON.stringify(parsedJson, null, 2));
                setSuccessMessage('¡Visuales actualizados correctamente en el Ecosistema!');
            } else {
                throw new Error('No se encontró campo content.body para incrustar las imágenes.');
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al regenerar imágenes atómicas');
        } finally {
            setIsRegenerating(false);
            setInjectionPhase('');
        }
    };

    const handleClear = () => {
        setJsonInput('');
        setIsValid(false);
        setValidationMessage('');
        setSuccessMessage('');
        setError(null);
        setExtractedPrompts([]);
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col h-full relative overflow-hidden">
            {/* Terminal Top Bar */}
            <div className="flex items-center gap-2 mb-6 border-b border-gray-800 pb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-2 font-mono text-xs text-gray-500 uppercase tracking-widest">Sys.Injector.exe</span>
                <span className="ml-auto px-2 py-1 rounded bg-red-900/30 text-red-500 border border-red-500/50 text-[10px] uppercase font-bold tracking-widest">
                    EMERGENCY BYPASS
                </span>
            </div>

            <form onSubmit={handleInject} className="flex flex-col flex-1 gap-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                        <div className="flex gap-4 items-center">
                            <span>Payload JSON (5-Level Schema)</span>
                            <button
                                type="button"
                                onClick={handleClear}
                                title="Limpiar JSON"
                                className="p-1 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                            >
                                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>
                            </button>
                        </div>
                        <span className={isValid ? 'text-[#00C49A]' : 'hidden'}>
                            {isValid && 'Esquema 5-Niveles Correcto ✅'}
                        </span>
                    </label>
                    <textarea
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        placeholder="{\n  &quot;metadata&quot;: { ... },\n  &quot;content&quot;: { ... },\n  &quot;app_integration&quot;: { ... },\n  &quot;quiz&quot;: [ ... ],\n  &quot;references&quot;: [ ... ]\n}"
                        className="w-full h-96 bg-black border border-gray-700 rounded-lg p-4 text-[#00C49A] font-mono text-sm focus:outline-none focus:border-red-500 transition-colors resize-none shadow-inner"
                        spellCheck="false"
                        disabled={isInjecting}
                    />
                </div>

                {sanitizationAlerts.length > 0 && (
                    <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-3 flex gap-3 shadow-[0_0_10px_rgba(59,130,246,0.2)] animate-fade-in-up mt-2">
                        <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <div className="flex-1">
                            <h4 className="text-blue-400 font-bold uppercase tracking-wider text-[10px] mb-1">Auto-Sanitizer Activo</h4>
                            <ul className="text-blue-200 font-mono text-xs list-disc pl-4">
                                {sanitizationAlerts.map((alert, i) => <li key={i}>{alert}</li>)}
                            </ul>
                        </div>
                    </div>
                )}

                {!isValid && validationMessage && (
                    <div className="bg-red-950/50 border border-red-800 rounded-lg p-4 flex gap-3 shadow-[0_0_10px_rgba(153,27,27,0.3)] animate-fade-in-up mt-2">
                        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                        <div className="flex-1">
                            <h4 className="text-red-400 font-bold uppercase tracking-wider text-xs mb-1">Error de Validación JSON</h4>
                            <pre className="text-red-200 font-mono text-xs whitespace-pre-wrap break-words">
                                {validationMessage}
                            </pre>
                        </div>
                    </div>
                )}

                {/* CAJA DE MONITOREO QA EN TIEMPO REAL */}
                {(isInjecting || isRegenerating || qaLogs.length > 0) && (
                    <div className="bg-black/80 border border-gray-700/80 rounded-lg p-4 font-mono text-[10px] sm:text-xs">
                        <div className="flex items-center gap-2 mb-2 text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">
                            <span className="relative flex h-2 w-2">
                                {(isInjecting || isRegenerating) && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${(isInjecting || isRegenerating) ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
                            </span>
                            System Telemetry {isRegenerating && "(Atomic Sync)"}
                        </div>
                        {(isInjecting || isRegenerating) && (
                            <div className={`${isRegenerating ? 'text-indigo-400' : 'text-emerald-400'} mb-2 animate-pulse`}>
                                Status: {injectionPhase}
                            </div>
                        )}
                        {qaLogs.length > 0 && (
                            <div className="mt-3 space-y-1">
                                {qaLogs.map((log, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-emerald-300/80">
                                        <span className="text-purple-400">[{log.model}]</span>
                                        <span className="text-gray-400 truncate">{log.path}</span>
                                        <span className="sm:ml-auto text-yellow-400/80">{log.timeMs}ms</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* INTERFAZ DEL HUB DE DESPACHO MANUAL */}
                {isValid && extractedPrompts.length > 0 && (
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 mt-2 animate-fade-in">
                        <h4 className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-xs mb-3">
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            Prompts Visuales Asistidos
                        </h4>
                        <div className="space-y-2">
                            {extractedPrompts.map((prompt, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row gap-2 bg-gray-900 border border-gray-800 rounded-lg p-3 group hover:border-purple-500/30 transition-colors">
                                    <p className="flex-1 text-gray-300 font-mono text-xs line-clamp-2" title={prompt}>
                                        {prompt}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyPrompt(prompt, idx)}
                                        className={`shrink-0 px-3 py-1.5 text-xs font-bold tracking-widest uppercase rounded flex items-center gap-1.5 justify-center transition-all ${copiedIndex === idx
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                            : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700 hover:border-purple-500/50 hover:bg-purple-900/30'
                                            }`}
                                    >
                                        {copiedIndex === idx ? (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                Copiado
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                                Copiar
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-auto pt-4 flex gap-4">
                    <button
                        type="button"
                        onClick={handleRegenerateImages}
                        disabled={!isValid || isInjecting || isRegenerating}
                        className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                    >
                        {isRegenerating ? 'Sincronizando...' : '🔄 Regenerar Imágenes'}
                    </button>
                    <button
                        type="submit"
                        disabled={!isValid || isInjecting || isRegenerating}
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(5,150,105,0.4)]"
                    >
                        {isInjecting ? injectionPhase : 'Crear Artículo'}
                    </button>
                </div>
            </form>

            {/* Notificaciones */}

            {successMessage && (
                <div className="mt-6 bg-emerald-900/20 border border-emerald-500/50 rounded-xl p-4 flex items-center gap-3 animate-fade-in-up">
                    <svg className="w-6 h-6 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-mono text-emerald-400 text-sm">{successMessage}</span>
                </div>
            )}

            {error && (
                <div className="mt-6 bg-red-900/20 border border-red-500/50 rounded-xl p-4 flex items-center gap-3 animate-fade-in-up">
                    <svg className="w-6 h-6 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-mono text-red-400 text-sm font-bold uppercase">{error}</span>
                </div>
            )}
        </div>
    );
};

export default ManualPostInjection;
