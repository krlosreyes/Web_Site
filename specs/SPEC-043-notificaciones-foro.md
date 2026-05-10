# SPEC-043 — Notificaciones in-app del foro

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Engagement / retención
**Severidad:** ALTO (mecanismo principal de retención del foro)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-033, SPEC-038/039 (replies anidadas)

---

## Contexto

El foro funciona pero los users no vuelven al sitio cuando alguien les responde. **Sin notificaciones, no hay retención de la conversación.** Es la herramienta de retención más impactante de cualquier red social/foro.

## Solución

### 1. Modelo

```
users/{uid}/notifications/{notifId}
├── type: 'reply_to_topic' | 'reply_to_reply'
├── fromUid: string
├── fromName: string
├── topicId: string
├── replyId: string | null
├── topicTitle: string  (cached para listing)
├── snippet: string     (primeros 120 chars del reply)
├── read: boolean
└── createdAt: ISO
```

### 2. Triggers (server-side, en `replies.ts POST`)

- Reply al topic (parentReplyId=null) → notificar a `topic.authorUid` (si ≠ session.uid).
- Reply a otra reply → notificar a `parentReply.authorUid` (si ≠ session.uid).
- **Best-effort**: si la notif falla, el reply sigue exitoso (igual que audit log).

### 3. Endpoints

- `GET /api/users/me/notifications?limit=20` → últimas N + count de unread.
- `POST /api/users/me/notifications/read` → body `{ ids?: string[] }` o `{ all: true }`.

### 4. UI — `<NotificationBell />` en Navbar

- Componente React (`client:load`).
- Solo visible para users logueados con Firebase Auth.
- Campanita 🔔 con badge rojo de `unread count` arriba a la derecha.
- Click abre dropdown con las últimas 5 notifs.
- Click en una notif → marca read + linkea a `/comunidad?openTopic=<id>` (futuro deeplink).
- Botón "Marcar todas como leídas" en el dropdown.
- Polling cada 60s para nuevas notifs (sin websockets en v1).

### 5. Email digerido (out of scope v1)

Dejado como follow-up. La notif in-app cubre el 80% del valor. Si Carlos quiere email digerido posterior, una micro-spec sumando el job (probablemente con cron en Hostinger).

## Plan de ejecución

1. `src/lib/notifications.ts` — helper `createNotification(uid, payload)`.
2. `src/pages/api/forum/topics/[id]/replies.ts` — disparar notifs tras success.
3. `src/pages/api/users/me/notifications.ts` — GET (list) + POST (mark read).
4. `src/components/NotificationBell.tsx` — campanita + dropdown.
5. `Navbar.astro` — montar el bell para users logueados.
6. `firestore.rules` — `users/{uid}/notifications/{x}` read al dueño, write bloqueado.
7. Build + commit + push.

## Criterios de aceptación

- [x] User A crea reply al topic de User B → User B ve la campanita con badge "1".
- [x] User B click en bell → ve la notif con snippet del reply de User A.
- [x] Click en la notif → marca read + linkea al topic.
- [x] Auto-mensaje (responder a tu propio topic) NO genera notif.
- [x] Notif no bloquea la creación del reply si Firestore falla.
- [x] Polling refresca el count sin recargar la página.
- [x] User no logueado NO ve la campanita en Navbar.

## Riesgos y trade-offs

- **Polling cada 60s**: simple. Para escalar, websockets o Server-Sent Events. Out of scope.
- **Sin push notifications nativas**: solo in-app. Si querés Web Push, una capa adicional de service worker.
- **Snippet de 120 chars**: si el reply es más largo se trunca con "...".
- **Sin agrupación**: cada reply genera su propia notif. Si alguien responde 5 veces seguidas, son 5 notifs. Aceptable a este volumen.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/lib/notifications.ts` — helper `createNotification` (best-effort, no throws).
- `metamorfosis-web/src/pages/api/forum/topics/[id]/replies.ts` — dispara notifs según parentReplyId.
- `metamorfosis-web/src/pages/api/users/me/notifications.ts` — GET (list + unread count) + POST (mark read).
- `metamorfosis-web/src/components/NotificationBell.tsx` — campanita con dropdown, polling 60s.
- `metamorfosis-web/src/components/Navbar.astro` — monta bell solo para logged-in users (no admin).
- `firebase/firestore.rules` — bloque `users/{uid}/notifications/{notifId}` read auth, write bloqueado.

**Decisiones tomadas en la marcha:**
- **Polling 60s**: balance entre frescura y carga. Si Carlos lo encuentra muy lento, baja a 30s.
- **Notif client-side via Web SDK** para fetch (con onAuthStateChanged), no via endpoint custom: simplicidad.
- **Marca como read + click → window.location.href**: navegación full-page, no SPA. Coherente con el resto del sitio.

Sin desviaciones del plan funcional.
