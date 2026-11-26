import React from 'react';
import { track } from '../lib/analytics/track';
import { ELENA_APP_STORE_URL } from '../lib/constants/app';

/**
 * ElenaApp CTA — pill del navbar.
 *
 * SPEC-117 (26-nov-2026): Elena ya está en App Store. El modal de lista de
 * espera (SPEC-048/055/097) y su apertura automática en la home se retiran:
 * prometían "acceso anticipado" y "primeras 1000 personas" para una app que
 * ya se puede descargar. La pill ahora abre la ficha de App Store.
 */
const ElenaAppCTA: React.FC = () => (
    <a
        href={ELENA_APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('cta_app_store')}
        className="relative inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-bg-base hover:bg-accent-strong font-semibold text-xs transition-colors"
    >
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
        <span>Descarga Elena</span>
    </a>
);

export default ElenaAppCTA;
