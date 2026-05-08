# SPEC-004 — Cerrar write arbitrario en `/api/calculate-imr`

**Estado:** 📝 Spec
**Fase:** 1
**Severidad:** CRÍTICO
**Fecha de creación:** 2026-05-08
**Autor:** Carlos Reyes
**Depende de:** ninguna

---

## Contexto

`metamorfosis-web/src/pages/api/calculate-imr.ts:34-46`:

```ts
if (data.recordId) {
    try {
        const docRef = db.collection('metamorfosis_posts').doc(data.recordId);
        await docRef.set({
            metadata: metadata,
            imr_report: result,
            last_calculation_type: 'IMR_V01'
        }, { merge: true });
    } catch (fsError) {
        console.error('Firestore Injection Error:', fsError);
    }
}
```

El endpoint es público (no hay verificación de auth — está bien para que el quiz funcione anónimo). Pero acepta un campo `recordId` arbitrario en el body, y si se provee, escribe a `metamorfosis_posts/<recordId>` con datos calculados.

## Problema

Cualquier visitante puede mandar `POST /api/calculate-imr` con `recordId` igual al ID de cualquier post existente, y sobrescribir (vía `merge: true`) los campos `metadata`, `imr_report` y `last_calculation_type`. Esto:

- Corrompe contenido público (los posts son los artículos de la biblioteca).
- Permite spam de cálculos arbitrarios bajo IDs reales.
- Mezcla dos cosas que no tienen por qué estar en la misma colección: artículos editoriales (`metamorfosis_posts`) y cálculos de IMR.

## Solución propuesta

**Eliminar la rama `recordId` de este endpoint.** El cálculo IMR es una operación de lectura (calcula y devuelve el resultado); la persistencia debe vivir en otro lugar:

- Si el usuario está logueado (`/quiz` con auth), `IMRQuiz.tsx` ya guarda en `users/{email}` desde el cliente. Mantener.
- Si quisiéramos persistencia anónima para analítica, abrir una colección dedicada (ej. `imr_calculations`) con security rules que solo permitan create, no read/update/delete públicos. Pero esto es scope de otra spec si surge la necesidad.

El endpoint `calculate-imr.ts` queda como pure compute: recibe inputs, devuelve resultado, **no toca Firestore**.

## Plan de implementación

1. **Modificar `metamorfosis-web/src/pages/api/calculate-imr.ts`**:
   - Eliminar el bloque `if (data.recordId) { ... }` y el import de `db`.
   - Versión final:
     ```ts
     import type { APIRoute } from 'astro';
     import { calculateIMR } from '../../utils/imr-engine';

     export const prerender = false;

     export const POST: APIRoute = async ({ request }) => {
       try {
         const data = await request.json();

         const result = calculateIMR({
           heightCm: data.heightCm,
           currentWeightKg: data.currentWeightKg,
           waistCircumferenceCm: data.waistCircumferenceCm,
           neckCircumferenceCm: data.neckCircumferenceCm,
           pathologies: data.pathologies || [],
           age: data.age || 40,
           gender: data.gender || 'male',
         });

         const metadata = {
           imr_score: result.imrScore,
           imr_label: result.label,
           metabolic_age_est: result.metabolicAge,
           ica_ratio: result.ica,
           bmi_ref: result.imc,
           tmb_ref: result.tmb,
           updated_at: new Date().toISOString(),
         };

         return new Response(JSON.stringify({ success: true, result, metadata }), {
           status: 200,
           headers: {
             'Content-Type': 'application/json',
             'Cache-Control': 'no-cache',
           },
         });
       } catch (error) {
         console.error('IMR Critical Engine Error:', error);
         return new Response(JSON.stringify({ error: 'Servicio temporalmente no disponible' }), {
           status: 500,
           headers: { 'Content-Type': 'application/json' },
         });
       }
     };
     ```

2. **Validar inputs mínimamente.** Si `heightCm`, `currentWeightKg`, `waistCircumferenceCm` o `neckCircumferenceCm` faltan o no son números, devolver 400. Esto previene NaN que pueda hacer crashear el motor:
   ```ts
   const required = ['heightCm', 'currentWeightKg', 'waistCircumferenceCm', 'neckCircumferenceCm'];
   for (const k of required) {
     if (typeof data[k] !== 'number' || !Number.isFinite(data[k])) {
       return new Response(JSON.stringify({ error: `Campo inválido: ${k}` }), {
         status: 400,
         headers: { 'Content-Type': 'application/json' },
       });
     }
   }
   ```

3. **Buscar callers de `recordId`** en el frontend:
   ```sh
   grep -rn "recordId" metamorfosis-web/src
   ```
   Si algún componente está enviando `recordId` (ej. `MetamorfosisCalculator.tsx`), eliminar ese campo del body. Si no envía, no hay que tocar nada del frontend.

4. **Si surge una necesidad legítima de logging anónimo** (analítica de quizzes), abrir SPEC-004b para crear `/api/log-imr-calculation` con escritura a colección dedicada y rate limit. Fuera del scope de esta spec.

## Criterios de aceptación

- [ ] El handler `POST /api/calculate-imr` no contiene ninguna llamada a Firestore.
- [ ] El import de `db` (`firebaseAdmin`) está eliminado.
- [ ] `grep -n "recordId" metamorfosis-web/src/pages/api/calculate-imr.ts` no devuelve nada.
- [ ] Inputs faltantes devuelven 400 (no 500 con stacktrace).
- [ ] El cálculo sigue devolviendo el mismo `result` y `metadata` que antes para inputs válidos.
- [ ] No hay regresión en `MetamorfosisCalculator.tsx` ni `IMRQuiz.tsx` (siguen funcionando).

## Pruebas

```sh
cd metamorfosis-web && npm run build
npm run dev &
sleep 3

# 1. Cálculo válido
curl -s -X POST http://localhost:4321/api/calculate-imr \
    -H 'Content-Type: application/json' \
    -d '{"heightCm":175,"currentWeightKg":75,"waistCircumferenceCm":85,"neckCircumferenceCm":38,"age":35,"gender":"male"}' \
    | python3 -m json.tool
# Esperado: { success: true, result: {...}, metadata: {...} }

# 2. Input inválido (falta heightCm)
curl -s -X POST http://localhost:4321/api/calculate-imr \
    -H 'Content-Type: application/json' \
    -d '{"currentWeightKg":75,"waistCircumferenceCm":85,"neckCircumferenceCm":38}' \
    -o /dev/null -w "%{http_code}\n"
# Esperado: 400

# 3. recordId ya no escribe en Firestore
# Antes hubiera sobrescrito metamorfosis_posts/test-victim
curl -s -X POST http://localhost:4321/api/calculate-imr \
    -H 'Content-Type: application/json' \
    -d '{"heightCm":175,"currentWeightKg":75,"waistCircumferenceCm":85,"neckCircumferenceCm":38,"recordId":"test-victim"}'
# Esperado: 200 con resultado, pero ningún cambio en Firestore.
# Verificar manualmente en Firebase Console que metamorfosis_posts/test-victim no existe o no fue tocado.

# 4. Verificar UI quiz
# Abrir http://localhost:4321/quiz, completar, ver que termina y guarda en users/<email>
```

## Riesgos / consideraciones

- **Pérdida de logging si alguien dependía del `recordId`.** Lo dudo: la rama está envuelta en try/catch silencioso y los errores nunca se propagaron, lo cual sugiere que se agregó como experimento y nunca se validó. Si Carlos confirma que no se usa, listo. Si se usa, abrir SPEC-004b.
- **Validación de inputs.** El motor `calculateIMR` ya tolera valores ausentes (`pathologies || []`, `age || 40`). El check explícito de los 4 campos numéricos es defensa en profundidad.
- **Rate limiting.** Esta spec NO agrega rate limit al endpoint público. Está en backlog (Fase 3) — el cálculo es barato y no tiene side effects ahora, así que el riesgo de abuso baja mucho.

## Commit

**Mensaje sugerido:**
```
fix(spec-004): eliminar write arbitrario en /api/calculate-imr

- Quitar la rama recordId que permitía sobrescribir cualquier post
  de metamorfosis_posts sin autenticación
- Eliminar import de firebaseAdmin (endpoint queda como pure compute)
- Validar inputs numéricos requeridos: 400 si faltan o no son finitos

Cierra specs/SPEC-004-calculate-imr-write.md
```

---

## Resultado

*(Pendiente de implementación.)*
