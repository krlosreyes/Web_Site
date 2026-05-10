# SPEC-042 — Foro: save / bookmark topics

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Engagement / community
**Severidad:** MEDIO (UX retención)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-033

---

## Contexto

Patrón estándar (Reddit, Twitter, Instagram): el usuario puede guardar contenido para volver luego. Sin esto, los topics interesantes se pierden en el scroll.

## Solución

1. **Modelo**: subcollection `users/{uid}/savedTopics/{topicId}` con `{ savedAt: ISO, topicTitle, topicCategory }` (cached para listing rápido sin joins).
2. **Endpoint** `POST /api/forum/topics/[id]/save` con `{ saved: boolean }`. Auth ID token. Atomic con respect a la subcollection del usuario.
3. **UI en cada topic** (lista + detalle): botón **🔖 Guardar / Guardado** al lado del like.
4. **Sección "Mis guardados"** integrada al `BioDashboard.tsx` — link card que al hacer click muestra inline una lista compacta.

## Beneficios

- **App**: signal editorial — qué topics retienen valor. Métrica adicional para SPEC-019.
- **User**: poder volver a topics importantes sin scroll infinito.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/api/forum/topics/[id]/save.ts` — POST/GET con auth ID token; escribe en subcollection `users/{uid}/savedTopics/{topicId}`.
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — botón 🔖 en card y detalle, estado `savedMap` cargado tras fetch.
- `firebase/firestore.rules` — bloque `users/{uid}/savedTopics/{topicId}` para que solo el dueño pueda leer/escribir desde el cliente (defensa adicional aunque escribe via endpoint).
- `metamorfosis-web/src/lib/auditLog.ts` — sumada acción `save_forum_topic`.

**Decisiones:**
- **Topic data cached** en cada save doc (`topicTitle`, `topicCategory`): evita lookup join al listar guardados.
- **Endpoint server-side** en lugar de write directo: mantiene coherencia con el resto del foro y permite audit log.
- **No mostramos contador de "X guardaron este topic" público**: feature de admin/futura.
