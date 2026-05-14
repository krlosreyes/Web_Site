import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { track } from '../lib/analytics/track';

/**
 * ElenaApp CTA — botón pill en navbar + modal de waitlist (SPEC-048).
 *
 * Anónimo: CTA primario lleva a /login con tracking `?fromWaitlist=1`.
 * Logueado: muestra "Ya estás en la lista" (waitlist.status='pending' lo
 * setea SPEC-006 onboard al registrar al user).
 *
 * Modal con escape routes: ESC, click-outside, botón ✕.
 * Body scroll bloqueado mientras está abierto.
 *
 * SPEC-055: auto-open al entrar a la home (lógica respetuosa).
 *   - Solo en path "/" (home).
 *   - Solo si el user NO está logueado.
 *   - Solo si el user NO descartó antes (localStorage flag).
 *   - 3s delay después de mount (deja que el hero se cargue primero).
 *   - Si el user lo cierra, marca dismissed -> nunca vuelve a abrir.
 *   - Si el user clickea el botón del navbar, no se considera dismissed.
 */

const DISMISSED_KEY = 'elenaapp_cta_dismissed';
// SPEC-055: ElenaAppCTA se monta 2 veces en el Navbar (desktop + mobile menu).
// Sin este sentinel, ambos useEffect disparan el auto-open al mismo tiempo y
// terminan abriendo 2 modales encimados. El primer mount que llega gana.
// sessionStorage (no localStorage) porque solo aplica a la sesión actual —
// si el user navega y vuelve sin cerrar el browser, el sentinel persiste y
// no se abre otro modal (no es necesario; ya tuvo su oportunidad esta sesión).
const AUTO_OPENED_KEY = 'elenaapp_cta_auto_opened_session';

const ElenaAppCTA: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthReady(true);
        });
        return () => unsub();
    }, []);

    // SPEC-055: auto-open en la home si el user no lo descartó antes.
    // Esperamos a que auth resuelva para no abrir contra users logueados.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!authReady) return;
        // Solo en home
        if (window.location.pathname !== '/') return;
        // No abrir si el user ya está logueado (ya está en el ecosistema)
        if (user) return;
        // No abrir si ya descartó antes (persistente, sobrevive cierre browser)
        try {
            if (localStorage.getItem(DISMISSED_KEY) === '1') return;
        } catch {
            // localStorage puede fallar (private mode estricto). Si falla,
            // no abrimos automáticamente — preferimos silencio a error UX.
            return;
        }
        // SPEC-055: anti doble-modal — el componente está montado 2 veces
        // (desktop + mobile menu del navbar). Claim el sentinel en
        // sessionStorage; si ya está, otra instancia se encargó.
        try {
            if (sessionStorage.getItem(AUTO_OPENED_KEY) === '1') return;
            sessionStorage.setItem(AUTO_OPENED_KEY, '1');
        } catch {
            return;
        }
        // Delay 3s para que primero se vea el hero
        const t = window.setTimeout(() => setOpen(true), 3000);
        return () => window.clearTimeout(t);
    }, [authReady, user]);

    // SPEC-055: cuando el user cierra el modal (ESC, ✕, click-outside)
    // marcamos como descartado para no volver a abrir automáticamente.
    // Si abre el modal manualmente con el botón del navbar, no se persiste
    // — esa es navegación intencional, no dismissal.
    const dismissAndClose = () => {
        try {
            localStorage.setItem(DISMISSED_KEY, '1');
        } catch {
            // ignore
        }
        setOpen(false);
    };

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

    // Cerrar con Escape (SPEC-055: marca dismissed)
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') dismissAndClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    // SPEC-055: click-outside también marca dismissed.
    const closeOnBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) dismissAndClose();
    };

    return (
        <>
            {/* Botón pill del navbar — reemplaza al <a href="https://elena-app..."> */}
            <button
                type="button"
                onClick={() => {
                    // SPEC-084: tracking — apertura intencional del modal
                    // desde el navbar. El auto-open (SPEC-055) NO se trackea
                    // porque el user no manifestó intención.
                    track('cta_elenaapp_abrir');
                    setOpen(true);
                }}
                aria-haspopup="dialog"
                aria-expanded={open}
                className="relative inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-bg-base hover:bg-accent-strong font-semibold text-xs transition-colors"
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
                <span className="ml-0.5 px-1.5 py-0.5 rounded bg-bg-base/30 text-bg-base text-[9px] font-bold tracking-wide">
                    BETA
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
                        className="relative w-full max-h-screen sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl bg-bg-surface border border-white/[0.08] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300"
                    >
                        {/* Cerrar (SPEC-055: marca dismissed) */}
                        <button
                            onClick={dismissAndClose}
                            aria-label="Cerrar"
                            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center text-text-secondary hover:text-text-primary text-lg transition-colors"
                        >
                            ✕
                        </button>

                        {/* Hero con logo */}
                        <div className="relative pt-10 pb-5 px-6 sm:px-8 text-center">
                            <img
                                src="/elena-logo.webp"
                                alt="ElenaApp"
                                width={160}
                                height={160}
                                loading="eager"
                                decoding="async"
                                className="w-28 sm:w-32 mx-auto mb-5 drop-shadow-[0_0_24px_rgba(0,196,154,0.35)]"
                            />
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-accent/10 border border-accent/20 text-accent text-[11px] font-bold uppercase tracking-[0.18em] mb-4">
                                🚀 Acceso anticipado
                            </div>
                            {/* SPEC-096: copy reescrito para reducir fricción
                                transaccional. Antes decía "Sé fundador / Uno
                                de los primeros 1000" — la palabra fundador
                                generaba ansiedad ("¿esto cuesta plata?"). */}
                            <h2
                                id="elenaapp-modal-title"
                                className="font-heading font-black text-text-primary italic uppercase tracking-tight leading-tight mb-3 break-words"
                            >
                                <span className="block text-2xl sm:text-3xl">Reserva tu acceso</span>
                                <span className="block mt-1 text-xs sm:text-sm font-bold tracking-[0.15em] text-accent">
                                    Gratis · Sin tarjeta
                                </span>
                            </h2>
                            <p className="text-text-secondary text-sm leading-relaxed max-w-md mx-auto">
                                Sé de los primeros en usar ElenaApp y recibe beneficios exclusivos de lanzamiento.
                            </p>
                        </div>

                        {/* SPEC-096: cards rediseñadas. Card 1 = valor;
                            Card 2 = seguridad/sin compromiso (la card que
                            más reduce la objeción del visitante hispano). */}
                        <div className="px-6 sm:px-8 pb-2 space-y-2.5">
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/[0.06] border border-accent/20">
                                <span className="text-xl shrink-0 leading-none">💎</span>
                                <div className="min-w-0">
                                    <p className="text-accent font-semibold text-sm mb-0.5">
                                        Precio preferencial
                                    </p>
                                    <p className="text-text-secondary text-xs leading-relaxed">
                                        Condiciones especiales por registro anticipado.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-bg-elevated border border-white/[0.06]">
                                <span className="text-xl shrink-0 leading-none">✅</span>
                                <div className="min-w-0">
                                    <p className="text-text-primary font-semibold text-sm mb-0.5">
                                        Sin obligación
                                    </p>
                                    <p className="text-text-secondary text-xs leading-relaxed">
                                        Solo apartas tu lugar. Decides después si quieres continuar.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* CTA según auth state */}
                        <div className="px-6 sm:px-8 py-6 border-t border-white/[0.06] mt-4">
                            {user ? (
                                <>
                                    <div className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-accent/[0.1] border border-accent/30 text-accent font-semibold text-sm text-center mb-3">
                                        <span className="text-base">✓</span>
                                        Ya estás en la lista
                                    </div>
                                    <p className="text-center text-xs text-text-muted mb-3">
                                        Te avisamos por email cuando lance.
                                    </p>
                                    <a
                                        href="https://elena-app.vercel.app/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-center text-xs text-accent hover:text-accent-strong font-medium"
                                    >
                                        Ver preview de la app →
                                    </a>
                                </>
                            ) : (
                                <>
                                    <a
                                        href="/login?fromWaitlist=1"
                                        onClick={() => {
                                            // SPEC-084: tracking — intent
                                            // de reservar (no garantiza
                                            // que se registre; ese evento
                                            // se dispara en login.astro).
                                            track('cta_elenaapp_reservar');
                                        }}
                                        className="block text-center w-full px-5 py-3 rounded-lg bg-accent text-bg-base hover:bg-accent-strong font-semibold text-base transition-colors"
                                    >
                                        Reservar mi lugar gratis →
                                    </a>
                                    <p className="text-center text-[11px] text-text-muted mt-3">
                                        Gratis · Sin tarjeta · 2 minutos
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
