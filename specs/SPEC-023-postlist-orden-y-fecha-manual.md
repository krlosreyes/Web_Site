# SPEC-023 — PostList con orden configurable + fecha de publicación editable

**Estado:** ✅ Cerrada
**Fase:** 4 (Admin Automation — extensión post-cierre)
**Severidad:** MEDIO (UX operativa de gestión editorial)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-015 (status field), SPEC-018 (audit log captura cambios de fecha)

---

## Contexto

Hoy `PostList.tsx` lista los artículos en el orden que devuelve `/api/admin/posts` (que internamente ordena por `views` desc — métrica simulada y poco útil). Carlos no puede:

1. Ver de un vistazo qué publicó más recientemente.
2. Reordenar la lista por fecha, título o status.
3. Filtrar drafts vs published.
4. **Editar manualmente la fecha de publicación** de un artículo. Si quiere backdatear (publicar hoy un artículo escrito la semana pasada con la fecha real de redacción), no hay forma. El sistema setea `publishedAt = now` la primera vez que el status pasa a 'published' y nunca más se toca.

## Problema

1. **Orden por views simulado.** Las métricas hoy son random (`Math.floor(Math.random() * 5000)` en `posts.ts:30`). Ordenar por eso no significa nada.
2. **Sin filtros operativos.** Mezclar drafts + published en la misma lista hace ruido. Si Carlos está en modo "publicar todos los drafts pendientes", quiere ver solo drafts.
3. **`publishedAt` automático y rígido.** No respeta el contexto editorial real. Un artículo escrito en marzo y publicado en mayo debería poder fechar marzo si así corresponde por contexto del contenido (referencias temporales del texto, etc.).

## Solución propuesta

### 1. Backend — `posts.ts` respeta `publishedAt` del body

**POST `/api/admin/posts`:**
- Si el body trae `publishedAt` (ISO string parseable como Date), usarlo.
- Si no:
  - `status === 'published'` → `publishedAt = now` (comportamiento actual).
  - `status === 'draft'` → `publishedAt = null`.

**PUT `/api/admin/posts`:**
- Si el body trae `publishedAt` explícito, usarlo (incluso si el doc ya tenía uno).
- Si no, mantener la lógica actual: si pasa de `draft` a `published` por primera vez y no había `publishedAt`, setear `now`.
- **Validación**: si `publishedAt` viene, debe parsear como Date válida; si no, devolver 400.

### 2. ArticleEditor — campo `<input type="datetime-local">`

Sumar bloque "Fecha de publicación" después del título:

```tsx
<input
  type="datetime-local"
  value={publishedAtLocal} // formato YYYY-MM-DDTHH:mm
  onChange={(e) => setPublishedAtLocal(e.target.value)}
/>
<button onClick={() => setPublishedAtLocal(toLocalInput(new Date()))}>
  Ahora
</button>
```

Reglas:
- Cargar el valor existente cuando se edita un post.
- Mostrar siempre el campo (drafts también pueden setear fecha; al publicar la respeta).
- Si vacío al guardar, no se manda `publishedAt` y el backend aplica el comportamiento default.
- Botón "Ahora" para setear rápido al timestamp actual.
- Helper `toLocalInput`/`fromLocalInput` para convertir entre el formato del input (`YYYY-MM-DDTHH:mm` en hora local) y el ISO que persiste el backend (UTC).

### 3. PostList — filtros + orden + columnas

**Filtros:**
- Chips: Todos / 🟢 Publicados / 🟡 Drafts. Counts por estado.

**Orden** (dropdown):
- 📅 Más recientes (publishedAt desc) — **default**
- 📅 Más antiguos (publishedAt asc)
- 🆕 Recién creados (createdAt desc)
- ✏️ Recién editados (updatedAt desc)
- 🔤 A-Z (título)
- 🔤 Z-A (título)

**Columnas adicionales** en la tabla:
- Status (badge).
- Fecha de publicación (formateada `dd MMM yyyy` o "—" si null).

**Persistencia**: el filtro y el orden seleccionados viven en `localStorage` (`admin_postlist_filter`, `admin_postlist_sort`).

### 4. Audit log captura cambios de fecha

Sin cambios adicionales — el helper `diffOf` de SPEC-018 ya detecta cambios en `publishedAt` automáticamente.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Editar `metamorfosis-web/src/pages/api/admin/posts.ts`:
   - POST: respetar `body.publishedAt` con validación.
   - PUT: respetar `body.publishedAt`.
3. Editar `metamorfosis-web/src/components/admin/ArticleEditor.tsx`:
   - Sumar `publishedAt` al tipo `Article`.
   - Estado `publishedAtLocal` + sync en `useEffect`.
   - Bloque UI con `<input type="datetime-local">` + botón "Ahora".
   - `persistArticle` envía `publishedAt` ISO si está set.
4. Editar `metamorfosis-web/src/components/admin/PostList.tsx`:
   - Tipo `Post` extendido (status, publishedAt, createdAt, updatedAt).
   - Filtros chip + dropdown de orden + persistencia localStorage.
   - Columnas Status y Fecha en la tabla.
5. Build + commit + push.
6. Verificación: editar un post existente, cambiar la fecha al pasado, guardar, refrescar, confirmar que la lista lo refleja en el orden correcto.

## Criterios de aceptación

- [x] La lista ordena por `publishedAt desc` por default.
- [x] El dropdown ofrece 6 opciones de orden y aplica al cambio sin reload.
- [x] Los chips de filtro (Todos / Published / Drafts) filtran en vivo con counts.
- [x] El editor muestra un input de datetime-local con la fecha actual del post.
- [x] Editar la fecha y guardar persiste el nuevo `publishedAt` en Firestore.
- [x] Borrar el contenido del input y guardar mantiene la fecha existente (no la borra).
- [x] El filtro y orden seleccionados persisten en localStorage.
- [x] Posts legacy sin `publishedAt` aparecen al final cuando se ordena por fecha desc.

## Pruebas manuales

1. Login admin → tab Artículos → ver lista con default "Más recientes".
2. Cambiar dropdown a "A-Z" → re-orden inmediato sin reload.
3. Refrescar página → el orden A-Z persiste (localStorage).
4. Filtrar a "🟡 Drafts" → solo drafts visibles.
5. Editar un artículo → ver campo "Fecha de publicación" con la fecha actual.
6. Cambiar la fecha a una semana atrás → "Guardar" → refrescar la lista.
7. El artículo aparece en el orden correcto según la nueva fecha.
8. Tab Audit log → entry `update_post` con `publishedAt: { before, after }` registrado automáticamente.

## Riesgos y trade-offs

- **Datetime-local es timezone-naive**. El input usa la hora local del browser; convertimos a ISO UTC antes de mandar. Si Carlos viaja y edita desde otra zona, la fecha visual coincide con su zona local, no con la zona del visitante final del sitio. Aceptable para uso editorial; el frontend público (`biblioteca.astro`) muestra fecha local del visitante, no fecha original.
- **Backdatear puede confundir SEO**. Si una fecha antigua aparece como reciente al publicar, Google puede penalizar. Mitigación: Carlos sabe lo que hace, esto es feature.
- **Sin paginación todavía** (mismo riesgo que SPEC-019). Cap implícito de 50 posts en el endpoint. Suficiente por ahora.
- **No se filtra por título.** Si la lista crece, agregar input de búsqueda en SPEC-023b.

## Compatibilidad con ElenaApp

Sin impacto. ElenaApp no consume artículos.

## Commit

```
feat(spec-023): postlist con orden + filtro + fecha publicación editable

- Backend posts.ts POST/PUT acepta body.publishedAt con validación de Date
- ArticleEditor con input datetime-local y botón "Ahora"
- PostList con chips de filtro (Todos/Published/Drafts) + dropdown
  de orden (6 opciones), default publishedAt desc
- Filtro y orden persisten en localStorage
- Tabla suma columnas Status (badge) y Fecha
- Audit log captura el cambio de publishedAt automáticamente vía diffOf

Cierra SPEC-023.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/api/admin/posts.ts` — POST y PUT respetan `body.publishedAt` con validación; helper `parsePublishedAt` que devuelve ISO o `null` y rechaza fechas mal formadas con 400.
- `metamorfosis-web/src/components/admin/ArticleEditor.tsx` — sumado `publishedAt` al tipo `Article`, estado `publishedAtLocal`, bloque UI con `<input type="datetime-local">` y botón "Ahora", helpers `toLocalInput`/`fromLocalInput` para timezone, `persistArticle` envía el ISO al backend.
- `metamorfosis-web/src/components/admin/PostList.tsx` — reescrito con tipos extendidos (status, publishedAt, createdAt, updatedAt), chips de filtro con counts, dropdown de orden con 6 opciones, persistencia en localStorage, columnas Status (badge) + Fecha de publicación.

**Decisiones tomadas en la marcha:**
- **Posts legacy sin `publishedAt`** se ordenan al final cuando es desc, al principio cuando es asc. Mantiene consistencia.
- **Helper `formatPubDate`** muestra `'—'` cuando es null (no `'Sin fecha'` para no inflar la UI).
- **Botón "Ahora"** usa `toLocalInput(new Date())` para evitar que Carlos tenga que tipear el datetime — un click la setea al instante.
- **Si el input está vacío**, no se manda `publishedAt` al backend (en lugar de mandar string vacío, que podría parsearse mal). El backend aplica el default existente.
- **Borrar la fecha existente** desde el editor NO la borra en Firestore (input vacío = "no tocar"). Para borrar explícitamente, hace falta una iteración futura con un botón "Quitar fecha" que mande `publishedAt: null`.

**Sin desviaciones del plan funcional.** Todos los criterios de aceptación quedan cumplidos.
