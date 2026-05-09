# SPEC-006 — Onboarding web crea user listo para ElenaApp sin re-onboarding

**Estado:** 📝 Spec
**Fase:** 1
**Severidad:** CRÍTICO (de funnel)
**Fecha de creación:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** SPEC-005 (schema canónico), SPEC-004 (motor IMR unificado)

---

## Contexto

El sitio web es la puerta de entrada al ecosistema Metamorfosis Real. Un visitante hace el quiz, ve su IMR estimado, se registra para entrar a la lista de espera de ElenaApp, accede a foros y responde tests de los artículos. Cuando ElenaApp lance, ese mismo user debe poder abrir la app, loguearse con las mismas credenciales y **ver su diagnóstico inicial ya cargado** sin volver a completar nada.

Hoy esto NO funciona porque:

1. La auth de Firebase ya está compartida (`elena-app-2026-v1`), pero el doc del user en la web está esparcido entre `profiles/{email}`, `users/{email}` y `waitlist_leads/{auto}`. Ninguno usa `uid`.
2. El IMR Quiz captura datos de bio + hábitos, pero los persiste con un schema distinto al canónico (SPEC-005 lo arregla).
3. No hay un flujo claro de qué pasa cuando un visitante anónimo hace el quiz, después se registra: ¿se mergea su IMR pre-registro al user?

## Problema

El registro en la web no produce un user listo para usar ElenaApp. Hay fricción de re-onboarding garantizada cuando ElenaApp lance.

## Solución propuesta

### Flujo unificado de onboarding (post SPEC-005 + SPEC-004)

```
[Visitante anónimo] → /quiz
        ↓
   completa quiz biometría + hábitos básicos
        ↓
   /api/calculate-imr (anónimo) → result
        ↓
   pantalla "Tu IMR es X. Regístrate para tu protocolo personalizado"
        ↓
[Registro: email + password Firebase Auth]
        ↓
   crea user en Firebase Auth (uid)
        ↓
   POST /api/users/onboard {uid, bio, habits, imrResult}
        ↓
   crea users/{uid} con schema v1 + waitlist.status='pending'
   borra waitlist_leads/{matching email} si había
        ↓
   redirige a /dashboard → muestra diagnóstico cargado
        ↓
[Más adelante] → abre ElenaApp en mobile
        ↓
   login con mismas credenciales → users/{uid} ya tiene bio + imr + habits
        ↓
   ElenaApp salta su onboarding (lee `meta.source === 'web'` y users tienen bio cargado)
   muestra dashboard con su IMR + habilita selección de protocolo
```

### Dos endpoints nuevos

#### `POST /api/users/onboard`

Crea (o completa) el doc `users/{uid}` con datos del quiz inicial. Idempotente: corres con los mismos datos no rompe nada.

```ts
// src/pages/api/users/onboard.ts
import type { APIRoute } from 'astro';
import { admin, db } from '../../../lib/firebaseAdmin';
import { COLLECTIONS, SCHEMA_VERSION } from '../../../lib/constants/firestore';
import type { UserDoc } from '../../../lib/types/user';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Verificar Firebase ID token
    const authHeader = request.headers.get('authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) {
      return new Response(JSON.stringify({ error: 'Missing ID token' }), { status: 401 });
    }
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = await request.json();
    const { bio, habits, imrResult } = body;

    const now = new Date().toISOString();
    const userRef = db.collection(COLLECTIONS.USERS).doc(uid);

    await userRef.set({
      uid,
      email: decoded.email ?? '',
      emailLower: (decoded.email ?? '').toLowerCase(),
      displayName: decoded.name ?? null,
      photoURL: decoded.picture ?? null,
      profile: {
        gender: body.gender ?? null,
        age: body.age ?? null,
        goals: body.goals ?? [],
        pathologies: body.pathologies ?? [],
      },
      bio: { ...bio, updatedAt: now },
      habits: { ...habits, source: 'self_report', updatedAt: now },
      imr: imrResult ? {
        current: imrResult,
        history: admin.firestore.FieldValue.arrayUnion({
          ...imrResult,
          computedAt: now,
          engineVersion: 'spec-70.5-v1',
        }),
      } : { current: null, history: [] },
      waitlist: {
        status: 'pending',
        joinedAt: now,
        invitedAt: null,
        position: null, // calcular en otra spec si se quiere mostrar
      },
      app: {
        protocolId: null,
        onboardingCompleted: false,
        biomarkers: null,
      },
      meta: {
        schemaVersion: SCHEMA_VERSION,
        source: 'web',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      },
    } satisfies UserDoc, { merge: true });

    // Mergear lead anónimo previo si existía
    if (decoded.email) {
      const leadsSnap = await db.collection(COLLECTIONS.WAITLIST_LEADS)
        .where('email', '==', decoded.email.toLowerCase())
        .get();
      const batch = db.batch();
      leadsSnap.docs.forEach(d => batch.delete(d.ref));
      if (!leadsSnap.empty) await batch.commit();
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[onboard] Error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

#### `GET /api/users/me`

Devuelve el `users/{uid}` del user autenticado (proxy server-side para que el cliente no tenga que pegarle a Firestore directo en cada page load — más rápido y permite SSR).

### Cambios en componentes

- `IMRQuiz.tsx` (autenticado o anónimo):
  - Si user autenticado al terminar quiz: llama a `POST /api/calculate-imr` (con ID token), que persiste server-side.
  - Si anónimo: calcula client-side o vía `/api/calculate-imr` sin token, guarda en `sessionStorage` para mostrar resultado y ofrecer registro.
- `pages/login.astro`:
  - Tras `createUserWithEmailAndPassword`, captura el ID token y llama a `POST /api/users/onboard` con bio + habits + imrResult del sessionStorage si existe.
  - Si solo es login (no registro), no llama a `/onboard`.
- `pages/dashboard.astro`:
  - Lee `users/{uid}` server-side via Astro.cookies (con session token verificado) o client-side via Firebase SDK.
  - Muestra diagnóstico cargado.

## Plan de implementación

1. Crear `src/pages/api/users/onboard.ts` con la implementación de arriba.
2. Crear `src/pages/api/users/me.ts` con lectura del propio user.
3. Modificar `IMRQuiz.tsx`:
   - Pasar el ID token en el header del fetch a `/api/calculate-imr` cuando hay sesión.
   - Si no hay sesión, guardar `imrResult`, `bio`, `habits` en `sessionStorage` para reusar tras registro.
4. Modificar `pages/login.astro` (en el branch de `mode === 'register'`):
   - Tras `createUserWithEmailAndPassword`, hacer `await user.getIdToken()`.
   - `fetch('/api/users/onboard', { method: 'POST', headers: { Authorization: 'Bearer <token>', Content-Type: 'application/json' }, body: JSON.stringify({ bio, habits, imrResult }) })`.
   - Limpiar `sessionStorage` tras éxito.
5. Modificar `pages/dashboard.astro`:
   - Leer `users/{uid}` desde el cliente con Firebase SDK (o vía `/api/users/me` para SSR).
   - Renderizar diagnóstico (IMR, blocks E/M/C, body fat, lean mass).

## Criterios de aceptación

- [ ] Endpoint `POST /api/users/onboard` valida ID token, crea/mergea `users/{uid}` con schema v1.
- [ ] Si visitante hace quiz anónimo y luego se registra, su IMR del quiz queda persistido en `users/{uid}.imr.history`.
- [ ] Si había un `waitlist_leads` con su email, se borra (mergeado).
- [ ] Dashboard de la web muestra el IMR + body fat + lean mass del user logueado, leído de `users/{uid}`.
- [ ] (End-to-end con ElenaApp en dev) Un user creado en la web puede hacer login en ElenaApp y `users/{uid}` ya tiene bio + imr + habits cargados — la app no le pide re-onboarding.

## Pruebas

```sh
# 1. Visitante anónimo hace quiz, captura IMR en sessionStorage.
#    (manual desde browser)

# 2. Se registra; tras /api/users/onboard, verificar en Firestore que
#    users/{uid} tiene bio + imr + habits + waitlist.status='pending'.

# 3. Recargar /dashboard. Diagnóstico debe estar cargado.

# 4. Cerrar sesión web. Login en ElenaApp en dev (con mismas credenciales).
#    El doc users/{uid} ya tiene los datos. ElenaApp puede leer y saltar onboarding.
```

## Riesgos / consideraciones

- **ID token expira en 1 hora.** Refresh automático lo maneja Firebase SDK. Para SSR, el cliente envía el token en el fetch.
- **Race condition entre `createUserWithEmailAndPassword` y `verifyIdToken`.** El backend puede recibir el token antes de que la propagación complete. En la práctica, el delay es ~50ms; si vemos error en /onboard, hacer retry en cliente.
- **ElenaApp todavía no existe en producción.** El criterio "no re-onboarding en app" se valida cuando ElenaApp se construya. Mientras tanto, la web cumple su parte y el doc queda listo.
- **`waitlist.position`**. Calcular la posición real requiere contar todos los users con `status === 'pending'` y `joinedAt < me.joinedAt`. Costoso. Se puede hacer en una SPEC futura con `count()` agregado o con un counter dedicado.
- **Privacidad.** El schema canónico tiene PII (email, displayName, age). Las reglas de Firestore (SPEC-005) garantizan que solo el dueño + admin lean. Doble check antes de exponer endpoints públicos.

## Commit

**Mensajes sugeridos:**

- `feat(spec-006a): /api/users/onboard crea user con schema canónico`
- `feat(spec-006b): /api/users/me devuelve perfil del user autenticado`
- `refactor(spec-006c): IMRQuiz pasa ID token a calculate-imr; login.astro llama a onboard tras registro`
- `feat(spec-006d): dashboard muestra diagnóstico cargado del user`

---

## Resultado

*(Pendiente de implementación.)*
