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

/** Tope inflexible de fundadores activos. NO modificar sin spec dedicada. */
export const FOUNDER_CAP = 1000;

/**
 * Path del doc que mantiene el contador atómico.
 * Solo Admin SDK lee/escribe. Cliente no tiene acceso (rules cierran `system/*`).
 */
export const FOUNDER_COUNTER_DOC = {
    collection: 'system',
    doc: 'counters',
} as const;

/**
 * Contador de fundadores activos.
 *
 * Incrementa cuando se asigna un nuevo fundador (`assignFounderIfEligible`).
 * Decrementa cuando se elimina (SPEC-077: `removeFounder`).
 *
 * Es el counter ÚNICO que se compara contra `FOUNDER_CAP` para decidir
 * si hay cupo. El campo interno `founder.number` que se guarda en cada
 * user es para audit/historial — NO se muestra al usuario en ninguna
 * UI. Si tras eliminar+asignar se repite un número, no hay impacto
 * porque ningún ojo humano lo ve.
 */
export const FOUNDER_COUNTER_FIELD = 'founderCount';
