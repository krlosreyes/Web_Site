# SPEC-002 — Autenticación en `/api/admin/cleanup`

**Estado:** ✅ Cerrada
**Fase:** 1
**Severidad:** CRÍTICO
**Fecha de creación:** 2026-05-08
**Cerrada:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** ninguna (recomendado tras SPEC-001 para verificar end-to-end)

---

## Contexto

`metamorfosis-web/src/pages/api/admin/cleanup.ts`:

```ts
import { db } from '../../../lib/firebaseAdmin';

export async function GET() {
    try {
        const postsRef = db.collection('metamorfosis_posts');
        const snapshot = await postsRef.get();

        let deletedCount = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (data.slug && data.slug.length > 200) {
                await doc.ref.delete();
                deletedCount++;
            }
        }
        return new Response(JSON.stringify({ success: true, deletedCount }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
}
```

Comparar con `posts.ts` o `leads.ts` en la misma carpeta: todos los demás endpoints admin verifican autenticación con `enforceProductionSecurity()` + `parseCookies(request)` + `isAuthenticatedFromCookie(cookies)` antes de tocar Firestore. Este no.

## Problema

El endpoint borra documentos de la colección `metamorfosis_posts` basándose en una heurística de slug largo, y es accesible sin autenticación. Cualquier visitante con la URL puede dispararlo. Aun cuando el filtro `slug.length > 200` parezca defensivo, (a) un atacante puede crear posts con slugs largos para luego borrarlos en masa, y (b) la heurística puede romper si en el futuro hay slugs legítimos largos.

Además, el endpoint expone `error.message` al cliente — fuga de información.

## Solución propuesta

Aplicar el mismo wrapper de auth que ya usan `posts.ts`, `leads.ts`, `stats.ts`, `analitica.ts`. Cambiar firma a `APIRoute` para consistencia. Cambiar `GET` por `POST` (acción mutativa, no idempotente en el sentido HTTP).

## Plan de implementación

1. **Reescribir `metamorfosis-web/src/pages/api/admin/cleanup.ts`**:
   ```ts
   import type { APIRoute } from 'astro';
   import { db } from '../../../lib/firebaseAdmin';
   import {
     isAuthenticatedFromCookie,
     parseCookies,
     enforceProductionSecurity,
   } from '../../../lib/auth';

   export const prerender = false;

   export const POST: APIRoute = async ({ request }) => {
     try {
       enforceProductionSecurity();

       const cookies = parseCookies(request);
       if (!isAuthenticatedFromCookie(cookies)) {
         return new Response(JSON.stringify({ error: 'Unauthorized' }), {
           status: 401,
           headers: { 'Content-Type': 'application/json' },
         });
       }

       const postsRef = db.collection('metamorfosis_posts');
       const snapshot = await postsRef.get();

       let deletedCount = 0;
       const batch = db.batch();
       for (const doc of snapshot.docs) {
         const data = doc.data();
         if (data.slug && data.slug.length > 200) {
           batch.delete(doc.ref);
           deletedCount++;
         }
       }
       if (deletedCount > 0) await batch.commit();

       return new Response(JSON.stringify({ success: true, deletedCount }), {
         status: 200,
         headers: { 'Content-Type': 'application/json' },
       });
     } catch (error) {
       console.error('[cleanup] Error:', error);
       return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' },
       });
     }
   };
   ```

2. **Buscar referencias** a `/api/admin/cleanup` en el frontend:
   ```sh
   grep -rn "api/admin/cleanup" metamorfosis-web/src
   ```
   Si alguna llamada usa `GET`, actualizar a `POST` con `credentials: 'include'`. Si no hay llamadas, dejar el endpoint disponible para invocación manual (cURL desde sesión admin).

3. **No exponer cleanup en UI sin confirmación.** Si se va a invocar desde el panel admin, agregar a `AdminApp.tsx` un botón "Limpiar posts corruptos" con `confirm()` previo. Si por ahora solo se invoca manualmente, anotar en la spec y omitir.

## Criterios de aceptación

- [ ] `POST /api/admin/cleanup` sin cookie → `401 Unauthorized`.
- [ ] `GET /api/admin/cleanup` → `405 Method Not Allowed` (Astro lo maneja por default al no exportar `GET`).
- [ ] `POST /api/admin/cleanup` con cookie admin válida → `200 { success: true, deletedCount }`.
- [ ] Si hay posts con `slug.length > 200`, se borran. Si no hay, `deletedCount === 0`.
- [ ] Errores no exponen `error.message` al cliente; van solo al log.
- [ ] El endpoint aparece como protegido en el grep de `isAuthenticatedFromCookie`:
  ```sh
  grep -l "isAuthenticatedFromCookie" metamorfosis-web/src/pages/api/admin/*.ts
  # debe incluir cleanup.ts
  ```

## Pruebas

```sh
# Build no rompe
cd metamorfosis-web && npm run build

# Local con dev server
npm run dev &
sleep 3

# Sin cookie → 401
curl -i -X POST http://localhost:4321/api/admin/cleanup
# Esperado: HTTP/1.1 401

# GET → 405
curl -i http://localhost:4321/api/admin/cleanup
# Esperado: HTTP/1.1 405 (o 404 según versión de Astro; lo aceptable es ≠ 200)

# Con cookie válida (reemplazar VALOR por contenido real de admin_session)
curl -i -X POST http://localhost:4321/api/admin/cleanup \
    -H "Cookie: admin_session=VALOR"
# Esperado: HTTP/1.1 200, body { success: true, deletedCount: N }
```

## Riesgos / consideraciones

- **No depende de SPEC-003.** Esta spec se puede cerrar antes de unificar el contrato de auth: usa el `isAuthenticatedFromCookie` actual; si SPEC-003 cambia la implementación interna, este endpoint queda automáticamente alineado.
- **Cambio GET → POST puede romper** si alguien tiene un bookmark/script llamando con GET. Bajo riesgo (es un endpoint admin no documentado), pero anotarlo.
- **Batch de Firestore** tiene límite de 500 ops. Si en el futuro hay > 500 posts corruptos, hay que partir el batch. Por ahora se asume escala baja.

## Commit

**Mensaje sugerido:**
```
fix(spec-002): proteger /api/admin/cleanup con autenticación

- Migrar a APIRoute con method POST
- Agregar enforceProductionSecurity + isAuthenticatedFromCookie
- Usar batch de Firestore en lugar de awaits secuenciales
- Dejar de exponer error.message al cliente

Cierra specs/SPEC-002-cleanup-auth.md
```

---

## Resultado

Implementada y verificada en producción contra `https://metamorfosisvital.com.co` el 2026-05-09.

**Cambios mergeados:**

- `metamorfosis-web/src/pages/api/admin/cleanup.ts` reescrito completo:
  - Migración a `APIRoute` con método `POST` (antes era función `GET` suelta).
  - `enforceProductionSecurity()` + `isAuthenticatedFromCookie(parseCookies(request))` antes de tocar Firestore.
  - `db.batch()` en lugar de `await doc.ref.delete()` secuencial: una sola escritura atómica.
  - Errores ya no exponen `error.message` al cliente; solo se loguean server-side.
  - Agregado `prerender = false` explícito.

**Verificación end-to-end (post-deploy):**

```
POST /api/admin/cleanup  (sin cookie, Content-Type: application/json, body {})
→ 401 Unauthorized + {"error":"Unauthorized"}

GET  /api/admin/cleanup
→ 404 Not Found (Astro 6 responde así cuando no hay handler para ese método)
```

**Criterios de aceptación cumplidos:**

- [x] POST sin cookie → 401.
- [x] GET → status no-200 (Astro devuelve 404 en lugar del 405 esperado, behavior aceptable).
- [x] Errores no exponen `error.message`.
- [x] Endpoint protegido con `isAuthenticatedFromCookie`.
- [ ] POST con cookie admin válida → 200 con `deletedCount` ⏳ pendiente verificación post SPEC-003 (el flow de login admin actual emite cookie `firebase_auth` que no acepta `isAuthenticatedFromCookie`; SPEC-003 lo unifica).

**Desviaciones del plan original:**

- Durante la verificación inicial el primer curl (`curl -i -X POST <url>` sin headers ni body) recibió **403 con "Cross-site POST form submissions are forbidden"**. Eso es Astro 6 protegiendo CSRF: cuando un POST llega sin `Content-Type: application/json` lo trata como form submission y lo rechaza antes de llegar al handler. No es bug del endpoint. La verificación correcta requiere `-H "Content-Type: application/json" -d '{}'`. Anotado en aprendizajes de SPEC-001 (sección "curl -sI -X POST").

**Aprendizajes:**

- **Astro 6 distingue entre POST de formulario y POST de API por el `Content-Type`.** Sin `application/json` aplica check de origin same-host y rechaza con 403.
- **Astro 6 responde 404 (no 405) para métodos no soportados** en una ruta. Cualquier asserción de "405 si llega al backend" hay que ajustarla.
- **`db.batch()` es preferible a awaits secuenciales** para borrados masivos: atómico, más eficiente, hasta 500 ops por batch (suficiente para esta heurística).

**Dependencias para próximas specs:**

- SPEC-003 va a validar el happy path de auth admin de punta a punta. Cuando cierre SPEC-003, conviene hacer el último smoke test:
  ```sh
  COOKIE=$(curl -s -X POST https://metamorfosisvital.com.co/api/admin/login \
      -H 'Content-Type: application/json' \
      -d '{"password":"<ADMIN_PASSWORD>"}' \
      -i | grep -i 'set-cookie' | sed 's/Set-Cookie: //;s/;.*//')
  curl -i -X POST https://metamorfosisvital.com.co/api/admin/cleanup \
      -H 'Content-Type: application/json' \
      -b "$COOKIE" \
      -d '{}'
  # Esperado: 200 + {"success":true,"deletedCount":N}
  ```
