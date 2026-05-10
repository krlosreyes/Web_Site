# SPEC-041 — Foro: pin / destacar topics (admin)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Engagement / community
**Severidad:** MEDIO (control editorial del foro)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-033, SPEC-040

---

## Contexto

El admin necesita anclar topics importantes arriba de la lista (tipo "Pregunta de la semana", anuncios). Patrón clásico de Discourse, Reddit (sticky), Skool.

## Solución

1. Campos nuevos en `forum_topics`: `pinned: boolean` y `pinnedAt: ISO`.
2. Endpoint nuevo `POST /api/admin/forum/pin` con auth admin (cookie). Body: `{ topicId, pinned }`.
3. `topics.ts GET` ordena `pinned DESC, createdAt DESC` in-memory tras fetch.
4. `ForumEngine`: card del topic muestra badge naranja **"📌 Destacado"** y border-left naranja si `pinned`.
5. `ForumModeration`: botón **"📌 Destacar / Quitar"** en cada fila.

## Beneficios

- **App**: control editorial. Carlos puede activar conversación con un topic curado.
- **User**: ve lo importante primero al entrar al foro.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/api/admin/forum/pin.ts` — nuevo endpoint POST con cookie auth.
- `metamorfosis-web/src/pages/api/forum/topics.ts` — GET ordena con pinned primero.
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — badge "📌 Destacado" + border naranja en cards pinned.
- `metamorfosis-web/src/components/admin/ForumModeration.tsx` — botón Pin/Unpin en cada fila.
- `metamorfosis-web/src/lib/auditLog.ts` — sumada acción `pin_forum_topic`.

**Decisiones:**
- Sin TTL en `pinned` (Carlos lo gestiona manualmente). Cuando crezca el foro, se puede agregar `pinnedUntil`.
- Sort in-memory para evitar índice compuesto pinned+createdAt.
