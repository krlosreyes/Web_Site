/**
 * Constantes del cohorte de fundadores (SPEC-056).
 *
 * Los primeros N usuarios registrados son "fundadores": reciben beneficios
 * permanentes en la suscripción anual de ElenaApp + beneficios sorpresa
 * que se revelan el día del lanzamiento. Después del cap N, los nuevos
 * usuarios son usuarios normales sin estos beneficios.
 *
 * El cap se aplica de forma atómica en `POST /api/users/onboard` via
 * Firestore runTransaction sobre `system/counters.founderCount`. Dos
 * onboards simultáneos en el #N no pueden ambos terminar como fundadores
 * — Firestore aborta uno y lo reintenta.
 */

/** Tope inflexible de fundadores. NO modificar sin spec dedicada. */
export const FOUNDER_CAP = 1000;

/**
 * Path del doc que mantiene el contador atómico.
 * Solo Admin SDK lee/escribe. Cliente no tiene acceso (rules cierran `system/*`).
 */
export const FOUNDER_COUNTER_DOC = {
    collection: 'system',
    doc: 'counters',
} as const;

/** Campo dentro del doc `system/counters` que cuenta los fundadores asignados. */
export const FOUNDER_COUNTER_FIELD = 'founderCount';
