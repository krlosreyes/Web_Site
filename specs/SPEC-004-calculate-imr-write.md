# SPEC-004 — Motor IMR unificado web ↔ ElenaApp

**Estado:** 📝 Spec
**Fase:** 1
**Severidad:** CRÍTICO
**Fecha de creación:** 2026-05-08
**Última revisión:** 2026-05-09 (rescoped: scope ampliado a unificación con ElenaApp)
**Autor:** Carlos Reyes
**Depende de:** SPEC-001 (deploy), **SPEC-005** (schema canónico — define `ImrResult` y dónde se persiste el cálculo)

---

## Contexto

El motor IMR (Índice de Metamorfosis Real) **debe ser idéntico** entre la web y ElenaApp. Si divergen, dos versiones del mismo user reciben diagnósticos distintos según qué producto consultaron, lo que destruye la propuesta de valor del funnel ("la web te diagnostica → ElenaApp ejecuta el protocolo basado en ese diagnóstico").

Estado actual del cálculo en la web:

- `src/utils/imr-engine.ts` → exporta `calculateSPEC705({...})`. Lo usa `IMRQuiz.tsx` directo desde el cliente.
- `src/utils/biometrics.ts` → exporta `calculateIMR({peso,altura,grasa})` que es un **fetch a una Cloud Function externa** (`PUBLIC_CLOUD_FUNCTION_URL` apunta a `https://us-central1-elena-app-2026-v1.cloudfunctions.net/calculateIMRv2`). El `.env` la marca como "Antigravity Engine (disabled)". Lo usa `AnaliticaIMR.tsx` (admin).
- `src/components/calculator/MetamorfosisCalculator.tsx` → función local `calculateIMR()` que es solo el handler que hace `fetch('/api/calculate-imr', ...)`.
- `src/pages/api/calculate-imr.ts` → **stub temporal 503** (puesto en SPEC-001 para desbloquear el build, porque importaba un símbolo inexistente).

Tres motores conviviendo, ninguno se habla con los otros. Y no sabemos qué fórmula usa ElenaApp hoy.

Decisión inicial pendiente (resuelta en sub-spec 4.0):

| Opción | Trade-off |
|---|---|
| **A — Cloud Function única** (calculateIMRv2 en GCP). Web la consume vía `/api/calculate-imr` proxy. ElenaApp la consume directo. | Una sola fuente de verdad. Cambios de fórmula se propagan instantáneo. Latencia por hop (~200ms). Web depende de CF arriba. |
| **B — Librería compartida** (TypeScript package privado). Web y ElenaApp lo importan. | Cálculo local sin latencia, offline-friendly. Drift posible si no actualizan ambos productos a tiempo. Requiere artifact registry o monorepo. |

## Problema

Hay tres motores divergentes en la web, ninguno alineado con ElenaApp, y el endpoint `/api/calculate-imr` está stubbeado a 503 desde SPEC-001. La calculadora PRO no funciona y no hay garantía de que el resultado sea el mismo que ElenaApp dará al mismo user con los mismos inputs.

## Solución propuesta

### Sub-spec 4.0 — Investigación + decisión (gate antes de implementar)

Antes de tocar código, Carlos verifica:

1. **¿`calculateIMRv2` en GCP está desplegada y viva?**
   ```sh
   curl -s -o /dev/null -w "%{http_code}\\n" \
     https://us-central1-elena-app-2026-v1.cloudfunctions.net/calculateIMRv2
   # Esperado: 405 (Method Not Allowed para GET) si está viva, 404 si no existe.

   gcloud functions describe calculateIMRv2 --region=us-central1 --gen2
   # O Cloud Console → Functions → ver versión, runtime, último deploy.
   ```

2. **¿Qué fórmula contiene?** Si Carlos puede ver el source en GCP, comparar con `calculateSPEC705` de `imr-engine.ts`. Si son la misma → tomar la CF como canon. Si difieren → hay que decidir cuál es el motor real.

3. **¿Qué fórmula tiene ElenaApp en su repo?** Carlos lo verifica en el repo de ElenaApp.

**Resultado de la investigación determina la opción A o B.** Si la CF está viva y ElenaApp la usa → Opción A. Si la CF está abandonada y ElenaApp tiene su propia copia local → Opción B (extraer a librería).

### Sub-spec 4.1 — Implementación

Ambas opciones (A y B) escriben el endpoint `/api/calculate-imr` así:

```ts
import type { APIRoute } from 'astro';
import { db } from '../../lib/firebaseAdmin';
import { COLLECTIONS } from '../../lib/constants/firestore';
import type { ImrResult, UserDoc } from '../../lib/types/user';
import { computeImr } from '../../lib/imr/engine'; // motor canónico (impl varía según opción)

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Validación de inputs
    const required = ['heightCm', 'currentWeightKg', 'waistCircumferenceCm', 'neckCircumferenceCm'];
    for (const k of required) {
      if (typeof data[k] !== 'number' || !Number.isFinite(data[k])) {
        return jsonResponse(400, { error: `Campo inválido: ${k}` });
      }
    }

    // Cálculo (proxy a CF si opción A; importado de librería si opción B)
    const result: ImrResult = await computeImr({
      heightCm: data.heightCm,
      weightKg: data.currentWeightKg,
      waistCm: data.waistCircumferenceCm,
      neckCm: data.neckCircumferenceCm,
      hipCm: data.hipCircumferenceCm,
      age: data.age ?? 40,
      gender: data.gender === 'female' ? 'female' : 'male',
      bodyFatPct: data.bodyFat,
      // Hábitos opcionales con defaults; web no captura todos en quiz inicial
      fastingHours: data.fastingHours ?? 12,
      dinnerHour: data.dinnerHour ?? 19,
      exerciseMinutes: data.exerciseMinutes ?? 30,
      sleepQuality: data.sleepQuality ?? 0.7,
      hydrationLitres: data.hydrationLitres ?? 2,
      lastMealHour: data.lastMealHour ?? 19,
    });

    // Persistencia opcional: si el request viene autenticado (cookie de Firebase Auth),
    // escribir en users/{uid} según el schema canónico SPEC-005. Si no, devolver
    // el resultado y dejar que el cliente decida (anónimo).
    const uid = await getUidFromRequest(request); // helper que valida Firebase ID token
    if (uid) {
      await persistImr(uid, { ...data, ...result });
    }

    return jsonResponse(200, { success: true, result });
  } catch (err) {
    console.error('[calculate-imr] Error:', err);
    return jsonResponse(500, { error: 'Error interno del motor IMR' });
  }
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

**Diferencia A vs B implementación de `computeImr`:**

- **Opción A:** `src/lib/imr/engine.ts` hace `fetch(import.meta.env.PUBLIC_CLOUD_FUNCTION_URL, { method: 'POST', body, headers })` y mapea la respuesta al shape `ImrResult`.
- **Opción B:** `src/lib/imr/engine.ts` contiene la implementación pura (copia de `calculateSPEC705` + Body Fat Navy + métricas derivadas) tipada al `ImrResult` del schema canónico.

`persistImr(uid, data)` (helper común a ambas opciones):

```ts
async function persistImr(uid: string, payload: any) {
  const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
  const now = new Date().toISOString();

  await userRef.set({
    bio: {
      heightCm: payload.heightCm,
      weightKg: payload.weightKg,
      waistCm: payload.waistCm,
      neckCm: payload.neckCm,
      hipCm: payload.hipCm ?? null,
      bodyFatPct: payload.bodyFat ?? payload.result.bodyFatPct ?? null,
      leanMassPct: payload.bodyFat ? 100 - payload.bodyFat : null,
      updatedAt: now,
    },
    imr: {
      current: payload.result,
    },
    meta: {
      schemaVersion: 1,
      updatedAt: now,
    },
  }, { merge: true });

  // history como array push
  await userRef.update({
    'imr.history': admin.firestore.FieldValue.arrayUnion({
      ...payload.result,
      computedAt: now,
      engineVersion: 'spec-70.5-v1',
    }),
  });
}
```

### Sub-spec 4.2 — Eliminar la rama `recordId` y `biometrics.ts` legacy

- El bloque `if (data.recordId) { ... db.collection('metamorfosis_posts').doc(recordId).set(...) }` no aparece en la nueva versión.
- `biometrics.ts` con su Cloud Function deshabilitada queda obsoleto: `AnaliticaIMR.tsx` migra al nuevo `computeImr` o usa `calculateSPEC705` local si solo necesita simulaciones admin sin red.

### Sub-spec 4.3 — Limpiar `MetamorfosisCalculator.tsx`

- Reemplazar el `type IMRResult` local (con `TODO(SPEC-004)`) por `import type { ImrResult } from '../../lib/types/user'` (definido en SPEC-005).
- Mapear el body del fetch al nuevo shape de `/api/calculate-imr`.

## Criterios de aceptación

- [ ] Sub-spec 4.0: Carlos confirma estado de `calculateIMRv2` en GCP (viva/muerta) y elige opción A o B con razón documentada.
- [ ] `src/lib/imr/engine.ts` existe y exporta `computeImr(input): Promise<ImrResult>`. Impl según opción.
- [ ] `src/pages/api/calculate-imr.ts` reescrito: validación de inputs (400), cálculo, persistencia condicional si auth, devuelve `{success, result}`.
- [ ] `grep -n "calculateIMR\b" src/pages/api/calculate-imr.ts` no devuelve nada (solo `computeImr`).
- [ ] `grep -n "recordId" src/pages/api/calculate-imr.ts` no devuelve nada.
- [ ] `MetamorfosisCalculator.tsx` importa `ImrResult` desde `lib/types/user`, sin tipo local con TODO.
- [ ] `biometrics.ts` eliminado o re-exportando `computeImr` con shim de compatibilidad.
- [ ] Si user autenticado hace `POST /api/calculate-imr`, el doc `users/{uid}` se actualiza con `bio`, `imr.current`, `imr.history` array_union.
- [ ] La calculadora `/calculadora` muestra resultado real (no 503).
- [ ] Cálculo coherente: para `{heightCm:175, weightKg:75, waistCm:85, neckCm:38, age:35, gender:'male'}` el `imrScore` está entre 50 y 90.
- [ ] (Una vez ElenaApp implemente su consumo del mismo motor) cálculo idéntico cliente web vs cliente app para los mismos inputs.

## Pruebas

```sh
# Cálculo válido
curl -s -X POST https://metamorfosisvital.com.co/api/calculate-imr \
    -H 'Content-Type: application/json' \
    -d '{"heightCm":175,"currentWeightKg":75,"waistCircumferenceCm":85,"neckCircumferenceCm":38,"age":35,"gender":"male"}' \
    | python3 -m json.tool
# Esperado: 200 {success:true, result:{imrScore, label, ica, imc, tmb, metabolicAge, blocks, ffmi, whtr}}

# Inválido (falta heightCm)
curl -s -X POST https://metamorfosisvital.com.co/api/calculate-imr \
    -H 'Content-Type: application/json' \
    -d '{"currentWeightKg":75}' \
    -o /dev/null -w "%{http_code}\n"
# Esperado: 400

# UI
# Abrir https://metamorfosisvital.com.co/calculadora → cambiar inputs, ver imrScore actualizándose
```

## Riesgos / consideraciones

- **Cloud Function fría (Opción A).** Primer hit puede tardar 2-3s. Considerar `min_instances=1` en GCP si el costo lo permite.
- **Drift de motor (Opción B).** Si web y app implementan el cálculo independientemente, drift garantizado. Requiere disciplina de releases o monorepo.
- **Persistencia anónima.** Si un visitante no logueado calcula su IMR, no persistimos. Si después se registra (en /login o /quiz), el quiz inicial debe re-disparar el cálculo. SPEC-006 (onboarding) cierra ese flujo.
- **Versionado del motor.** `engineVersion` en `imr.history` permite saber qué fórmula calculó cada entry. Si cambia la fórmula, mantenemos compatibilidad histórica.
- **Latencia del proxy SSR (Opción A).** Web → Hostinger Node → CF GCP es dos hops. Ver si vale meter cache o pasar la CF directo desde el cliente con CORS.

## Commit

**Mensajes sugeridos:**

- `chore(spec-004a): registrar decisión de motor IMR (opción A/B)` (commit que añade un `docs/decisions/004-motor-imr.md` con el resultado de la investigación)
- `feat(spec-004b): motor IMR canónico via lib/imr/engine`
- `fix(spec-004c): /api/calculate-imr usa motor canónico, sin recordId`
- `refactor(spec-004d): MetamorfosisCalculator usa ImrResult del schema, biometrics.ts eliminado`

---

## Resultado

*(Pendiente de implementación.)*
