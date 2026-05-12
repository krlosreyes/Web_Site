import { useState, useEffect } from 'react';

/**
 * SPEC-080: Banner de consentimiento de cookies y tratamiento de datos.
 *
 * Cumple los requisitos mínimos de:
 *   - Ley 1581 de 2012 (Colombia, Habeas Data): el titular debe ser
 *     informado del tratamiento de sus datos y dar consentimiento previo.
 *   - GDPR (Unión Europea): si llegan visitantes europeos, deben tener
 *     opción de rechazar cookies no esenciales antes de que se carguen.
 *
 * Comportamiento:
 *   - Aparece la PRIMERA vez que el usuario visita el sitio.
 *   - Aparece de nuevo si el usuario limpia su localStorage.
 *   - "Aceptar todo" guarda flag `cookies_accepted` = "all".
 *   - "Solo esenciales" guarda flag = "essential".
 *   - El sitio NO bloquea contenido si no se decide — pero registra
 *     la elección para futuras visitas.
 *
 * Nota técnica: Umami Analytics es privacy-friendly y NO usa cookies
 * de tracking por defecto. Aún así informamos su uso porque envía
 * datos de visita a un servidor externo (compliance Ley 1581).
 */

const COOKIE_CONSENT_KEY = 'mr_cookie_consent_v1';

type ConsentValue = 'all' | 'essential' | null;

const CookieBanner = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Mostrar solo si no hay decisión previa.
        const existing = localStorage.getItem(COOKIE_CONSENT_KEY) as ConsentValue;
        if (!existing) {
            // Pequeño delay para no competir con el LCP.
            const timer = setTimeout(() => setVisible(true), 800);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleConsent = (value: 'all' | 'essential') => {
        localStorage.setItem(COOKIE_CONSENT_KEY, value);
        localStorage.setItem(
            COOKIE_CONSENT_KEY + '_date',
            new Date().toISOString(),
        );
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-label="Aviso de cookies y tratamiento de datos"
            aria-live="polite"
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-[150] animate-in slide-in-from-bottom-4 duration-300"
        >
            <div className="bg-bg-elevated border border-white/[0.12] rounded-xl p-5 md:p-6 shadow-2xl">
                <div className="flex items-start gap-3 mb-4">
                    <span className="text-xl shrink-0" aria-hidden="true">🍪</span>
                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-text-primary tracking-tight mb-1">
                            Tu privacidad importa
                        </h3>
                        <p className="text-sm text-text-secondary leading-relaxed">
                            Usamos cookies esenciales para que el sitio funcione (sesión, preferencias) y analíticas privacy-friendly (Umami) para entender qué contenido ayuda más. No vendemos ni compartimos tus datos con terceros para publicidad.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={() => handleConsent('all')}
                        className="flex-1 px-4 py-2.5 bg-accent text-bg-base rounded-lg font-semibold text-sm hover:bg-accent-strong transition-colors"
                    >
                        Aceptar todo
                    </button>
                    <button
                        onClick={() => handleConsent('essential')}
                        className="flex-1 px-4 py-2.5 bg-bg-surface text-text-secondary border border-white/[0.1] rounded-lg font-semibold text-sm hover:text-text-primary hover:border-white/[0.2] transition-colors"
                    >
                        Solo esenciales
                    </button>
                </div>

                <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
                    Al continuar aceptas nuestra{' '}
                    <a
                        href="/privacidad"
                        className="text-accent hover:text-accent-strong underline underline-offset-2"
                    >
                        política de privacidad
                    </a>
                    {' '}y los{' '}
                    <a
                        href="/terminos"
                        className="text-accent hover:text-accent-strong underline underline-offset-2"
                    >
                        términos de uso
                    </a>
                    .
                </p>
            </div>
        </div>
    );
};

export default CookieBanner;
