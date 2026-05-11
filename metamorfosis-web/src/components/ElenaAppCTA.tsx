import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

/**
 * ElenaApp CTA — botón pill en navbar + modal de waitlist (SPEC-048).
 *
 * Anónimo: CTA primario lleva a /login con tracking `?fromWaitlist=1`.
 * Logueado: muestra "Ya estás en la lista" (waitlist.status='pending' lo
 * setea SPEC-006 onboard al registrar al user).
 *
 * Modal con escape routes: ESC, click-outside, botón ✕.
 * Body scroll bloqueado mientras está abierto.
 */

const ElenaAppCTA: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsub();
    }, []);

    // Bloquear scroll del body mientras el modal está abierto
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (open) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = prev;
            };
        }
    }, [open]);

    // Cerrar con Escape
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const closeOnBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) setOpen(false);
    };

    return (
        <>
            {/* Botón pill del navbar — reemplaza al <a href="https://elena-app..."> */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
                className="relative inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-500 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
            >
                {/* Ícono móvil — placeholder hasta que haya logo dedicado */}
                <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <rect x="6" y="2" width="12" height="20" rx="2.5" />
                    <line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                <span>ElenaApp</span>
                <span className="ml-0.5 px-1.5 py-0.5 rounded bg-yellow-400/90 text-black text-[8px] font-black tracking-tighter">
                    EARLY
                </span>
            </button>

            {/* SPEC-049: Modal renderizado vía Portal en document.body para
                escapar de cualquier ancestor con containing block (navbar fixed,
                backdrop-filter, transform). Garantiza que `position: fixed`
                sea relativo al viewport real. */}
            {open && typeof document !== 'undefined' && createPortal(
                <div
                    onClick={closeOnBackdrop}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="elenaapp-modal-title"
                    className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
                >
                    <div
                        ref={dialogRef}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-h-screen sm:max-h-[90vh] sm:max-w-lg sm:rounded-3xl bg-gradient-to-br from-[#0c1422] via-[#0a1020] to-[#020617] border border-blue-500/20 shadow-2xl overflow-y-auto animate-in slide-in-from-bottom-8 duration-300"
                    >
                        {/* Cerrar */}
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Cerrar"
                            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 flex items-center justify-center text-white text-lg transition-all"
                        >
                            ✕
                        </button>

                        {/* Hero con mockup */}
                        <div className="relative pt-12 pb-6 px-6 sm:px-10 text-center">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[200px] bg-blue-600/15 blur-[100px] -z-10 pointer-events-none"></div>
                            <img
                                src="/elena-mockup.webp"
                                alt="ElenaApp"
                                width={160}
                                height={160}
                                loading="lazy"
                                decoding="async"
                                className="w-32 sm:w-40 mx-auto mb-6 drop-shadow-[0_0_30px_rgba(59,130,246,0.4)]"
                            />
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                                🚀 Acceso anticipado
                            </div>
                            <h2
                                id="elenaapp-modal-title"
                                className="text-2xl sm:text-3xl font-black text-white italic uppercase tracking-tighter leading-tight mb-3 break-words"
                            >
                                Sé de los <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#00C49A]">primeros 1000</span>
                            </h2>
                            <p className="text-gray-300 text-sm sm:text-base font-medium leading-relaxed max-w-md mx-auto">
                                ElenaApp está casi lista. Reserva tu lugar y obtén beneficios exclusivos que no se repetirán.
                            </p>
                        </div>

                        {/* Beneficios */}
                        <div className="px-6 sm:px-10 pb-2">
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3 p-4 rounded-2xl bg-[#00C49A]/8 border border-[#00C49A]/30">
                                    <span className="text-2xl shrink-0 leading-none">🎁</span>
                                    <div className="min-w-0">
                                        <p className="text-[#00C49A] font-black text-sm uppercase tracking-widest mb-1">
                                            Precio Fundador
                                        </p>
                                        <p className="text-gray-300 text-xs leading-relaxed">
                                            Descuento permanente en la suscripción anual. Solo para los primeros 1000.
                                        </p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/8 border border-blue-500/20">
                                    <span className="text-2xl shrink-0 leading-none">🔒</span>
                                    <div className="min-w-0">
                                        <p className="text-blue-300 font-black text-sm uppercase tracking-widest mb-1">
                                            3 Beneficios Sorpresa
                                        </p>
                                        <p className="text-gray-400 text-xs leading-relaxed">
                                            Se revelan el día del lanzamiento. Vas a querer estar adentro.
                                        </p>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* CTA según auth state */}
                        <div className="px-6 sm:px-10 py-6 sm:py-8 border-t border-white/5 mt-4">
                            {user ? (
                                <>
                                    <div className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-[#00C49A]/15 border border-[#00C49A]/40 text-[#00C49A] font-black text-sm uppercase tracking-widest text-center mb-3">
                                        <span className="text-lg">✓</span>
                                        Ya estás en la lista
                                    </div>
                                    <p className="text-center text-xs text-gray-500 font-mono uppercase tracking-widest mb-4">
                                        Te avisamos por email cuando lance
                                    </p>
                                    <a
                                        href="https://elena-app.vercel.app/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-center text-xs text-blue-400 hover:text-blue-300 underline font-bold uppercase tracking-widest"
                                    >
                                        Ver preview de la app →
                                    </a>
                                </>
                            ) : (
                                <>
                                    <a
                                        href="/login?fromWaitlist=1"
                                        className="block text-center w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-[#00C49A] to-teal-600 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-[#00C49A]/20 hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        Reserva tu lugar — gratis →
                                    </a>
                                    <p className="text-center text-[10px] text-gray-500 font-mono uppercase tracking-widest mt-4">
                                        Sin tarjeta · 2 minutos · Sin spam
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default ElenaAppCTA;
