# SPEC-033 — Foro funcional con persistencia (La Tribu)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Engagement / community
**Severidad:** ALTO (hoy es 100% mock; user crea topic, refresca y se pierde)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-008 (rules), SPEC-018 (audit log), SPEC-031 (responsive headings)

---

## Contexto

`ForumEngine.tsx` (`/comunidad`) es completamente dummy: 3 tópicos hardcoded, replies que no se mandan, likes estáticos, "Crear Tema" se pierde al refresh. Carlos pide que pase a foro funcional persistido en Firestore.

## Decisiones tomadas (Carlos 2026-05-10)

1. **Acceso**: cualquier user logueado (se quita el gating de "IMR + artículo" actual; demasiada fricción para un foro abierto).
2. **Eliminar tópicos propios**: SÍ (soft delete con `status: 'deleted'`).
3. **Moderación admin**: SÍ — tab nuevo "Foro" en el dashboard admin con force-delete.
4. **Avatar**: por ahora solo inicial del nombre con color generado del hash del nombre.

## Problema

1. **No hay persistencia**: cada refresh borra todo. Imposible construir comunidad.
2. **Sin moderación**: si el foro funcionara, cualquier abuso quedaría visible para siempre.
3. **Replies fake**: el textarea no manda nada.
4. **Likes fake**: número estático, sin lógica.

## Solución propuesta

### 1. Modelo de datos

```
forum_topics/{topicId}                       (collection raíz)
├── title: string                            (required, ≤200 chars)
├── content: string                          (required, ≤5000 chars)
├── category: 'ayuno'|'bio'|'longevity'|'mind'|'general'
├── tags: string[]                           (auto desde category, máx 5)
├── authorUid: string
├── authorName: string                       (cached al crear)
├── authorInitial: string                    (charAt(0).toUpperCase())
├── authorColorIdx: number                   (0-7, hash determinista del uid)
├── replyCount: number                       (denormalizado)
├── likeCount: number                        (denormalizado)
├── views: number                            (incremento al abrir detalle)
├── status: 'active' | 'deleted'
├── createdAt: ISO
└── updatedAt: ISO

forum_topics/{topicId}/replies/{replyId}     (subcollection)
├── content: string                          (≤2000 chars)
├── authorUid: string
├── authorName: string
├── authorInitial: string
├── authorColorIdx: number
├── status: 'active' | 'deleted'
└── createdAt: ISO

forum_topics/{topicId}/likes/{uid}           (presence-based)
└── createdAt: ISO
```

Soft delete con `status: 'deleted'` en lugar de borrar el doc — preserva counters consistentes y permite restauración futura desde admin.

### 2. Constantes

```ts
COLLECTIONS.FORUM_TOPICS = 'forum_topics'
```

### 3. Endpoints (Admin SDK + transactions)

Mismo patrón que SPEC-032: server-side para coherencia y para evitar reglas Firestore complejas con `FieldValue.increment` cross-doc.

```
/api/forum/topics
  GET   ?category=&search=  →  lista topics activos (limit 100, orderBy createdAt desc)
  POST  body { title, content, category }
                            →  crea topic (auth ID token)

/api/forum/topics/[id]
  GET                       →  topic + replies activos. Incrementa views.
  DELETE                    →  soft delete propio (valida authorUid == auth.uid)

/api/forum/topics/[id]/replies
  POST  body { content }    →  crea reply, increment replyCount

/api/forum/topics/[id]/replies/[replyId]
  DELETE                    →  soft delete propio del reply (valida authorUid)

/api/forum/topics/[id]/like
  POST                      →  toggle like del user. Body { liked: boolean }.
                               Atomic: like doc + likeCount.

/api/admin/forum/delete
  DELETE  ?type=topic|reply&topic=X&reply=Y
                            →  force delete por admin (auth cookie). Bypasa
                               validación de authorUid.
```

Auth: ID token en header para `/api/forum/*`, cookie admin para `/api/admin/forum/*`.

### 4. Reglas Firestore

```
match /forum_topics/{topic} {
  allow read: if resource.data.status == 'active' || resource.data.status == null;
  allow write: if false;  // todo via endpoints

  match /replies/{reply} {
    allow read: if true;  // los replies se piden vía endpoint que ya filtra
    allow write: if false;
  }
  match /likes/{uid} {
    allow read: if request.auth != null;
    allow write: if false;
  }
}
```

Read público (sin auth) sobre topics activos para que cualquiera pueda VER el foro (necesario si más adelante queremos lectura pública). Crear/comentar/like requiere auth — eso lo enforce el endpoint, no las rules (las rules cierran writes directos).

### 5. UI — `ForumEngine.tsx` reescrito

**Cambios sobre el actual:**

- Quitar `INITIAL_TOPICS` mock.
- Quitar gating de IMR/artículo. Solo requerir `currentUser` (Firebase Auth).
- Cargar topics de `/api/forum/topics` con loading + error states.
- Crear topic → POST → re-fetch.
- Click en topic → fetch detalle desde `/api/forum/topics/[id]` (incrementa views) → mostrar replies.
- Reply → POST → re-fetch detalle.
- Like → toggle con optimistic update.
- Botón "Eliminar" en topics/replies propios → DELETE → re-fetch.
- Avatar: componente inline `<Avatar name={x} colorIdx={y} />` con inicial + color de paleta consistente.

**Paleta de avatares** (8 colores deterministas según hash del uid):

```ts
const AVATAR_COLORS = [
  'bg-blue-500/20 border-blue-500/40 text-blue-300',
  'bg-[#00C49A]/20 border-[#00C49A]/40 text-[#00C49A]',
  'bg-purple-500/20 border-purple-500/40 text-purple-300',
  'bg-pink-500/20 border-pink-500/40 text-pink-300',
  'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  'bg-orange-500/20 border-orange-500/40 text-orange-300',
  'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  'bg-red-500/20 border-red-500/40 text-red-300',
];
```

`colorIdx = hash(uid) % 8` — calculado y guardado en el doc al crear (cached para no re-computar).

### 6. Admin moderation — tab "Foro" en `/admin`

**Componente nuevo** `src/components/admin/ForumModeration.tsx`:

- Listado de topics (todos: activos + deleted).
- Búsqueda por título/autor.
- Filtro por status.
- Botón "Force delete" en cada uno (envía a `/api/admin/forum/delete`).
- Click en topic → detalle con replies + force delete por reply.

Tab nuevo en `AdminApp.tsx` con icono y color distintivo (rojo/orange para denotar moderación).

### 7. Audit log

Sumar a `AuditAction`:

- `create_forum_topic`
- `delete_forum_topic` (propio o admin)
- `create_forum_reply`
- `delete_forum_reply`
- `like_forum_topic`
- `admin_delete_forum_topic` (distingue de soft-delete propio)
- `admin_delete_forum_reply`

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Sumar `FORUM_TOPICS` a `COLLECTIONS`.
3. Sumar acciones nuevas a `AuditAction`.
4. Crear los 6 endpoints `/api/forum/*` y 1 endpoint `/api/admin/forum/delete`.
5. Actualizar `firestore.rules` con bloques `forum_topics` + subcolecciones.
6. Reescribir `ForumEngine.tsx`.
7. Crear `src/components/admin/ForumModeration.tsx`.
8. Sumar tab `FORUM` al `AdminApp.tsx`.
9. Sumar acciones nuevas al visor de `AuditLog.tsx`.
10. Build + commit + push.

## Criterios de aceptación

- [x] Anónimo en `/comunidad`: ve gate "Identifícate" con link a `/login`.
- [x] User logueado: puede crear topic, lo ve en la lista al refrescar.
- [x] Click en topic incrementa `views`.
- [x] Reply funciona (textarea → Send → aparece en lista).
- [x] Like toggleable, counter persiste.
- [x] Author del topic ve botón "Eliminar"; al click → soft delete → desaparece de la lista.
- [x] Otros users NO ven el botón "Eliminar".
- [x] Admin en `/admin/dashboard` → tab "Foro" → ve todos los topics + force-delete.
- [x] Audit log captura todas las acciones (create/delete/like) con uid + topic id.
- [x] Las rules bloquean writes directos del cliente Web SDK a `forum_topics`.

## Pruebas manuales

1. Modo incógnito → `/comunidad` → ver gate de identificación.
2. Login user → ir a `/comunidad` → crear topic "Test SPEC-033" categoría Ayuno → debería aparecer en la lista.
3. Refrescar → topic persiste con replyCount=0, likeCount=0, views=1.
4. Click en topic → views sube a 2 (incrementa al abrir).
5. Escribir reply "primer comentario" → click Send → aparece en la lista de replies.
6. Click en corazón → likeCount sube a 1, botón destacado.
7. Click de nuevo → likeCount baja a 0.
8. Botón "Eliminar" del topic propio → confirma → desaparece de la lista pública.
9. Firebase Console → ver que el doc NO se borró, solo cambió `status` a `deleted`.
10. Login admin → `/admin` → tab Foro → ver el topic con badge "Eliminado" + opción restaurar (out of scope: solo force delete por ahora).
11. Como otro user (incógnito + nueva cuenta), abrir un topic ajeno → confirmar que NO ves el botón "Eliminar".
12. Tab Audit log → ver entries `create_forum_topic`, `like_forum_topic`, etc.
13. Como user normal, intentar escribir directo a `forum_topics` desde Web SDK con DevTools → rules bloquean.

## Riesgos y trade-offs

- **Counters denormalizados pueden divergir** si una transaction falla a mitad. Las transactions atómicas de Admin SDK previenen esto, pero hay un edge case con replies/likes batch: si Carlos quiere certeza absoluta, un script de reconciliación puede correr `count()` de subcolecciones y reescribir.
- **Sin paginación de topics**: limit 100 por ahora. Cuando crezca, agregamos cursor.
- **Sin búsqueda full-text**: la search es client-side sobre los 100 topics cargados. Si crece, considerar Algolia / Typesense.
- **Sin notificaciones**: cuando alguien responde tu topic, no recibís nada. Out of scope. Si hace falta, una micro-spec con email transaccional (reusar `lib/email.ts`).
- **Sin reportar abuso por user**: solo admin force-delete. Suficiente al volumen actual.
- **Soft delete preserva el doc**: pesa Firestore. A escala, agregar tarea programada de hard-delete >30 días.

## Compatibilidad con ElenaApp

ElenaApp puede leer `forum_topics` para mostrar foro embebido. Sin acoplamiento adicional.

## Commit

```
feat(spec-033): foro funcional con persistencia firestore (La Tribu)

- COLLECTIONS.FORUM_TOPICS + 7 endpoints (4 user, 1 admin)
- Endpoints con Admin SDK + transactions atómicas; rules bloquean
  writes directos del cliente
- ForumEngine.tsx reescrito: persistencia real, gating solo logueado,
  topics/replies/likes/soft delete propio, avatar con inicial + color
  determinista del hash del uid
- ForumModeration.tsx + tab FORUM en AdminApp para force-delete
- Audit log: 7 acciones nuevas (create/delete/like + admin variants)

Cierra SPEC-033.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/lib/constants/firestore.ts` — `FORUM_TOPICS = 'forum_topics'`.
- `metamorfosis-web/src/lib/auditLog.ts` — 7 acciones nuevas en `AuditAction`.
- `metamorfosis-web/src/pages/api/forum/topics.ts` — GET (list) + POST (create).
- `metamorfosis-web/src/pages/api/forum/topics/[id]/index.ts` — GET (detail+views) + DELETE (soft propio).
- `metamorfosis-web/src/pages/api/forum/topics/[id]/replies.ts` — POST.
- `metamorfosis-web/src/pages/api/forum/topics/[id]/replies/[replyId].ts` — DELETE.
- `metamorfosis-web/src/pages/api/forum/topics/[id]/like.ts` — POST (toggle).
- `metamorfosis-web/src/pages/api/admin/forum/delete.ts` — DELETE force.
- `firebase/firestore.rules` — bloque `forum_topics/{topic}` + subcolecciones.
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — reescritura completa.
- `metamorfosis-web/src/components/admin/ForumModeration.tsx` — visor admin.
- `metamorfosis-web/src/components/admin/AdminApp.tsx` — tab `FORUM` con lazy load.
- `metamorfosis-web/src/components/admin/AuditLog.tsx` — 7 entries nuevas en STATUS_META.

**Decisiones tomadas en la marcha:**
- **`authorColorIdx` cached en el doc**: evita recomputar hash en cada render. Determinista del uid: el mismo user siempre se ve igual.
- **Sin paginación todavía**: limit 100, suficiente para arrancar. Cuando crezca, cursor.
- **Soft delete (no hard)**: preserva audit trail y permite restauración futura. Pesa Firestore en exceso a escala — agregar limpieza programada >30 días en una micro-spec.
- **Lazy load del visor admin**: igual que SPEC-017 (Analítica) y SPEC-018 (AuditLog). El bundle del dashboard no crece para users que no abren foro.
- **El tab público `/comunidad` ya tiene padding correcto** (SPEC-026); no toco nada de layout.

**Sin desviaciones del plan funcional.**
