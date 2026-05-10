# SPEC-046 — Pilares como taxonomía unificada (foro + artículos)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Information architecture
**Severidad:** ALTO (taxonomía core del producto)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-033 (foro), SPEC-040 (vinculo topic↔artículo)

---

## Contexto

Hoy hay incoherencia taxonómica:
- **Foro**: 5 categorías (`ayuno`, `bio`, `longevity`, `mind`, `general`) que no corresponden a los 5 pilares del producto.
- **Artículos**: sin categoría formal, solo tags libres del editor.

Carlos define que la taxonomía oficial son los **5 pilares** del CLAUDE.md / canal de YouTube: Ayuno, Nutrición, Ejercicio, Hidratación, Sueño. Foro y artículos deben usar la misma.

## Decisiones tomadas (Carlos 2026-05-10)

- A. **Mantener "General"** como 6ª categoría secundaria en el foro (no es pilar; visualmente gris diferenciado). Útil para off-topic / testimonios.
- B. **Pillar obligatorio** al publicar artículo. Drafts pueden quedar sin pilar mientras se editan.
- C. **Migración manual** (Opción A): Carlos re-categoriza los ~6 artículos y ~3 topics legacy desde el admin. No script automático.
- D. (default) Pilares y emojis: Ayuno ⏱️, Nutrición 🥗, Ejercicio 💪, Hidratación 💧, Sueño 🌙.

## Solución

### 1. `src/lib/constants/pillars.ts` — fuente única de verdad

```ts
export const PILLARS = [
    { id: 'ayuno', name: 'Ayuno', emoji: '⏱️', tw: 'blue' },
    { id: 'nutricion', name: 'Nutrición', emoji: '🥗', tw: 'green' },
    { id: 'ejercicio', name: 'Ejercicio', emoji: '💪', tw: 'orange' },
    { id: 'hidratacion', name: 'Hidratación', emoji: '💧', tw: 'cyan' },
    { id: 'sueno', name: 'Sueño', emoji: '🌙', tw: 'purple' },
] as const;
export const PILLAR_IDS = PILLARS.map((p) => p.id);
export type PillarId = (typeof PILLAR_IDS)[number];
export function getPillar(id: string | null | undefined) { ... }

export const FORUM_CATEGORIES = [
    ...PILLARS,
    { id: 'general', name: 'General', emoji: '💬', tw: 'gray' },
];
export const VALID_FORUM_CATEGORY_IDS = FORUM_CATEGORIES.map((c) => c.id);
```

### 2. Foro

- `topics.ts POST`: usar `VALID_FORUM_CATEGORY_IDS` (acepta los 5 pilares + `general`).
- `ForumEngine.tsx`: array `CATEGORIES` lee de `FORUM_CATEGORIES`. Cada categoría muestra `{emoji} {name}`. "General" se mantiene visualmente diferenciada (gris) abajo de la lista.

### 3. Artículos

- **Backend `api/admin/posts.ts` POST/PUT**: 
  - Acepta `pillar` (string opcional).
  - Si `status === 'published'` y `pillar` no es uno de los 5 IDs válidos → 400.
  - Drafts pueden quedar sin `pillar`.
- **`ArticleEditor.tsx`**: dropdown obligatorio "Pilar Metabólico" tras título. Si publicás sin pilar, alert claro.
- **`posts/[slug].astro`**: badge del pilar (emoji + nombre + color tailwind del pillar) entre el header del article y el título.
- **`biblioteca.astro`**: chips de filtro por pilar arriba del grid + chip "Todos".

### 4. Migración manual (Opción A)

- Para artículos legacy sin `pillar`: el editor los marca como "Sin pilar" en el admin con badge rojo. Carlos los abre uno por uno y asigna.
- Para topics legacy con category `bio`/`longevity`/`mind`: en `ForumModeration.tsx` agrego un dropdown "Cambiar categoría" inline. Carlos los reasigna en bulk visual.
- Endpoint nuevo `POST /api/admin/forum/recategorize` para el reasign.

### 5. Conexión automática foro ↔ artículo (refinamiento de SPEC-040)

Cuando se entra al foro vía deeplink desde un artículo (`?createWithPost=slug`), se preselecciona la categoría = pilar del artículo. El user puede cambiarla pero por default coincide.

## Plan de ejecución

1. Spec markdown (hecho).
2. Crear `src/lib/constants/pillars.ts`.
3. Editar `topics.ts`, `ForumEngine.tsx` (categorías nuevas + emojis).
4. Editar `posts.ts`, `ArticleEditor.tsx`, `posts/[slug].astro`, `biblioteca.astro`.
5. Endpoint `recategorize` + dropdown en `ForumModeration`.
6. Build + commit + push.

## Criterios de aceptación

- [x] Foro muestra 5 pilares + "General" en el sidebar de categorías.
- [x] Editor de artículos tiene dropdown "Pilar Metabólico" obligatorio.
- [x] Publicar artículo sin pilar → 400 con mensaje claro.
- [x] Detalle público del artículo muestra badge del pilar.
- [x] Biblioteca tiene filtros por pilar.
- [x] Topics legacy con category vieja siguen funcionando (badge "Sin categorizar" o su category original).
- [x] Admin puede re-categorizar topics legacy desde Moderación foro.
- [x] Deeplink desde artículo al foro preselecciona el pilar del artículo.

## Pruebas manuales

1. Crear artículo nuevo desde admin → seleccionar pilar "Ejercicio" → publicar → ver badge naranja en `/posts/{slug}`.
2. Intentar publicar sin pilar → alert "Pilar requerido".
3. Abrir biblioteca → click en chip "Sueño" → solo se ven artículos de ese pilar.
4. Click en "Discutir en La Tribu" en un artículo de pilar Ayuno → form del foro abre con categoría "Ayuno" preseleccionada.
5. Modo admin → tab Foro → re-categorizar topic viejo de `bio` a `ejercicio`.
6. Refrescar foro público → topic ahora aparece en categoría Ejercicio.

## Riesgos y trade-offs

- **Topics/posts legacy sin pilar**: muestran badge "Sin categorizar" hasta que admin los asigne. Aceptable con volumen actual (<10 docs).
- **Cambiar IDs es breaking**: `bio`/`longevity`/`mind` ya no son válidos al crear topics nuevos. Los viejos siguen guardados con esos IDs en Firestore (presentación gracefully degradada).
- **"General" no es pilar**: se diferencia visualmente. Si Carlos a futuro quiere quitarla, una micro-spec.

## Compatibilidad con ElenaApp

ElenaApp puede leer `users/{uid}.preferredPillar` o usar la misma taxonomía para tracking diario. Sin cambios al schema canónico.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/lib/constants/pillars.ts` — nuevo, fuente única de verdad.
- `metamorfosis-web/src/pages/api/forum/topics.ts` — `VALID_CATEGORIES` lee de constantes.
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — `CATEGORIES` lee de constantes con emoji + color.
- `metamorfosis-web/src/pages/api/admin/posts.ts` — POST/PUT validan `pillar`, requerido al publicar.
- `metamorfosis-web/src/components/admin/ArticleEditor.tsx` — dropdown obligatorio.
- `metamorfosis-web/src/pages/posts/[slug].astro` — badge del pilar arriba del título.
- `metamorfosis-web/src/pages/biblioteca.astro` — chips de filtro.
- `metamorfosis-web/src/pages/api/admin/forum/recategorize.ts` — endpoint nuevo.
- `metamorfosis-web/src/components/admin/ForumModeration.tsx` — dropdown inline para re-categorizar.

Sin desviaciones del plan funcional.
