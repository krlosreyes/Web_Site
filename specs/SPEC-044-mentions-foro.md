# SPEC-044 — Mentions @usuario en el foro

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Engagement / community
**Severidad:** MEDIO (cierre del loop social del foro)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-033 (foro), SPEC-039 (replies anidadas), SPEC-043 (notificaciones)

---

## Contexto

Hoy el foro tiene replies anidadas con `@autor` automático cuando respondés a una reply (SPEC-039). Pero **no podés mencionar a alguien ajeno al thread** (ej. invitar a un experto del foro a una conversación específica). Ese es el patrón estándar de Twitter/Instagram/Reddit.

## Solución

### 1. UI: botón "@" + picker

Al lado del botón Send del textarea de reply (foro), un botón pequeño con "@". Click → abre un dropdown con la lista de **mentionable** del thread (autor del topic + autores de cada reply, único por uid). Click en un user → inserta `@nombre ` al final del draft + agrega su uid al array `mentionUids` del reply.

No hago autocomplete inline (escribir `@` + buscar) porque agrega complejidad UX. El picker explícito es suficiente para el v1.

### 2. Backend

`POST /api/forum/topics/[id]/replies` acepta `mentionUids: string[]` opcional. Por cada uid en el array (que sea distinto al `session.uid`), genera notif tipo `mention` reusando `createNotification` (SPEC-043).

El reply se guarda con `mentionUids` en el doc para auditoría.

### 3. Render

El contenido del reply se renderiza con `@\w+` wrappeado en `<span class="text-blue-400">`. Esto se aplica a TODO `@xxx` del texto, sea menciónable real o no — es solo styling visual.

## Plan de ejecución

1. Editar `ForumEngine.tsx`:
   - Estado `mentionUids: string[]` y `mentionPickerOpen: boolean`.
   - Lista derivada `mentionableUsers` (uid+name únicos del topic + replies).
   - Botón "@" + dropdown.
   - `handleSubmitReply` incluye `mentionUids` en el body.
   - Helper `renderContentWithMentions` para wrappear `@\w+`.
2. Editar `replies.ts POST`:
   - Aceptar `mentionUids: string[]`.
   - Generar notifs por cada uid distinto del author.
   - Guardar `mentionUids` en el reply doc.
3. Build + commit + push.

## Criterios de aceptación

- [x] Botón "@" visible al lado del Send en formularios de reply.
- [x] Click en "@" abre dropdown con lista de users del thread.
- [x] Click en un user inserta `@nombre ` en el textarea y registra el uid.
- [x] Al enviar el reply, el user mencionado recibe notif tipo `mention`.
- [x] El contenido del reply muestra `@nombre` en color azul.
- [x] Mentions a uno mismo NO generan notif.
- [x] Si la lista de mentionable está vacía, el botón se deshabilita.

## Pruebas manuales

1. User A crea topic. User B responde. User C entra y abre el form de reply al topic.
2. C escribe "Hola, ", click "@", elige a B → texto queda "Hola, @B " y `mentionUids = [B.uid]`.
3. C envía → B recibe notif tipo `mention`.
4. Render del reply muestra `@B` en azul.

## Riesgos y trade-offs

- **Sin búsqueda inline**: si el thread tiene 50+ replies, el dropdown puede ser largo. Aceptable a este volumen; cuando crezca se agrega input de filtro arriba.
- **Texto plano**: `@nombre` no es un link al perfil del user (no tenemos `/u/{uid}` aún). Solo styling. Si después hacemos perfiles públicos, el span se vuelve `<a>`.
- **Spammers podrían mentionar a varios users de una**: limitamos a 5 mentions por reply para evitar abuse. Validación server-side.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — picker `@`, lista `mentionableUsers`, render con `@nombre` azul.
- `metamorfosis-web/src/pages/api/forum/topics/[id]/replies.ts` — acepta `mentionUids` + valida + genera notifs.

**Decisiones:**
- Picker explícito (no autocomplete inline): UX simple, se entiende con un solo click.
- Hard limit de 5 mentions por reply (anti-spam).
- Render con regex `@[\w-]+`: simple y suficiente.

Sin desviaciones del plan funcional.
