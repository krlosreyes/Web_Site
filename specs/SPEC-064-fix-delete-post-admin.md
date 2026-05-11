# SPEC-064 — Fix botón "Eliminar artículo" en admin PostList

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — fix de bug bloqueante
**Severidad:** ALTO (Carlos no podía borrar artículos)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes

---

## Contexto

Carlos reportó que el botón "Eliminar" en la lista de artículos del
dashboard admin no funcionaba: hacer click + confirmar → no pasaba nada
visible, el artículo seguía ahí.

## Causa raíz

Dos bugs combinados, ambos documentados en CLAUDE.md sección 4 como reglas
inquebrantables que NO se estaban cumpliendo en `PostList.handleDelete`:

### 1. Falta de `Content-Type: application/json`

El fetch DELETE era:

```ts
fetch(`/api/admin/posts?id=${id}`, { method: 'DELETE' });
```

Astro 6 con `output: 'server'` tiene CSRF protection activada por default.
Bloquea cualquier POST/PUT/DELETE/PATCH sin el header
`Content-Type: application/json` con **403 antes de llegar al handler**.

Regla del proyecto (CLAUDE.md sección 4):
> Astro 6 + POST/PUT a `/api/*` desde JS: SIEMPRE incluir
> `Content-Type: application/json` en el header. Sin él, Astro 6 lo rechaza
> con 403 CSRF antes del handler, y `fetch` con 4xx no lanza excepción —
> el `catch` no se entera.

### 2. Sin manejo visible de errores

El cliente hacía:

```ts
if (response.ok) fetchPosts();
```

Pero si `response.ok` era `false` (403 CSRF en este caso), no ejecutaba el
refresh **ni mostraba error al usuario**. El usuario veía la UI inalterada
y asumía que el botón no funcionaba.

Regla del proyecto:
> `fetch` con respuesta 4xx/5xx: SIEMPRE chequear `res.ok` explícitamente
> y loguear; nunca asumir que `await fetch(...)` sin error = éxito.

## Solución

### Cliente: `components/admin/PostList.tsx`

```ts
const response = await fetch(`/api/admin/posts?id=${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
});

if (!response.ok) {
    let errMsg = `Error ${response.status}`;
    try {
        const body = await response.json();
        if (body?.error) errMsg = `${errMsg}: ${body.error}`;
    } catch {
        // body no es JSON parseable, mantenemos el status
    }
    console.error('[PostList.handleDelete] No OK:', errMsg);
    alert(`No se pudo eliminar el artículo. ${errMsg}`);
    return;
}
fetchPosts();
```

Cambios:
- Agrego `Content-Type: application/json` para pasar el CSRF check de Astro.
- Agrego `credentials: 'include'` para ser explícito sobre la cookie
  de sesión admin (defense in depth — mismo-origen funciona sin esto, pero
  alinea con el patrón usado en otros endpoints admin).
- Si `!response.ok`: log + alert con detalle del status y mensaje del body.
- Si network error: catch existente + alert visible.

### Servidor: `pages/api/admin/posts.ts` (DELETE handler)

```ts
} catch (error) {
    console.error('[posts.DELETE] Error:', error);
    const msg = error instanceof Error ? error.message : 'Error al borrar';
    return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
}
```

Cambios:
- `console.error('[posts.DELETE] Error:', error)`: log server-side para
  diagnosticar si vuelve a fallar. Antes el catch era silencioso.
- Mensaje de error con detalle (`error.message`) en lugar de string fijo
  "Error al borrar". El cliente lo lee y lo muestra al usuario.
- Header `Content-Type: application/json` en la respuesta de error para
  que `response.json()` del cliente funcione.

## Audit de otros fetch del proyecto

Revisé TODOS los `fetch()` con métodos non-GET en componentes y pages:

| Componente | Método | Content-Type | Estado |
|---|---|---|---|
| `AdminLogin.tsx` | POST | ✅ | OK |
| `ArticleEditor.tsx` upload-image | POST | ✅ | OK |
| `ForumModeration.tsx` delete | DELETE | ✅ | OK |
| `ForumModeration.tsx` recategorize | POST | ✅ | OK |
| `ForumModeration.tsx` pin | POST | ✅ | OK |
| `LeadList.tsx` update | PUT | ✅ | OK |
| `NotificationBell.tsx` (×2) | POST | ✅ | OK |
| `IMRQuiz.tsx` onboard | POST | ✅ | OK |
| `PostReactions.tsx` react | POST | ✅ | OK |
| `Navbar.astro` logout | POST | ✅ | OK |
| `ForumEngine.tsx` (varios) | POST | ✅ | OK |
| **`PostList.tsx` delete** | **DELETE** | **❌ → ✅ FIX** | Era el único roto |

`PostList.handleDelete` era el único caso en el codebase que olvidaba el
header. El resto del proyecto cumple la regla.

## Criterios de aceptación

- [x] `PostList.handleDelete` incluye `Content-Type: application/json`.
- [x] `PostList.handleDelete` muestra `alert()` con el error si `!response.ok`.
- [x] Endpoint DELETE de `posts.ts` loguea el error con `console.error`.
- [x] Endpoint DELETE retorna mensaje detallado (`error.message`) en el body.
- [x] Auditoría confirma que el resto del codebase cumple la regla CLAUDE.md.
- [ ] Post-deploy: en `/admin/dashboard` → tab Artículos → click "Eliminar" en cualquier artículo → confirmar → el artículo desaparece de la lista (200 OK + fetchPosts refresca).

## Pruebas manuales

1. Login admin.
2. Tab "Gestión de Artículos".
3. Click el botón "Eliminar" (icono basurero) en cualquier artículo.
4. Confirmar el `confirm()` del browser.
5. **Esperado:** el artículo desaparece de la lista, el contador se actualiza.
6. **Si falla:** ahora aparece un `alert()` con el mensaje de error específico
   (ej. "Error 401: Unauthorized"), no silencio.

Para probar el error path:
- Desloguearse y luego forzar un fetch DELETE manualmente desde DevTools →
  debe responder 401 y el alert mostrar "Error 401".

## Riesgos y trade-offs

- **`alert()` nativo del browser**: feo visualmente pero efectivo para un
  panel admin de single-user. Si en el futuro hay múltiples admins,
  reemplazar por toast UI consistente.
- **`error.message` puede exponer detalles internos**: en producción es
  aceptable porque solo Carlos (admin autenticado) ve estos errores. Si
  el panel admin se abre a más users, sanitizar los mensajes.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos modificados:**
- `metamorfosis-web/src/components/admin/PostList.tsx` —
  `handleDelete` con `Content-Type`, `credentials: 'include'`, manejo
  de `!response.ok` con alert + log.
- `metamorfosis-web/src/pages/api/admin/posts.ts` — DELETE handler
  con `console.error` server-side y body de error detallado.

**Decisiones:**
- `alert()` en lugar de toast custom: panel admin sin librería de toast
  todavía. Aceptable para single-user.
- `error.message` en el body: ayuda a debug futuro. Solo admin ve esto.
- No tocar otros endpoints: el audit confirmó que el resto cumple la
  regla.

**Recomendación operativa:** después del push, Carlos puede borrar los
10 artículos viejos sin friction y empezar a regenerar con los prompts
nuevos (SPEC-061 + SPEC-063 garantizan slugs limpios + estructura visual).

Sin desviaciones del plan.
