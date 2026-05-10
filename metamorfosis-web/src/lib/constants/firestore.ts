/**
 * Constantes de Firestore — fuente única de verdad de los nombres de colecciones.
 *
 * Importar SIEMPRE desde acá en lugar de pegar literales en el código.
 * Si en el futuro renombramos una colección o agregamos versionado al path
 * (`users_v2`, `posts_2026`, etc.), cambiamos solo este archivo.
 *
 * Ver specs/SPEC-005-firestore-collections.md
 */

export const COLLECTIONS = {
    /** Documento canónico de usuario, key = uid de Firebase Auth. */
    USERS: 'users',
    /** Artículos editoriales del admin. */
    POSTS: 'metamorfosis_posts',
    /** Leads anónimos pre-auth. Cuando se registran, se mergean a `users/{uid}.waitlist`. */
    WAITLIST_LEADS: 'waitlist_leads',
    /** Datos analíticos / pruebas del admin. */
    PRUEBAS: 'pruebas',
    /** Audit log de mutaciones admin (SPEC-018). Solo Admin SDK escribe/lee. */
    ADMIN_AUDIT_LOG: 'admin_audit_log',
    /** Foro de comunidad (SPEC-033). Subcolecciones: replies/{id}, likes/{uid}. */
    FORUM_TOPICS: 'forum_topics',
} as const;

/** Subcolecciones bajo `users/{uid}`. */
export const USER_SUBCOLLECTIONS = {
    /** Logs diarios de la app (ayuno, comidas, ejercicio, sueño). path: users/{uid}/daily_logs/{YYYY-MM-DD} */
    DAILY_LOGS: 'daily_logs',
    /** Respuestas a quizzes de artículos. path: users/{uid}/article_quizzes/{slug} */
    ARTICLE_QUIZZES: 'article_quizzes',
} as const;

/**
 * Versión del schema de UserDoc. Incrementar cuando se haga un cambio breaking.
 * Migrar selectivamente con un script + bandera `meta.schemaVersion`.
 */
export const SCHEMA_VERSION = 1 as const;
