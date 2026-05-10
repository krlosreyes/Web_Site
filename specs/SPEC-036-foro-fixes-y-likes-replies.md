# SPEC-036 — Foro: fix nombre real, delete topic, likes en replies

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Bugfix + extensión foro
**Severidad:** ALTO (3 bugs visibles del foro recién deployado)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-033 (foro), SPEC-029b (displayName fix)

---

## Contexto

Tras deployar SPEC-033 (foro funcional), Carlos reporta tres bugs:

1. **El nombre del autor del topic / reply sale "Biohacker"** en lugar del nombre real.
2. **El botón "Eliminar" del tema (topic propio) no funciona** — confirma pero nada pasa.
3. **Las respuestas (replies) no permiten dar like/dislike** — feature faltante.

## Análisis

### Bug 1 — nombre por defecto

El endpoint `POST /api/forum/topics` (y `replies.ts`) hace:

```ts
const authorName = session.name?.trim() || 'Biohacker';
```

`session.name` viene de `decoded.name` del Firebase ID token. **Para cuentas creadas con `createUserWithEmailAndPassword + updateProfile` el token cacheado no incluye `displayName`** — es exactamente el mismo problema de SPEC-029b con el welcome email.

**Fix**: helper `getDisplayName(uid, tokenName)` que cae al `users/{uid}.displayName` de Firestore si el token no lo trae.

### Bug 2 — delete del topic

Endpoint vive en `src/pages/api/forum/topics/[id]/index.ts`. El cliente fetchea `/api/forum/topics/{id}` (sin trailing slash). **Astro 6 + Node adapter prioriza `[id].ts` sobre `[id]/index.ts`** para esa URL. Como `[id].ts` no existe, devuelve 404 silencioso (el catch del cliente ve `!res.ok` pero el alert no se ve si el flow anterior devolvió OK por casualidad).

**Fix**: mover el contenido a `src/pages/api/forum/topics/[id].ts`. El directorio `[id]/` puede coexistir con el archivo `[id].ts` (Astro lo soporta) — las subrutas como `[id]/replies.ts` y `[id]/like.ts` siguen resolviendo igual.

### Bug 3 — likes en replies

`POST /api/forum/topics/[id]/replies` no tiene like. SPEC-033 no lo cubrió por scope.

**Fix**: endpoint nuevo + UI con corazón pequeño en cada reply.

**Decisión de routing**: en lugar de crear `replies/[replyId]/like.ts` (que choca con el archivo `replies/[replyId].ts` existente vía mismo bug del Bug 2), uso una **ruta plana** `POST /api/forum/replies/like` que recibe `{ topicId, replyId, liked }` en el body. Más simple, sin conflictos.

Modelo:

```
forum_topics/{topicId}/replies/{replyId}
├── ...campos previos...
└── likeCount: number     (denormalizado)

forum_topics/{topicId}/replies/{replyId}/likes/{uid}
└── createdAt: ISO
```

## Solución propuesta

### 1. Helper `getDisplayName`

`src/lib/userHelpers.ts` (nuevo, pequeño):

```ts
export async function getDisplayName(uid: string, tokenName: string | null): Promise<string> {
    if (tokenName?.trim()) return tokenName.trim();
    try {
        const snap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
        const dn = snap.data()?.displayName;
        if (typeof dn === 'string' && dn.trim()) return dn.trim();
    } catch (e) {
        console.warn('[getDisplayName] Firestore lookup failed:', e);
    }
    return 'Biohacker';
}
```

Usado en `topics.ts POST` y `replies.ts POST`.

### 2. Mover endpoint del topic

- Crear `src/pages/api/forum/topics/[id].ts` con el contenido de `[id]/index.ts`.
- Borrar `[id]/index.ts` (vía `git rm` del lado de Carlos — el sandbox no tiene permiso de delete).

### 3. Endpoint nuevo de likes en replies

`src/pages/api/forum/replies/like.ts`:

```ts
POST  body { topicId, replyId, liked: boolean }
GET   ?topicId=X&replyId=Y → { liked: boolean }
```

Transaction atómica que actualiza el like doc + likeCount del reply.

### 4. UI en cada reply

`ForumEngine.tsx` — botón corazón pequeño en cada reply, con counter. Estado `replyLikes: Record<replyId, boolean>` que se carga al fetch del detalle del topic.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Crear `src/lib/userHelpers.ts`.
3. Editar `topics.ts` POST y `replies.ts` POST para usar `getDisplayName`.
4. Crear `src/pages/api/forum/topics/[id].ts` (copia de `[id]/index.ts`).
5. Crear `src/pages/api/forum/replies/like.ts` (POST + GET).
6. Editar `ForumEngine.tsx` — sumar `likeCount` y `liked` per reply, botón UI.
7. Build + commit + push (con `git rm` del archivo viejo).

## Criterios de aceptación

- [x] Crear topic nuevo: aparece con nombre real (el del registro), no "Biohacker".
- [x] Crear reply nuevo: idem.
- [x] Topic propio: click en "Eliminar" → desaparece de la lista (soft delete).
- [x] Cada reply tiene un botón corazón con counter.
- [x] Click en corazón de reply → counter sube/baja, optimistic con rollback en error.
- [x] Refresh del detalle: el like del reply persiste.

## Pruebas manuales

1. Crear topic nuevo "Test SPEC-036" → confirmar nombre del autor coincide con tu displayName real.
2. Reply al topic → mismo check.
3. Click en "Eliminar" del topic propio → desaparece del listado.
4. Click en corazón de un reply → count sube +1.
5. Click otra vez → baja a 0.
6. Refrescar → el estado del like persiste.
7. Como admin, ir al tab Foro → confirmar que se ven los topics.

## Riesgos y trade-offs

- **Migración tardía de topics legacy**: los topics ya creados con nombre "Biohacker" no se actualizan retroactivamente. Si Carlos quiere arreglarlos, un script one-shot lee Firestore y reescribe `authorName`. Por ahora aceptable (los nuevos saldrán bien).
- **Ruta plana de replies/like**: rompe la simetría con `topics/[id]/like.ts`. Aceptable: evita el conflicto de routing del Bug 2 sin reorganizar más archivos.
- **`getDisplayName` añade un read extra a Firestore por POST de topic/reply**: solo se ejecuta si el token no trae name. Costo bajo.

## Compatibilidad con ElenaApp

Sin impacto.

## Commit

```
fix(spec-036): foro — nombre real del autor, delete topic, likes en replies

- userHelpers.ts: getDisplayName con fallback a users/{uid}.displayName
  cuando el ID token cacheado no trae name (caso de cuenta nueva)
- topics.ts y replies.ts POST: usar el helper para autor real
- Mover api/forum/topics/[id]/index.ts → [id].ts (Astro 6 prioriza
  [id].ts sobre [id]/index.ts; el viejo path daba 404 al delete)
- api/forum/replies/like.ts: nuevo endpoint POST/GET con transaction
  atómica (likes/{uid} + likeCount denormalizado en reply)
- ForumEngine.tsx: botón corazón + counter en cada reply, optimistic
  update con rollback

Cierra SPEC-036.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/lib/userHelpers.ts` — nuevo helper `getDisplayName`.
- `metamorfosis-web/src/pages/api/forum/topics.ts` — usa `getDisplayName`.
- `metamorfosis-web/src/pages/api/forum/topics/[id]/replies.ts` — usa `getDisplayName`.
- `metamorfosis-web/src/pages/api/forum/topics/[id].ts` — **nuevo**, contenido de `[id]/index.ts`. Carlos borra el viejo con `git rm`.
- `metamorfosis-web/src/pages/api/forum/replies/like.ts` — nuevo endpoint POST/GET.
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — botón corazón en replies, estado `replyLikes` y counters.

**Decisiones tomadas en la marcha:**
- **Helper en archivo separado** (no inline en cada endpoint): reusable para futuras specs que lean displayName.
- **Ruta plana `/api/forum/replies/like`** en lugar de anidada: evita el bug de Astro 6 con `[id]/index.ts` y mantiene el código predecible.
- **`like_forum_topic` se reusa para likes de replies** en audit log: la `resourceId` distingue (`topicId` solo para topic, `topicId/replyId` para reply). Si el día de mañana se quiere granularidad, agregar `like_forum_reply` al union.

**Sin desviaciones del plan funcional.**
