# SPEC-002 — Autenticación en `/api/admin/cleanup`

**Estado:** 📝 Spec
**Fase:** 1
**Severidad:** CRÍTICO
**Fecha de creación:** 2026-05-08
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

*(Pendiente de implementación.)*
