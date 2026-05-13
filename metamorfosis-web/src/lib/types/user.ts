/**
 * Schema canónico v1 del documento `users/{uid}` en Firestore.
 *
 * Este archivo es la FUENTE ÚNICA DE VERDAD del contrato de datos compartido
 * entre el sitio web (Metamorfosis Real) y la app móvil (ElenaApp). Cualquier
 * cambio aquí debe coordinarse con el repo de ElenaApp.
 *
 * Reglas del schema:
 *   - El ID del documento es el `uid` de Firebase Auth (NO el email).
 *   - Todos los bloques son objetos; campos individuales pueden ser `null`
 *     cuando aún no se completaron (web hace captura mínima, app refina).
 *   - `meta.schemaVersion` permite migrar selectivamente en el futuro.
 *   - Datos de alta cardinalidad (daily_logs, biomarcadores granulares) viven
 *     en subcolecciones `users/{uid}/<colección>/<id>`, NO en este doc.
 *
 * Ver specs/SPEC-005-firestore-collections.md
 */

export type Gender = 'male' | 'female';

/** Resultado del motor IMR (SPEC-70.5). Compartido con SPEC-004. */
export interface ImrResult {
    /** 0–100 */
    imrScore: number;
    /** "OPTIMIZADO" | "EFICIENTE" | "FUNCIONAL" | "INESTABLE" | "DETERIORADO" */
    label: string;
    /** Pesos relativos de cada bloque (0–1). E=Estructura, M=Metabolismo, C=Conducta. */
    blocks: { E: number; M: number; C: number };
    /** Índice cintura-altura (waist / heightCm). */
    ica: number;
    /** Body Mass Index. */
    imc: number;
    /** Tasa metabólica basal (Mifflin-St Jeor). */
    tmb: number;
    /** Edad metabólica estimada. */
    metabolicAge: number;
    /** Fat-Free Mass Index. */
    ffmi: number;
    /** Waist-to-Height Ratio. */
    whtr: number;
}

/** Entrada del historial de IMR. */
export interface ImrHistoryEntry extends ImrResult {
    /** ISO string */
    computedAt: string;
    /** Versión del motor que produjo este entry, ej. "spec-70.5-v1". */
    engineVersion: string;
}

export interface UserProfile {
    gender: Gender | null;
    /**
     * SPEC-089: source-of-truth de la edad. ISO 8601 date sin tiempo
     * (`'YYYY-MM-DD'`). El sitio captura esto en el quiz; ElenaApp
     * eventualmente lo persistirá vía su canonical-mirror.
     * Si está presente, `age` se deriva con `calculateAge(birthDate)`.
     * Null en docs legacy de ElenaApp que solo escribieron `age`.
     */
    birthDate: string | null;
    /**
     * Edad cronológica en años. Derivada de `birthDate` cuando ambos
     * existen; persistida como cache para compatibilidad con docs
     * legacy de ElenaApp (que escriben `age` sin `birthDate`).
     */
    age: number | null;
    /** Tags libres, ej. ["recomposicion", "longevidad"]. */
    goals: string[];
    /** Tags libres, ej. ["resistencia_insulina"]. */
    pathologies: string[];
}

export interface UserBio {
    heightCm: number | null;
    weightKg: number | null;
    waistCm: number | null;
    neckCm: number | null;
    /** Requerido para Body Fat Navy en mujeres. */
    hipCm: number | null;
    /** Si null, se calcula con Navy a partir de waist/neck/height/hip. */
    bodyFatPct: number | null;
    /** Derivado: 100 - bodyFatPct. */
    leanMassPct: number | null;
    /** ISO string */
    updatedAt: string;
}

export interface UserHabits {
    fastingHours: number | null;
    /** 19.5 = 19:30. */
    dinnerHour: number | null;
    exerciseMinutesPerDay: number | null;
    /** 0–1. */
    sleepQuality: number | null;
    hydrationLitresPerDay: number | null;
    lastMealHour: number | null;
    /** Web inicialmente captura proxy auto-reportado; app eventualmente reemplaza con tracking real. */
    source: 'self_report' | 'tracked' | null;
    /** ISO string */
    updatedAt: string;
}

export interface UserImr {
    current: ImrResult | null;
    history: ImrHistoryEntry[];
}

export interface UserWaitlist {
    status: 'pending' | 'invited' | 'active' | null;
    /** ISO string */
    joinedAt: string | null;
    /** ISO string */
    invitedAt: string | null;
    /** Posición calculable; puede dejarse null si no se mantiene contador. */
    position: number | null;
}

/**
 * SPEC-056: Cohorte de fundadores (primeros 1000 usuarios registrados).
 *
 * Se asigna ATÓMICAMENTE en `POST /api/users/onboard` dentro de una
 * Firestore runTransaction que incrementa `system/counters.founderCount`.
 * Una vez asignado, NO se vuelve a tocar (idempotencia: si el user re-hace
 * onboarding, se preservan los valores originales).
 *
 * `isFounder` es el flag definitivo que ElenaApp lee para desbloquear
 * beneficios del precio fundador. NO se usa código de validación —
 * Firebase Auth es compartido entre web y ElenaApp, el doc canónico
 * `users/{uid}.founder` es la fuente de verdad.
 *
 * Cap: 1000 (constante en `lib/constants/founders.ts`). Después del 1000,
 * los nuevos usuarios tienen `isFounder: false, number: null`.
 */
export interface UserFounder {
    /** ¿Es fundador? Decidido en el onboard. */
    isFounder: boolean;
    /** Número 1..1000. null si no es fundador. */
    number: number | null;
    /** ISO string del momento que se asignó. null si no es fundador. */
    assignedAt: string | null;
}

/**
 * Reservado para ElenaApp. La web NO escribe aquí.
 * El equipo de ElenaApp puede ampliar esta interfaz en su propio repo
 * mientras no rompa los campos existentes ni viole `schemaVersion`.
 */
export interface UserApp {
    protocolId: string | null;
    onboardingCompleted: boolean;
    /** Estructura libre por ahora; ElenaApp define el shape. */
    biomarkers: Record<string, unknown> | null;
}

export interface UserMeta {
    schemaVersion: 1;
    /** Qué producto creó/actualizó por última vez este doc. */
    source: 'web' | 'app' | 'imported';
    /** ISO string */
    createdAt: string;
    /** ISO string */
    updatedAt: string;
    /** ISO string. Útil para analítica de retención. */
    lastLoginAt: string | null;
}

/**
 * Documento canónico de usuario.
 * Path: `users/{uid}` (uid del Firebase Auth)
 */
export interface UserDoc {
    uid: string;
    email: string;
    /** Para búsquedas case-insensitive. Útil para matchear leads anónimos. */
    emailLower: string;
    displayName: string | null;
    photoURL: string | null;

    profile: UserProfile;
    bio: UserBio;
    habits: UserHabits;
    imr: UserImr;
    waitlist: UserWaitlist;
    /** SPEC-056: cohorte fundadores (primeros 1000). */
    founder: UserFounder;
    app: UserApp;
    meta: UserMeta;
}

/** Lead anónimo pre-auth. Cuando el lead se registra, se mergea a `users/{uid}.waitlist`. */
export interface WaitlistLead {
    name: string;
    email: string;
    estimated_imr: number;
    quiz_type: string;
    proxy_scores: Record<string, number>;
    /** Firestore Timestamp serializado o ISO string. */
    created_at: string | { _seconds: number; _nanoseconds: number };
}
