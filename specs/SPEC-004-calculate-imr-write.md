# SPEC-004 — Reescribir `/api/calculate-imr` (motor + cierre de write arbitrario)

**Estado:** 📝 Spec
**Fase:** 1
**Severidad:** CRÍTICO
**Fecha de creación:** 2026-05-08
**Última revisión:** 2026-05-09 (scope expandido tras descubrir que el endpoint llevaba tiempo roto)
**Autor:** Carlos Reyes
**Depende de:** SPEC-001 (build pasa con el stub temporal)

---

## Contexto

Lo que se vio inicialmente en la revisión de código:

- `metamorfosis-web/src/pages/api/calculate-imr.ts` aceptaba un campo `recordId` y, si venía, hacía `db.collection('metamorfosis_posts').doc(recordId).set(metadata, { merge: true })` sin autenticación. Permitía a cualquier visitante sobrescribir metadata de cualquier post real.

Lo que se descubrió al implementar SPEC-001 (intento de build local):

- El endpoint **importaba `calculateIMR` desde `src/utils/imr-engine.ts`**, pero ese símbolo no existe ahí. El engine actual exporta solo `calculateSPEC705`, con firma e input completamente distintos.
- Hay **tres "calculateIMR" distintos en el repo** que no se hablan entre sí:
  - `src/utils/imr-engine.ts` → `calculateSPEC705({ gender, age, weight, height, waist, bodyFat, fastingHours, dinnerHour, exerciseMinutes, sleepQuality, hydrationLitros, hydrationGoal, lastMealHour })` → devuelve `{ imr, zona, blocks, ffmi, whtr }`. Lo usa `IMRQuiz.tsx` directo del cliente.
  - `src/utils/biometrics.ts` → `calculateIMR({ peso, altura, grasa })` → es una función async que hace fetch a `PUBLIC_CLOUD_FUNCTION_URL` (Cloud Function externa marcada como "disabled" en `.env`). Lo usa `AnaliticaIMR.tsx` (admin).
  - `src/components/calculator/MetamorfosisCalculator.tsx` → función local `calculateIMR()` que es solo el handler que hace `fetch('/api/calculate-imr', ...)`. Lo usa la calculadora "PRO".
- `MetamorfosisCalculator.tsx` además importaba `IMRResult` desde `imr-engine.ts` — un tipo que no se exporta. Y los campos que el componente lee del response (`imrScore`, `label`, `ica`) no coinciden con ninguno de los outputs reales del engine.
- Conclusión: la **calculadora PRO no funcionaba en producción desde el rename del engine**. No se notaba porque el sitio se publicaba como estático y la API nunca corría.

Para desbloquear el build de SPEC-001, el endpoint quedó como stub que devuelve 503. Esta spec lo reescribe correctamente.

## Problema

Tres problemas mezclados en el mismo archivo y sus dependencias:

1. **El endpoint no funciona** (import de función inexistente). La calculadora PRO está rota.
2. **El endpoint, cuando funcionaba, permitía writes arbitrarios** a `metamorfosis_posts` sin auth, vía `recordId`.
3. **Los tipos están inconsistentes** entre el motor real (`calculateSPEC705`), el componente (`MetamorfosisCalculator`), el legacy (`biometrics.ts → calculateIMR` que hace fetch a Cloud Function deshabilitada) y los tipos que cada uno asume.

## Solución propuesta

Reescribir `/api/calculate-imr` como **endpoint puro de cálculo** (sin Firestore writes), montado sobre `calculateSPEC705`. Mapear el payload que envía `MetamorfosisCalculator.tsx` a la firma de `calculateSPEC705`. Tipar la respuesta para que `IMRResult` sea fuente única de verdad. Decidir el destino del `biometrics.ts` legacy.

**Decisiones clave:**

- **Motor único:** `calculateSPEC705` es el motor real y validado. Se usa en `IMRQuiz.tsx` y va a usarse también desde el endpoint. `biometrics.ts` con su Cloud Function deshabilitada queda obsoleto: si `AnaliticaIMR.tsx` lo necesita, migrarlo al mismo `calculateSPEC705`.
- **Mapeo de inputs:** la calculadora PRO envía campos que `calculateSPEC705` no usa (`neckCircumferenceCm`, `pathologies`) y omite otros que sí pide (`fastingHours`, `dinnerHour`, `exerciseMinutes`, `sleepQuality`, `hydrationLitros`, `lastMealHour`, `bodyFat`). Hay que decidir defaults y/o agregar inputs nuevos en el componente. Propuesta: defaults razonables en el endpoint para los campos faltantes y `bodyFat` calculado a partir de los perímetros (Navy method) si no viene explícito. Alternativa: añadir esos campos al UI de la calculadora PRO en otra spec.
- **Salida:** la respuesta queda con la forma que el componente ya consume — `{ imrScore, label, ica, ... }` — mapeando del output de `calculateSPEC705` (`{ imr, zona, blocks, ffmi, whtr }`). Se exporta el tipo `IMRResult` desde `imr-engine.ts` para que sea fuente única.
- **Sin escritura a Firestore.** Si más adelante se quiere logging anónimo de cálculos, se abre una spec dedicada con colección `imr_calculations` y rate limiting.

## Plan de implementación

1. **Decidir mapeo de inputs.** Para esta spec uso defaults razonables; documentado en código:
   - `neckCircumferenceCm` → ignorado (no lo usa SPEC-70.5).
   - `pathologies` → ignorado (no lo usa SPEC-70.5).
   - `bodyFat` → si no viene, calcular con fórmula Navy (Hodgdon-Beckett) desde `waistCircumferenceCm`, `neckCircumferenceCm`, `heightCm` (y `hipCircumferenceCm` para mujeres). El motor lo usa para FFMI.
   - `fastingHours` → 12 (default neutro).
   - `dinnerHour` → 19 (default).
   - `exerciseMinutes` → 30.
   - `sleepQuality` → 0.7.
   - `hydrationLitros` → 2; `hydrationGoal` → 3.
   - `lastMealHour` → 19.

2. **Exportar `IMRResult` desde `src/utils/imr-engine.ts`:**
   ```ts
   export type IMRResult = {
       imrScore: number;       // 0-100
       label: string;          // "OPTIMIZADO" | "EFICIENTE" | "FUNCIONAL" | "INESTABLE" | "DETERIORADO"
       ica: number;            // ICA = waist / height ratio
       imc: number;            // BMI
       tmb: number;            // Tasa metabólica basal (Mifflin-St Jeor)
       metabolicAge: number;   // Estimación
       blocks: { E: number; M: number; C: number };
       ffmi: number;
       whtr: number;
   };
   ```

3. **Reescribir `src/pages/api/calculate-imr.ts`** completo (reemplazando el stub):
   ```ts
   import type { APIRoute } from 'astro';
   import { calculateSPEC705 } from '../../utils/imr-engine';
   import type { IMRResult } from '../../utils/imr-engine';

   export const prerender = false;

   function calculateBodyFatNavy(input: {
       waistCm: number;
       neckCm: number;
       heightCm: number;
       hipCm?: number;
       gender: 'male' | 'female';
   }): number {
       const { waistCm, neckCm, heightCm, hipCm, gender } = input;
       if (gender === 'male') {
           return 86.010 * Math.log10(waistCm - neckCm) - 70.041 * Math.log10(heightCm) + 36.76;
       } else {
           const hip = hipCm ?? waistCm * 1.05;
           return 163.205 * Math.log10(waistCm + hip - neckCm) - 97.684 * Math.log10(heightCm) - 78.387;
       }
   }

   export const POST: APIRoute = async ({ request }) => {
       try {
           const data = await request.json();

           // Validación de inputs requeridos
           const required = ['heightCm', 'currentWeightKg', 'waistCircumferenceCm', 'neckCircumferenceCm'];
           for (const k of required) {
               if (typeof data[k] !== 'number' || !Number.isFinite(data[k])) {
                   return new Response(JSON.stringify({ error: `Campo inválido: ${k}` }), {
                       status: 400,
                       headers: { 'Content-Type': 'application/json' },
                   });
               }
           }

           const heightCm: number = data.heightCm;
           const weightKg: number = data.currentWeightKg;
           const waistCm: number = data.waistCircumferenceCm;
           const neckCm: number = data.neckCircumferenceCm;
           const hipCm: number | undefined = typeof data.hipCircumferenceCm === 'number' ? data.hipCircumferenceCm : undefined;
           const age: number = typeof data.age === 'number' ? data.age : 40;
           const gender: 'male' | 'female' = data.gender === 'female' ? 'female' : 'male';

           const bodyFat = typeof data.bodyFat === 'number'
               ? data.bodyFat
               : calculateBodyFatNavy({ waistCm, neckCm, heightCm, hipCm, gender });

           const spec = calculateSPEC705({
               gender,
               age,
               weight: weightKg,
               height: heightCm,
               waist: waistCm,
               bodyFat,
               fastingHours: data.fastingHours ?? 12,
               dinnerHour: data.dinnerHour ?? 19,
               exerciseMinutes: data.exerciseMinutes ?? 30,
               sleepQuality: data.sleepQuality ?? 0.7,
               hydrationLitros: data.hydrationLitros ?? 2,
               hydrationGoal: data.hydrationGoal ?? 3,
               lastMealHour: data.lastMealHour ?? 19,
           });

           // Métricas derivadas que la UI espera
           const heightM = heightCm / 100;
           const imc = weightKg / (heightM * heightM);
           const ica = waistCm / heightCm;
           const tmb = gender === 'male'
               ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
               : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
           const metabolicAge = Math.max(18, Math.round(age + (1 - spec.imr / 100) * 20));

           const result: IMRResult = {
               imrScore: spec.imr,
               label: spec.zona,
               ica,
               imc,
               tmb,
               metabolicAge,
               blocks: {
                   E: parseFloat(spec.blocks.E),
                   M: parseFloat(spec.blocks.M),
                   C: parseFloat(spec.blocks.C),
               },
               ffmi: parseFloat(spec.ffmi),
               whtr: parseFloat(spec.whtr),
           };

           return new Response(JSON.stringify({ success: true, result }), {
               status: 200,
               headers: {
                   'Content-Type': 'application/json',
                   'Cache-Control': 'no-cache',
               },
           });
       } catch (error) {
           console.error('IMR engine error:', error);
           return new Response(JSON.stringify({ error: 'Error interno del motor IMR' }), {
               status: 500,
               headers: { 'Content-Type': 'application/json' },
           });
       }
   };
   ```

4. **Limpiar `MetamorfosisCalculator.tsx`:**
   - Reemplazar el `type IMRResult` local (declarado durante SPEC-001 como stub) por `import type { IMRResult } from '../../utils/imr-engine'`.
   - Eliminar el `// TODO(SPEC-004)` comment.

5. **Decidir destino de `src/utils/biometrics.ts`:**
   - Si `AnaliticaIMR.tsx` lo usa solo para simulaciones admin (poblar estadísticas con datos sintéticos), migrarlo a `calculateSPEC705` o eliminarlo.
   - Decisión propuesta: eliminar `biometrics.ts` y migrar `AnaliticaIMR.tsx` al motor único. La Cloud Function externa está marcada disabled, así que no perdemos funcionalidad real.
   - Si la migración de `AnaliticaIMR` es no trivial, partirla en SPEC-004b (commit separado).

6. **Borrar el bloque `recordId`:** ya no aparece en la nueva versión (la solución original de la spec). Verificar con `grep`.

7. **Borrar `PUBLIC_CLOUD_FUNCTION_URL` del `.env`** si ya no la usa nada después de migrar `biometrics.ts`. Anotar en commit.

## Criterios de aceptación

- [ ] `npm run build` termina sin error.
- [ ] `grep -n "calculateIMR" metamorfosis-web/src/pages/api/calculate-imr.ts` no devuelve nada (solo `calculateSPEC705`).
- [ ] `grep -n "recordId" metamorfosis-web/src/pages/api/calculate-imr.ts` no devuelve nada.
- [ ] `import type { IMRResult } from '../../utils/imr-engine'` funciona en `MetamorfosisCalculator.tsx`.
- [ ] La calculadora PRO en `/calculadora` muestra resultados reales (no error 503) al variar inputs.
- [ ] Cálculo coherente: para `{ heightCm:175, currentWeightKg:75, waistCircumferenceCm:85, neckCircumferenceCm:38, age:35, gender:'male' }` el endpoint devuelve `imrScore` razonable (entre 50 y 90).
- [ ] Inputs faltantes devuelven 400 (no 500).
- [ ] No queda código consumiendo `PUBLIC_CLOUD_FUNCTION_URL` (o se documenta por qué se mantiene).

## Pruebas

```sh
cd metamorfosis-web
npm run build
PORT=4321 npm start &
sleep 3

# Cálculo válido
curl -s -X POST http://localhost:4321/api/calculate-imr \
    -H 'Content-Type: application/json' \
    -d '{"heightCm":175,"currentWeightKg":75,"waistCircumferenceCm":85,"neckCircumferenceCm":38,"age":35,"gender":"male"}' \
    | python3 -m json.tool
# Esperado: { success: true, result: { imrScore, label, ica, imc, tmb, metabolicAge, blocks, ffmi, whtr } }

# Inválido
curl -s -X POST http://localhost:4321/api/calculate-imr \
    -H 'Content-Type: application/json' \
    -d '{"currentWeightKg":75}' \
    -o /dev/null -w "%{http_code}\n"
# Esperado: 400

# recordId ya no escribe
curl -s -X POST http://localhost:4321/api/calculate-imr \
    -H 'Content-Type: application/json' \
    -d '{"heightCm":175,"currentWeightKg":75,"waistCircumferenceCm":85,"neckCircumferenceCm":38,"recordId":"victim"}' \
    | python3 -m json.tool
# Esperado: 200; verificar que metamorfosis_posts/victim no fue tocado en Firestore.

# UI manual
# Abrir http://localhost:4321/calculadora
# Cambiar peso/altura/cintura → ver que imrScore cambia con debounce
```

## Riesgos / consideraciones

- **El motor SPEC-70.5 espera campos de hábitos** (ayuno, cena, sueño, ejercicio, hidratación) que la calculadora PRO no captura hoy. Con defaults el resultado va a estar sesgado hacia un perfil "promedio". Si Carlos quiere un cálculo más fino, agregar inputs en otra spec o ofrecer un toggle "modo simple" / "modo extendido".
- **`bodyFat` calculado por Navy** es una aproximación; no reemplaza una bioimpedancia. Documentar en la UI.
- **Eliminar `biometrics.ts`** rompe `AnaliticaIMR.tsx` si aún lo importa. Verificar con grep antes y migrar en el mismo commit (o partir en sub-spec).
- **Sin rate limit** todavía. Está en backlog (Fase 3). Aceptable para volumen actual.
- **No hay logging anónimo** de cálculos. Si lo querés para analítica, abrí SPEC-006 con colección dedicada.

## Commit

**Mensaje sugerido:**
```
fix(spec-004): reescribir /api/calculate-imr sobre calculateSPEC705

- Endpoint puro: recibe inputs, devuelve resultado, no toca Firestore
- Motor unificado: usa calculateSPEC705 de imr-engine.ts (antes intentaba
  importar una función inexistente, llevaba tiempo rota)
- Body fat por método Navy si no se provee explícito
- Tipo IMRResult exportado desde imr-engine.ts; MetamorfosisCalculator.tsx
  pasa a usarlo en lugar del stub local
- Validación de inputs numéricos requeridos: 400 si faltan
- Eliminada la rama recordId que permitía writes anónimos a posts
- (Pendiente decidir: borrar biometrics.ts si AnaliticaIMR puede migrar)

Cierra specs/SPEC-004-calculate-imr-write.md
```

---

## Resultado

*(Pendiente de implementación.)*
