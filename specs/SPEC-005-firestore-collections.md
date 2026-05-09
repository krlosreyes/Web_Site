# SPEC-005 — Schema canónico de `users/{uid}` compartido Web ↔ ElenaApp

**Estado:** 📝 Spec
**Fase:** 1
**Severidad:** CRÍTICO
**Fecha de creación:** 2026-05-08
**Última revisión:** 2026-05-09 (rescoped: integración web ↔ ElenaApp)
**Autor:** Carlos Reyes
**Depende de:** SPEC-001 (deploy)
**Bloquea:** SPEC-004 (motor IMR), SPEC-006 (onboarding unificado)

---

## Contexto

Metamorfosis Real es un funnel de dos superficies que comparten Firebase:

```
Web (descubrir + diagnóstico inicial + waitlist + foros + tests)
   ↓ (mismo Firebase Auth, mismo user doc)
ElenaApp (ejecución del protocolo personalizado + biomarcadores + daily logs)
```

ElenaApp existe pero está en desarrollo, **sin users reales en producción**. Esa ventana se cierra en cuanto haya users reales escribiendo en Firestore con un schema cualquiera. Esta spec aprovecha el momento para definir el contrato canónico que ambos productos respetan.

Estado actual de Firestore visto desde la web:

- `metamorfosis_posts` — artículos editoriales del admin. **Conservar tal cual.**
- `profiles/{email_lowercased}` — perfiles legacy creados por `pages/login.astro`. Forma: `{ userName, email, imr, interpretation, updatedAt }`.
- `users/{email_lowercased}` — perfiles "modernos" creados por el IMR Quiz. Forma: `{ imr, zona, blocks, ffmi, whtr, updatedAt }`. **Bug clave**: usa `email` como ID, no `uid`. ElenaApp probablemente usa `uid`.
- `waitlist_leads/{auto}` — leads anónimos del quiz pre-registro. Forma: `{ name, email, estimated_imr, quiz_type, proxy_scores, created_at }`.
- `pruebas/{auto}` — analítica/pruebas del admin. Conservar.
- `post` (singular) — bug en `stats.ts`, no existe.

Tres problemas concretos:

1. **`stats.ts:21` consulta `'post'` (singular) cuando debería ser `'metamorfosis_posts'`.** `totalPosts` siempre devuelve 0. Trivial.
2. **`users` y `profiles` coexisten** y `BioDashboard.tsx` lee de ambas y mergea. Workaround frágil.
3. **El ID del user es `email.toLowerCase()` en lugar del `uid` de Firebase Auth.** Si un user cambia su email en Firebase Auth, su doc queda huérfano. Si ElenaApp espera `users/{uid}` (lo estándar en proyectos Firebase), web y app divergen.

## Problema

No hay un schema canónico de `users` compartido entre web y ElenaApp. Cualquier feature de continuidad ("regístrate en la web → entra a ElenaApp con tu diagnóstico ya cargado") es imposible sin esta base.

## Solución propuesta

### 1. Schema canónico de `users/{uid}`

ID: el `uid` de Firebase Auth (NO email). Versión: `schemaVersion: 1`.

```ts
// src/lib/types/user.ts (nuevo archivo)
export interface UserDoc {
  // === Identidad (auto desde Firebase Auth) ===
  uid: string;
  email: string;
  emailLower: string; // para búsquedas case-insensitive
  displayName: string | null;
  photoURL: string | null;

  // === Perfil del onboarding ===
  profile: {
    gender: 'male' | 'female' | null;
    age: number | null;
    goals: string[]; // ej. ["recomposicion", "longevidad"]; vacío al inicio
    pathologies: string[]; // ej. ["resistencia_insulina"]; vacío al inicio
  };

  // === Biometría (web captura básica; app puede refinar) ===
  bio: {
    heightCm: number | null;
    weightKg: number | null;
    waistCm: number | null;
    neckCm: number | null;
    hipCm: number | null; // requerido para mujeres en Body Fat Navy
    bodyFatPct: number | null; // si no viene, se calcula con Navy
    leanMassPct: number | null; // derivado: 100 - bodyFatPct
    updatedAt: string; // ISO
  };

  // === Hábitos auto-reportados (proxy v1 desde web; app reemplaza con tracking real) ===
  habits: {
    fastingHours: number | null;
    dinnerHour: number | null; // 19.5 = 19:30
    exerciseMinutesPerDay: number | null;
    sleepQuality: number | null; // 0-1
    hydrationLitresPerDay: number | null;
    lastMealHour: number | null;
    source: 'self_report' | 'tracked' | null; // web=self_report, app eventualmente=tracked
    updatedAt: string;
  };

  // === IMR último resultado + historial ===
  imr: {
    current: ImrResult | null;
    history: Array<ImrResult & { computedAt: string; engineVersion: string }>;
  };

  // === Waitlist (reemplaza la colección waitlist_leads para users con auth) ===
  waitlist: {
    status: 'pending' | 'invited' | 'active' | null;
    joinedAt: string | null;
    invitedAt: string | null;
    position: number | null;
  };

  // === Reservado para ElenaApp (web no toca, app completa) ===
  app: {
    protocolId: string | null;
    onboardingCompleted: boolean;
    biomarkers: Record<string, unknown> | null;
    // daily_logs vive en subcolección users/{uid}/daily_logs
  };

  // === Metadata ===
  meta: {
    schemaVersion: 1;
    source: 'web' | 'app' | 'imported';
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
  };
}

export interface ImrResult {
  imrScore: number;       // 0-100
  label: string;          // "OPTIMIZADO" | ... | "DETERIORADO"
  blocks: { E: number; M: number; C: number };
  ica: number;            // waist / height
  imc: number;            // BMI
  tmb: number;            // Mifflin-St Jeor
  metabolicAge: number;
  ffmi: number;
  whtr: number;
}
```

**Decisiones clave del schema:**
- Todos los campos del onboarding son **nullable**. La web los completa parcialmente (lo mínimo para diagnóstico inicial). ElenaApp los refina/reemplaza con datos reales.
- `imr.history` es array creciente, no solo último valor. Permite ver evolución sin colección aparte.
- `app.*` queda intocado por la web. ElenaApp es libre de definir su forma interna ahí.
- `daily_logs` y datos de alta cardinalidad van en **subcolección** `users/{uid}/daily_logs/{date}` para no inflar el doc raíz.
- `meta.source` permite trackear qué producto creó/actualizó el doc.

### 2. Reglas de seguridad de Firestore (`firestore.rules` actualizado)

Lectura/escritura del propio doc por su dueño; admins (con custom claim) leen todo:

```
match /databases/{database}/documents {
  match /users/{uid} {
    allow read, update: if request.auth != null && request.auth.uid == uid;
    allow create: if request.auth != null && request.auth.uid == uid;
    allow delete: if false; // nunca desde cliente
    match /daily_logs/{date} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
  match /metamorfosis_posts/{post} {
    allow read: if true;
    allow write: if false; // solo admin SDK
  }
  match /waitlist_leads/{lead} {
    allow create: if true; // anónimo, lead pre-auth
    allow read, update, delete: if false;
  }
  match /pruebas/{doc} {
    allow read, write: if false; // solo admin SDK
  }
}
```

Estas rules las aplica Carlos desde Firebase Console o desde un repo `firebase-rules` aparte. La spec deja el snippet pero no las despliega automáticamente.

### 3. Bug fix de `stats.ts`

Cambiar `db.collection('post')` → `db.collection('metamorfosis_posts')`. Una línea. Va en el mismo commit como sub-fix.

### 4. Migración de datos legacy

Como ElenaApp no tiene users reales y la web está en producción reciente, lo más probable es que `profiles` y `users` (con email como key) tengan **0 a pocos registros** de pruebas. Estrategia:

1. Script `metamorfosis-web/scripts/migrate-users-schema-v1.ts` que:
   - Itera `profiles` y `users` legacy.
   - Por cada doc, busca el `uid` en Firebase Auth por email (`auth.getUserByEmail`).
   - Si encuentra `uid`, crea/mergea el nuevo doc en `users/{uid}` con la forma del schema v1, mapeando los campos viejos a la nueva estructura.
   - Si NO encuentra `uid` (lead sin auth real), deja el doc legacy intacto y lo loguea para revisión manual.
   - Al final, borra los docs legacy migrados.
2. `waitlist_leads` queda como está (es para leads anónimos sin auth). Cuando un lead se registra en la web, se crea su `users/{uid}` con `waitlist.status: 'pending'` y se borra el lead anónimo si su email matchea (decisión: ¿borrar o mantener?).

**Decisión recomendada:** mantener `waitlist_leads` como colección **solo de leads sin auth** (futuras campañas con email-only capture). Cuando un lead se registra (auth), se crea su user con `waitlist.status: 'pending'` y se borra su entry en `waitlist_leads`.

### 5. Actualización del código de la web

Una vez ejecutada la migración:

- `pages/login.astro` → escribir/leer en `users/{uid}` (no `profiles/{email}`).
- `components/IMRQuiz.tsx` → escribir el resultado del quiz en `users/{uid}.bio` + `users/{uid}.habits` + push a `users/{uid}.imr.history`.
- `components/BioDashboard.tsx` → leer SOLO `users/{uid}` (eliminar el merge de `profiles` + `users`).
- `components/ArticleQuiz.tsx` → si guarda progreso de tests por user, escribir en subcolección `users/{uid}/article_quizzes/{slug}`.
- `pages/api/leads.ts` → solo escribe en `waitlist_leads` para visitantes anónimos sin sesión Firebase. Si hay sesión, escribir directo a `users/{uid}.waitlist`.
- `pages/api/admin/stats.ts` → fix `'post'` → `'metamorfosis_posts'`.

## Plan de implementación

### Sub-spec 5.1 — Tipos y constantes (commit 1)

1. Crear `metamorfosis-web/src/lib/types/user.ts` con la interfaz `UserDoc` y el tipo `ImrResult` (este último también lo va a usar SPEC-004).
2. Crear `metamorfosis-web/src/lib/constants/firestore.ts`:
   ```ts
   export const COLLECTIONS = {
     USERS: 'users',
     POSTS: 'metamorfosis_posts',
     WAITLIST_LEADS: 'waitlist_leads',
     PRUEBAS: 'pruebas',
   } as const;

   export const SCHEMA_VERSION = 1 as const;
   ```
3. Reemplazar literales `'metamorfosis_posts'`, `'users'`, `'waitlist_leads'`, `'pruebas'` esparcidos por `COLLECTIONS.POSTS`, etc. en todo `src/`.

### Sub-spec 5.2 — Fix `stats.ts` (commit 2, mini)

Una línea: `db.collection('post')` → `db.collection(COLLECTIONS.POSTS)`. Verificable con `curl https://metamorfosisvital.com.co/api/admin/stats` (con cookie admin) → `totalPosts > 0`.

### Sub-spec 5.3 — Script de migración (commit 3)

`metamorfosis-web/scripts/migrate-users-schema-v1.ts`. No se ejecuta automático; Carlos lo corre con `npx tsx scripts/migrate-users-schema-v1.ts` cuando esté listo. El script:

- Hace `gcloud firestore export ...` antes de tocar nada (backup automatizado).
- Imprime un dry-run con conteos antes de escribir.
- Pide confirmación interactiva (`Continue? y/N`).
- Escribe los nuevos docs en `users/{uid}`.
- Borra los docs legacy migrados.
- Loguea los que no pudo migrar (por falta de `uid`) para revisión manual.

### Sub-spec 5.4 — Refactor de los consumidores (commit 4)

`login.astro`, `IMRQuiz.tsx`, `BioDashboard.tsx`, `ArticleQuiz.tsx`, `api/leads.ts`. Usan `users/{uid}` y la forma del schema v1.

### Sub-spec 5.5 — Reglas de Firestore (manual fuera del repo)

Carlos pega el snippet en Firebase Console → Firestore → Rules. Verificación: lectura del propio user OK, lectura de otro user → permission denied.

## Criterios de aceptación

- [ ] `src/lib/types/user.ts` define `UserDoc` y `ImrResult`.
- [ ] `src/lib/constants/firestore.ts` exporta `COLLECTIONS` y `SCHEMA_VERSION`.
- [ ] `grep -rn "db.collection\\('" metamorfosis-web/src` no devuelve literales — solo referencias a `COLLECTIONS.X`.
- [ ] `stats.ts` apunta a `COLLECTIONS.POSTS`. `GET /api/admin/stats` con cookie admin → `totalPosts > 0` (asumiendo que hay al menos un post en la colección).
- [ ] Script de migración ejecuta dry-run + confirmación + backup. Es idempotente (correr dos veces no rompe).
- [ ] Después de migración, `profiles` está vacía o solo contiene leads sin auth real.
- [ ] `BioDashboard.tsx` lee SOLO `users/{uid}` (eliminado el merge de dos colecciones).
- [ ] Login y registro en `/login` y `/quiz` escriben docs con la forma del schema v1.
- [ ] Reglas de Firestore aplicadas (verificable con prueba manual desde Firebase Console).

## Pruebas

```sh
# Después del refactor, en producción:

# 1. Stats admin reporta posts reales
COOKIE=$(curl -s -i -X POST https://metamorfosisvital.com.co/api/admin/login \
    -H 'Content-Type: application/json' \
    -d '{"password":"<ADMIN_PASSWORD>"}' \
    | grep -i 'set-cookie' | head -1 | sed 's/[Ss]et-[Cc]ookie: //;s/;.*//')

curl -s -H "Cookie: $COOKIE" https://metamorfosisvital.com.co/api/admin/stats | python3 -m json.tool
# Esperado: { totalPosts: >=1, totalLeads: ... }

# 2. Registrarse en /login con email nuevo, verificar que en Firestore aparece users/{uid}
#    con la forma de UserDoc (no profiles/{email}).

# 3. Hacer el IMR quiz autenticado, verificar que el resultado se escribe en
#    users/{uid}.bio, .habits, .imr.history (push), .imr.current (set).

# 4. Verificar permisos (Firebase Console > Rules Playground):
#    - users/{my_uid} read con request.auth.uid = my_uid → ALLOW
#    - users/{otro_uid} read con request.auth.uid = my_uid → DENY
```

## Riesgos / consideraciones

- **Backup obligatorio antes de migrar.** El script lo automatiza, pero verificar manualmente en GCS.
- **`emailLower` indexado.** Si después de migrar querés buscar users por email (ej. invitaciones), Firestore necesita un índice compuesto (no automático para casos sensibles a mayúsculas). Anotarlo cuando se construya esa feature.
- **Compatibilidad ElenaApp.** Como ElenaApp aún no tiene users reales, podemos dictar el schema. Pero hay que **comunicar el schema al equipo de ElenaApp** (en este caso, vos mismo) para que respete la forma. Idealmente publicar `src/lib/types/user.ts` como package npm privado o copiarlo al repo de ElenaApp como source of truth.
- **`schemaVersion`.** Si en el futuro cambia el schema, el campo permite migrar selectivamente. Hoy todos los docs nacen con `schemaVersion: 1`.
- **`waitlist_leads` legacy con email duplicado a un user real.** Después de la migración, si un user se registra y tenía un lead anónimo previo con su email, podemos optar por (a) borrar el lead, (b) mergearlo a `users/{uid}.waitlist`, (c) ignorarlo. Decisión recomendada: **(b)**, mergear para no perder el `estimated_imr` y `proxy_scores` que el quiz capturó.

## Commit

**Mensajes sugeridos** (cuatro commits, uno por sub-spec):

1. `feat(spec-005a): types y constants para schema canónico de users`
2. `fix(spec-005b): stats.ts apunta a 'metamorfosis_posts'`
3. `feat(spec-005c): script de migración a schema v1`
4. `refactor(spec-005d): consumidores usan schema canónico de users`

---

## Resultado

*(Pendiente de implementación.)*
