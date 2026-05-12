/**
 * track — wrapper para Umami custom events (SPEC-084).
 *
 * Uso:
 *   import { track } from '../lib/analytics/track';
 *   track('quiz_completado', { score: 67, label: 'OPTIMO' });
 *
 * Comportamiento:
 *   - SSR-safe: no-op si `window` no existe (Astro frontmatter, build).
 *   - Defensive: no-op si `window.umami` no está cargado (dev local,
 *     ad-blockers, fallo de red al CDN de Umami). Nunca lanza, nunca
 *     rompe el flujo del usuario.
 *   - Nunca pasar PII como property (email, nombre, uid). Solo enums
 *     y números agregados. Umami es "directional", no "ground truth".
 *
 * El UmamiScript.astro solo inyecta el script en producción, así que
 * en `astro dev` window.umami siempre será undefined y los track()
 * son no-ops silenciosos. Esto es intencional: no contaminamos el
 * dashboard con eventos de dev.
 */

type UmamiTrackPayload = Record<string, string | number | boolean>;

interface UmamiGlobal {
    track: (
        eventName: string,
        eventData?: UmamiTrackPayload,
    ) => void;
}

declare global {
    interface Window {
        umami?: UmamiGlobal;
    }
}

export function track(
    eventName: string,
    eventData?: UmamiTrackPayload,
): void {
    if (typeof window === 'undefined') return;
    try {
        window.umami?.track(eventName, eventData);
    } catch (err) {
        // No queremos que analytics rompa la app. Loguear y seguir.
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[analytics] track() error:', err);
        }
    }
}
