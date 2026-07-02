/**
 * ElenaSupportForm — SPEC-112
 *
 * Formulario híbrido de soporte de ElenaApp:
 *   - Si hay sesión Firebase Auth: pre-fill de `name` (editable) y `email`
 *     (disabled + Bearer token en el POST → source='authenticated').
 *   - Sin sesión: campos abiertos + honeypot `_website` + rate limit server-side.
 *
 * Submit: POST /api/support/elena con Content-Type: application/json
 * (regla Astro 6 CSRF — CLAUDE.md #4).
 */

import React, { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const CATEGORIES: Array<{ value: string; label: string }> = [
    { value: 'tecnico', label: 'Problema técnico (la app no abre, se cierra, etc.)' },
    { value: 'cuenta', label: 'Cuenta y acceso (login, contraseña, datos)' },
    { value: 'contenido', label: 'Contenido o información' },
    { value: 'feedback', label: 'Sugerencia o feedback' },
    { value: 'otro', label: 'Otro' },
];

const MIN_MSG = 20;
const MAX_MSG = 2000;

export default function ElenaSupportForm() {
    const [user, setUser] = useState<User | null>(null);
    const [ready, setReady] = useState(false);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [category, setCategory] = useState('tecnico');
    const [message, setMessage] = useState('');
    const [honeypot, setHoneypot] = useState(''); // se queda vacío en usuarios reales

    const [state, setState] = useState<FormState>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [ticketId, setTicketId] = useState<string | null>(null);

    // Detectar sesión Firebase Auth y pre-fill.
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (u) {
                if (u.displayName && !name) setName(u.displayName);
                if (u.email) setEmail(u.email);
            }
            setReady(true);
        });
        return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg(null);

        // Validación cliente (el server la vuelve a hacer — defense in depth).
        if (name.trim().length === 0) {
            setErrorMsg('Escribe tu nombre.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setErrorMsg('Revisa el formato del email.');
            return;
        }
        if (message.trim().length < MIN_MSG) {
            setErrorMsg(`El mensaje debe tener al menos ${MIN_MSG} caracteres.`);
            return;
        }
        if (message.trim().length > MAX_MSG) {
            setErrorMsg(`El mensaje no puede pasar de ${MAX_MSG} caracteres.`);
            return;
        }

        setState('submitting');

        try {
            const headers: Record<string, string> = {
                // Regla Astro 6 CSRF — CLAUDE.md #4.
                'Content-Type': 'application/json',
            };
            if (user) {
                const idToken = await user.getIdToken();
                headers['Authorization'] = 'Bearer ' + idToken;
            }

            const res = await fetch('/api/support/elena', {
                method: 'POST',
                credentials: 'include',
                headers,
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim().toLowerCase(),
                    category,
                    message: message.trim(),
                    _website: honeypot, // honeypot (vacío en usuarios reales)
                }),
            });

            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as {
                    error?: string;
                };
                setErrorMsg(
                    data.error ??
                        'No pudimos enviar tu ticket. Intenta de nuevo en un momento.'
                );
                setState('error');
                return;
            }

            const data = (await res.json()) as { ticketId?: string };
            setTicketId(data.ticketId ?? null);
            setState('success');
            setMessage('');
        } catch (err) {
            console.error('[ElenaSupportForm] submit failed:', err);
            setErrorMsg(
                'Hubo un error de red. Verifica tu conexión e intenta de nuevo.'
            );
            setState('error');
        }
    }

    // Success screen — reemplaza el form entero.
    if (state === 'success') {
        return (
            <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-6 sm:p-8">
                <div className="flex items-start gap-4">
                    <div className="text-3xl leading-none shrink-0">✓</div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-heading text-xl font-black text-text-primary mb-2">
                            Recibimos tu mensaje
                        </h3>
                        <p className="text-text-secondary text-sm leading-relaxed mb-3">
                            Te responderemos al email que dejaste (revisa también
                            spam por las dudas). Solemos contestar en 24-48 horas
                            hábiles.
                        </p>
                        {ticketId && (
                            <p className="text-text-muted text-xs font-mono">
                                Referencia: {ticketId}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setState('idle');
                                setTicketId(null);
                                setMessage('');
                            }}
                            className="mt-4 text-sm text-accent hover:text-accent-strong font-medium"
                        >
                            Enviar otro mensaje →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 space-y-5"
        >
            {/* Honeypot — invisible para humanos, tentador para bots. */}
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    left: '-9999px',
                    width: '1px',
                    height: '1px',
                    overflow: 'hidden',
                }}
            >
                <label>
                    No llenes este campo (anti-spam):
                    <input
                        type="text"
                        name="_website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                    />
                </label>
            </div>

            {ready && user && (
                <div className="text-xs text-accent bg-accent/[0.08] border border-accent/20 rounded-lg px-3 py-2">
                    ✓ Estás usando tu cuenta ({user.email}). Vamos a responderte
                    a este email.
                </div>
            )}

            <div>
                <label
                    htmlFor="support-name"
                    className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2"
                >
                    Nombre
                </label>
                <input
                    id="support-name"
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-4 py-3 text-text-primary placeholder-text-muted/60 focus:outline-none focus:border-accent/60 transition-colors"
                    placeholder="Cómo te llamamos"
                    disabled={state === 'submitting'}
                />
            </div>

            <div>
                <label
                    htmlFor="support-email"
                    className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2"
                >
                    Email
                </label>
                <input
                    id="support-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-4 py-3 text-text-primary placeholder-text-muted/60 focus:outline-none focus:border-accent/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="tu@email.com"
                    disabled={state === 'submitting' || !!user}
                />
                {!user && ready && (
                    <p className="mt-2 text-xs text-text-muted">
                        Si tienes cuenta, inicia sesión antes para que tu ticket
                        quede vinculado.
                    </p>
                )}
            </div>

            <div>
                <label
                    htmlFor="support-category"
                    className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2"
                >
                    Tipo de consulta
                </label>
                <select
                    id="support-category"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-4 py-3 text-text-primary focus:outline-none focus:border-accent/60 transition-colors"
                    disabled={state === 'submitting'}
                >
                    {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value} className="bg-[#0c1422]">
                            {c.label}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label
                    htmlFor="support-message"
                    className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2"
                >
                    ¿Qué está pasando?
                </label>
                <textarea
                    id="support-message"
                    required
                    minLength={MIN_MSG}
                    maxLength={MAX_MSG}
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-4 py-3 text-text-primary placeholder-text-muted/60 focus:outline-none focus:border-accent/60 transition-colors resize-y"
                    placeholder="Cuéntanos con el mayor detalle posible: qué intentabas hacer, qué esperabas ver, qué pasó. Si hay un mensaje de error, cópialo tal cual."
                    disabled={state === 'submitting'}
                />
                <div className="mt-1 flex justify-between text-xs text-text-muted">
                    <span>
                        Mínimo {MIN_MSG} caracteres. Cuanto más contexto, mejor.
                    </span>
                    <span>
                        {message.length}/{MAX_MSG}
                    </span>
                </div>
            </div>

            {errorMsg && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
                    {errorMsg}
                </div>
            )}

            <button
                type="submit"
                disabled={state === 'submitting'}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-accent hover:bg-accent-strong text-bg-base font-bold text-sm px-6 py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {state === 'submitting' ? (
                    <>
                        <span className="animate-pulse">Enviando…</span>
                    </>
                ) : (
                    <>Enviar ticket →</>
                )}
            </button>

            <p className="text-xs text-text-muted leading-relaxed">
                Al enviar aceptas nuestra{' '}
                <a
                    href="/privacidad"
                    className="text-accent hover:text-accent-strong underline underline-offset-2"
                >
                    política de privacidad
                </a>
                . Usamos tu mensaje solo para responderte y resolver tu caso.
            </p>
        </form>
    );
}
