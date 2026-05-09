# SPEC-016 — LeadList CRM funcional (status, notas, tags)

**Estado:** ✅ Cerrada
**Fase:** 4
**Severidad:** ALTO (operación: gestión de pipeline de leads)
**Fecha de creación:** 2026-05-09
**Cerrada:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** SPEC-005 (schema canónico ya estabiliza la collection `metamorfosis_waitlist_leads`), SPEC-008 (rules de Firestore), SPEC-003 (auth admin unificada)

---

## Contexto

El componente admin `LeadList.tsx` muestra la collection `metamorfosis_waitlist_leads` como una **tabla estática read-only**: nombre, email, IMR, fecha, y un botón de exportar CSV. Es básicamente un visor.

Cuando un usuario completa el quiz de Salud Metabólica (`MetabolicHealthQuiz`) o el quiz de Sobrepeso, se guarda un lead con su contacto y su IMR estimado. Esos leads se acumulan, pero no hay forma de **gestionarlos como pipeline**: ¿a quién ya contacté? ¿quién dijo que sí pero todavía no entró a ElenaApp? ¿qué notas tomé en la llamada? ¿qué leads vinieron de qué campaña?

Sin pipeline, la admin se vuelve a inventar el seguimiento en una hoja de cálculo aparte, y el sitio queda como un buzón ciego.

## Problema

1. **Sin status.** Todos los leads viven en el mismo plano. No se puede separar "ya contacté" de "todavía no" ni "convirtió" de "descartado".
2. **Sin notas.** Imposible recordar el contexto de un contacto previo. ¿Le importaba el ayuno? ¿Tiene diabetes tipo 2? Se pierde.
3. **Sin tags.** No hay forma de marcar segmentos (`yt-2026`, `obesidad-alta`, `mujer-menopausia`) para filtrar después.
4. **Sin filtros.** Si tengo 200 leads, los reviso todos cada vez. No hay foco operativo.
5. **Sin búsqueda.** Si recuerdo "el de María", tengo que mirar de a 10 hasta encontrarla.

## Solución propuesta

### 1. Pipeline de status

Cinco estados explícitos, ortogonales y sin solape:

```
new        — capturado, sin contacto aún (default para nuevos)
contacted  — admin se comunicó (email, llamada, etc.)
qualified  — interesado real, alto fit con producto
converted  — usuario activo en ElenaApp / lista de espera invitada
archived   — descartado, no convirtió, fuera del pipeline
```

### 2. Schema extendido en `metamorfosis_waitlist_leads/{id}`

Agregar campos opcionales (compatibles con leads viejos):

```ts
status?: 'new' | 'contacted' | 'qualified' | 'converted' | 'archived';
notes?: string;          // ≤5000 chars
tags?: string[];         // ≤20 entradas, trimmeadas
contactedAt?: string;    // ISO; se setea la primera vez que status='contacted'
lastUpdatedAt?: string;  // ISO; se setea en cada PUT
```

**Compatibilidad con leads legacy:** si un lead no tiene `status`, se trata como `'new'`. No requiere migración.

### 3. Endpoints

`GET /api/admin/leads` (existente, ampliado):
- Devuelve los nuevos campos. Los timestamps se normalizan a ISO string vía helper `normalizeTimestamp` (acepta Firestore Timestamp, ISO string, o objeto con `_seconds`).

`PUT /api/admin/leads` (nuevo):
- Body: `{ id: string, status?: LeadStatus, notes?: string, tags?: string[] }`.
- Valida `status` contra el enum, `tags` como array, `notes` como string.
- `notes` se trunca a 5000 chars; `tags` se trimmean, descartan vacíos, y limitan a 20.
- Si `status` cambia a `'contacted'` por primera vez (no había `contactedAt`), se setea `contactedAt = now`.
- Siempre setea `lastUpdatedAt = now`.
- 404 si el lead no existe; 400 si el body es inválido; 401 si no hay sesión admin (vía `authGate`).

### 4. UI: filtros + búsqueda + edición inline

`LeadList.tsx` se reescribe con:

- **Chips de filtro** por status, con counts en vivo (Todos / Nuevo / Contactado / Calificado / Convertido / Archivado).
- **Input de búsqueda** que filtra por nombre, email o tag.
- **Status inline** como `<select>` dentro de cada fila — cambiar el dropdown dispara PUT optimista.
- **Filas expandibles**:
  - Notas editables (`<textarea>`, guarda al `onBlur`).
  - Tags como chips (Enter agrega, × quita).
  - Metadata: `contactedAt`, `lastUpdatedAt`, tipo de quiz, `proxy_scores` en `<details>`.
- **CSV export** respeta el filtro/búsqueda actual e incluye `status`, `tags`, `notes`.

### 5. Updates optimistas

Cada cambio (status, notes, tags) se aplica al estado local primero, después se hace PUT. Si el server falla, se revierte al estado previo y se muestra alert. Esto mantiene la UI fluida sin spinners por cambio.

## Plan de ejecución

1. Reescribir `pages/api/admin/leads.ts`:
   - Mantener `GET` con campos extendidos + helper `normalizeTimestamp`.
   - Agregar `PUT` con validación + lógica de `contactedAt`/`lastUpdatedAt`.
   - Reusar `authGate` consistente con SPEC-003.
2. Reescribir `components/admin/LeadList.tsx`:
   - Tipo `Lead` con todos los campos nuevos.
   - Tabla `STATUS_META` con label + emoji + clases por status.
   - `useMemo` para counts y filtrado.
   - `updateLead()` con optimistic update + rollback.
   - Filas expandibles con `expandedId` controlado.
3. Build local (`npm run build` desde `metamorfosis-web/`).
4. Commit + push directo a `main` con `feat(spec-016): leadlist crm funcional con status notas y tags`.
5. Verificar en producción que el pipeline funciona end-to-end.

## Criterios de aceptación

- [x] Un lead recién capturado aparece como `'new'` en la UI sin migración.
- [x] Cambiar el status del dropdown persiste en Firestore y sobrevive a un refresh.
- [x] Marcar un lead como `'contacted'` por primera vez setea `contactedAt`. Si vuelve a `'new'` y de nuevo a `'contacted'`, no se sobrescribe la fecha original.
- [x] Editar notas y hacer blur persiste el contenido (≤5000 chars).
- [x] Agregar un tag con Enter persiste; quitar con × persiste.
- [x] Filtrar por status muestra solo leads con ese status, con counts en vivo.
- [x] Búsqueda matchea sustring case-insensitive en nombre/email/tags.
- [x] CSV export respeta el filtro actual e incluye status/tags/notes.
- [x] Si la sesión admin caducó, cualquier PUT devuelve 401 y la UI redirige al login.
- [x] Optimistic update se revierte si el server rechaza.

## Pruebas manuales

1. Login admin → /admin → ver tabla con leads existentes.
2. Verificar que todos los leads viejos aparecen como "🆕 Nuevo" (default).
3. Cambiar el status de un lead a "📞 Contactado". Refrescar página. Confirmar que persiste.
4. Expandir el lead. Confirmar que aparece "Contactado: <fecha actual>".
5. Cambiar status a "📁 Archivado", luego de vuelta a "📞 Contactado". Confirmar que `contactedAt` no cambió.
6. Editar notas, click fuera. Refrescar. Confirmar que las notas persisten.
7. Agregar tag `yt-2026`. Confirmar que se renderiza como chip. Refrescar. Persiste.
8. Quitar tag con ×. Refrescar. No vuelve.
9. Cambiar filtro a "✅ Convertido". Confirmar que la tabla filtra y los counts coinciden.
10. Buscar `maría`. Confirmar match parcial case-insensitive.
11. Exportar CSV con filtro aplicado. Abrir en hoja de cálculo. Confirmar que tiene status/tags/notes.
12. (Bonus) Cerrar sesión y abrir el endpoint en otra pestaña — debe redirigir a login.

## Riesgos y trade-offs

- **`onBlur` para guardar notas** puede generar PUTs innecesarios si el usuario solo tipea y se va. Mitigado por el chequeo `e.target.value !== ''` y el ahorro de complejidad vs un debounce. Si se vuelve molesto, agregamos botón "Guardar notas" explícito en una iteración posterior.
- **Validación tags max 20** se hace server-side por seguridad y para mantener el doc compacto. Si más adelante necesitamos taxonomía estricta, migramos a una collection separada.
- **Sin paginación**: el GET sigue limitado a 200 leads (`limit(200)`). Por ahora es suficiente; si crece, agregamos cursor pagination.
- **Sin auditoría de quién cambió qué**: SPEC-018 lo cubre cuando llegue.

## Compatibilidad con ElenaApp

Esta SPEC vive 100% del lado web. Los campos CRM (`status`, `notes`, `tags`, `contactedAt`, `lastUpdatedAt`) son metadata operativa de Carlos como admin; ElenaApp no los necesita y no los lee. Sin acoplamiento.

## Commit

```
feat(spec-016): leadlist crm funcional con status notas y tags

- API: leads.ts extendido (GET) + PUT con validación de status/notes/tags
- UI: LeadList.tsx reescrito con filtros, búsqueda, edición inline,
  filas expandibles, optimistic updates con rollback
- Status pipeline: new → contacted → qualified → converted | archived
- Notes ≤5000 chars, tags ≤20, contactedAt fijo en la 1ª transición
- CSV export respeta filtros + incluye nuevos campos
- Compatibilidad con leads legacy sin status

Cierra SPEC-016.
```

## Resultado

Implementado en una sola pasada (2026-05-09).

**Archivos tocados:**
- `metamorfosis-web/src/pages/api/admin/leads.ts` — GET extendido con campos CRM + nuevo endpoint PUT con validación completa, helper `normalizeTimestamp`, marca `contactedAt` solo en la primera transición a `'contacted'`.
- `metamorfosis-web/src/components/admin/LeadList.tsx` — reescrito con tipo `Lead` completo, `STATUS_META`, filtros por chip con counts, búsqueda, status dropdown inline, filas expandibles con notas (onBlur) y tags (Enter para agregar, × para quitar), optimistic updates con rollback, CSV export que respeta filtros.

**Decisiones de diseño tomadas en la marcha:**
- Notes guardan en `onBlur` y no con debounce: simplicidad sobre microoptimización; en la práctica el admin solo escribe notas cuando termina de pensar.
- Tags trimmean y deduplican client-side antes del PUT, server-side se valida de nuevo (defensa en profundidad).
- `contactedAt` no se borra si el lead vuelve a `'new'`: refleja la realidad histórica (sí hubo contacto). Solo se setea la primera vez.
- `STATUS_META` mapea cada status a un par (`classes` para chip default, `activeClasses` para chip seleccionado/dropdown). Mantiene la paleta consistente con el resto del admin (verde `#00C49A` para convertido, amarillo para contacto en curso, púrpura para qualified).

**Sin desviaciones del plan.** Ningún criterio de aceptación quedó sin cumplir.
