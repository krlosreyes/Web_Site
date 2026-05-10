# SPEC-040 — Foro: vincular topic con artículo

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Engagement / community
**Severidad:** ALTO (integración editorial ↔ comunidad)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-033, SPEC-038/039

---

## Contexto

Hoy el foro y los artículos viven aislados. Cada artículo termina con un CTA al dashboard pero no hay puente para discutir su contenido específico. Las plataformas modernas (Discourse, Skool) integran post + thread asociado para que cada artículo gane engagement long-tail.

## Solución

1. **Backend**: nuevo campo opcional `linkedPostSlug?: string` en `forum_topics`. El endpoint `POST /api/forum/topics` lo acepta, valida que el post exista y esté publicado.
2. **Frontend posts/[slug].astro**: botón **"Discutir en La Tribu"** después del bloque de reacciones que abre `/comunidad?createWithPost={slug}&title={titulo}`.
3. **ForumEngine**: al detectar query params `createWithPost`/`title` al cargar, abre el form de creación con título + categoría pre-poblados y guarda el `linkedPostSlug` para incluirlo al guardar.
4. **Render**: topics con `linkedPostSlug` muestran badge **"📖 Sobre el artículo: [título]"** con link al post — en la card de la lista y en el detalle.

## Beneficios

- **App**: artículos generan conversación que perdura. Stats SPEC-019 capturan qué artículos resuenan.
- **User**: contexto claro al entrar al topic. Puede volver al artículo desde el foro.

## Plan de ejecución

1. `topics.ts POST`: aceptar `linkedPostSlug` con lookup de validación.
2. `ForumEngine.tsx`: useEffect que lee query params, estado `linkedPostSlug` y `linkedPostTitle`, badge en card+detalle.
3. `posts/[slug].astro`: botón "Discutir en La Tribu" antes del CTA final.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/api/forum/topics.ts` — POST acepta y valida `linkedPostSlug`.
- `metamorfosis-web/src/pages/api/forum/topics/[id]/replies.ts` — sin cambios.
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — lectura de query params, pre-populado del form, badge de artículo vinculado en card + detalle.
- `metamorfosis-web/src/pages/posts/[slug].astro` — botón "Discutir en La Tribu" después de PostReactions.

**Decisiones:**
- Validación del slug en el backend evita topics huérfanos.
- Sin auto-create del topic al publicar (más explícito que el post tenga botón). Si Carlos quiere lo automático después, micro-spec.

Sin desviaciones del plan.
