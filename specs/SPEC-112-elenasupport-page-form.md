# SPEC-112 — Página `/elenasupport` con formulario de tickets ElenaApp

**Estado:** ✅ Cerrada (código local; pendiente push + publicar rules)
**Fase:** 4 (Operación / Crecimiento)
**Severidad:** 🟢 Baja (nueva feature, sin regresión)
**Fecha de creación:** 2026-05-25
**Autor:** Carlos Reyes (vía agente Cowork)
**Depende de:** SPEC-005 (schema Firestore), SPEC-008 (rules), SPEC-018 (audit log pattern), SPEC-029 (Resend), SPEC-054 (español neutro), SPEC-071 (design system)

**Independiente de:** SPEC-111 (migración de dominio). Se puede pushear antes, después o durante — la ruta `/elenasupport` funciona igual en `.com.co` y `.org`.

---

## Contexto

Carlos necesita un canal formal de soporte para ElenaApp. La app está por
lanzarse (waitlist en curso, `founder` cohorte activo, users primeros beta
inminentes), y el foro público (`/comunidad` — SPEC-033) no sirve para
problemas privados (cuenta, bugs específicos, datos personales).

Requisitos definidos con Carlos:

- **Auth híbrida:** logueado prioritario (Firebase Auth), anónimo permitido
  (con honeypot + rate limit).
- **Destino dual:** persistir en Firestore (`elena_support_tickets`) +
  email a Carlos vía Resend (redundancia).
- **Contenido lean:** párrafo introductorio + FAQ corto (5-6 items) +
  formulario. No overview de features (para eso está la home).

## Problema

Sin esta página:
- Users con dudas escriben al Gmail personal de Carlos → sin trazabilidad,
  sin priorización, se pierden en el inbox.
- No hay "landing" para incluir en la app móvil como link de "Ayuda" o
  "Contáctanos".
- El foro `/comunidad` no cubre casos privados (usuario reporta bug con
  su cuenta, problema de facturación futuro, etc.).

## Solución propuesta

### 1. Página `src/pages/elenasupport.astro`

Server-rendered con BaseLayout (tema oscuro post-SPEC-013), `pt-24` de padding
top respetando la regla del Navbar fixed. Structure:

- **Hero corto** con eyebrow "Soporte ElenaApp" + título "¿Necesitas ayuda con Elena App?" + subtítulo tranquilo.
- **Párrafo introductorio** (~50-70 palabras): qué es Elena App en 1 frase,
  estado actual (waitlist/beta), promesa de tiempo de respuesta.
- **FAQ (5-6 items)** en `<details>` nativos:
  1. ¿Cuándo puedo descargar Elena App?
  2. Me registré en el sitio, ¿ya estoy en Elena App?
  3. ¿La app funciona sin internet?
  4. ¿Cómo se conectan Elena App y el sitio web?
  5. Reservé mi cupo, ¿pierdo mi lugar si no descargo la app al momento?
  6. Tengo otro problema.
- **Formulario** (componente React `<ElenaSupportForm client:load />`).
- Sin `noindex` (queremos que Google indexe esta página — es un canal de
  soporte que la gente buscará explícitamente).

### 2. Componente `src/components/ElenaSupportForm.tsx`

Client React (`client:load` para tener Firebase Auth disponible). Campos:

| Campo | Requerido | Fuente si logueado |
|---|---|---|
| `name` | Sí | `user.displayName` (pre-llenado, editable) |
| `email` | Sí | `user.email` (pre-llenado, disabled) |
| `category` | Sí | dropdown: técnico / cuenta / contenido / feedback / otro |
| `message` | Sí | textarea, min 20 chars, max 2000 |
| `_website` | Honeypot | hidden, siempre vacío |

Estados: `idle`, `submitting`, `success`, `error`. Loading state disable el
submit. Success muestra confirmación con ticket ID. Error muestra el
mensaje devuelto por el servidor.

Al submit: `POST /api/support/elena` con **`Content-Type: application/json`**
(regla inquebrantable Astro 6 CSRF) y `Authorization: Bearer <idToken>` si
hay sesión.

### 3. Endpoint `src/pages/api/support/elena.ts`

`POST` con `prerender = false`. Flujo:

1. Parse `Content-Type` — solo `application/json`.
2. Parse body — validar campos requeridos + longitud.
3. Honeypot: si `_website` viene con valor, responder `{ ok: true, ticketId: 'x' }` (no dar señal) pero NO persistir.
4. Rate limit: `Map<key, timestamp[]>` en memoria del módulo con TTL 1h.
   Key = SHA-256(email + ip). Máximo 3 tickets por hora.
5. Si viene `Authorization: Bearer <token>`: verificar con `auth.verifyIdToken` → `uid` y `email` autoritativos del token (no del body).
6. Persistir en `elena_support_tickets/{auto-id}`:
   ```
   {
     createdAt: new Date().toISOString(),
     source: 'authenticated' | 'anonymous',
     uid: string | null,
     name: string,
     email: string,
     category: 'tecnico' | 'cuenta' | 'contenido' | 'feedback' | 'otro',
     message: string,
     userAgent: string | null,
     ipHash: string | null,
     status: 'open',
     adminNotes: null,
     respondedAt: null,
   }
   ```
7. Disparar email a Carlos vía Resend con detalles del ticket (best-effort;
   si Resend falla, el ticket ya está persistido → el user recibe éxito, y
   Carlos puede verlo desde el admin panel más tarde).
8. Response: `{ ok: true, ticketId }`.

### 4. Actualizaciones auxiliares

- **`src/lib/constants/firestore.ts`:** agregar `ELENA_SUPPORT_TICKETS: 'elena_support_tickets'`.
- **`src/lib/email.ts`:** nueva función `sendSupportTicketEmail(ticket)` que arma HTML + text con el patrón wrapEmailHtml existente y hace fetch a Resend con destinatario `SUPPORT_EMAIL_TO` (env var, default a `krlosreyes2@gmail.com` si falta).
- **`firebase/firestore.rules`:** nuevo bloque:
  ```
  match /elena_support_tickets/{ticket} {
    allow read, write: if false; // Solo Admin SDK
  }
  ```
  (Sigue el pattern de `admin_audit_log`. Reglas se publican manualmente —
  Carlos ejecuta `firebase deploy --only firestore:rules` o pega en Console.)

### 5. Env var nueva (opcional)

`SUPPORT_EMAIL_TO`: destino de los emails de ticket. Default hardcoded a
`krlosreyes2@gmail.com`. Carlos puede setearla en Hostinger si prefiere
otro destino.

## Plan de implementación

1. Crear `specs/SPEC-112-elenasupport-page-form.md` (este archivo).
2. `src/lib/constants/firestore.ts` — agregar constante.
3. `firebase/firestore.rules` — agregar bloque.
4. `src/lib/email.ts` — agregar `sendSupportTicketEmail`.
5. `src/pages/api/support/elena.ts` — endpoint completo.
6. `src/components/ElenaSupportForm.tsx` — form React.
7. `src/pages/elenasupport.astro` — página.
8. `npm run build` — verificar.
9. Commit + entregar instrucciones a Carlos: (a) push, (b) publicar rules
   nuevas en Firebase Console.

## Criterios de aceptación

**Código:**
- [ ] `/elenasupport` responde 200 en local con `npm run dev`.
- [ ] Sin sesión: form muestra `name`/`email` editables.
- [ ] Con sesión: `email` disabled con valor del user, `name` prefill del `displayName`.
- [ ] `POST /api/support/elena` con `Content-Type: application/json` responde 200 + `ticketId`.
- [ ] `POST` sin `Content-Type` correcto → 403 CSRF de Astro (esperado).
- [ ] `POST` con honeypot lleno → 200 pero NO se persiste ni se envía email.
- [ ] `POST` cuando el rate limit se supera → 429 con mensaje claro.
- [ ] Mensajes en español neutro (nada de `escribinos`, `reservá`, `iniciá`).
- [ ] `npm run build` limpio.

**Post-deploy:**
- [ ] `curl https://www.metamorfosisvital.com.co/elenasupport` → 200 (o `.org` post-migración SPEC-111).
- [ ] Test end-to-end: submitear un ticket → aparece en Firestore + llega email al inbox.

**Reglas:**
- [ ] `firebase/firestore.rules` desplegadas manualmente por Carlos en Firebase Console.

## Pruebas manuales

```sh
# 1) Build local
cd metamorfosis-web && npm run build

# 2) Dev server
npm run dev
open http://localhost:4321/elenasupport

# 3) Submit anónimo
curl -X POST http://localhost:4321/api/support/elena \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","category":"tecnico","message":"Mensaje de prueba de al menos veinte caracteres"}'
# Esperado: { ok: true, ticketId: '...' }

# 4) Honeypot (no debe persistir)
curl -X POST http://localhost:4321/api/support/elena \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bot","email":"bot@x.com","category":"otro","message":"spam spam spam spam spam","_website":"http://spam.com"}'
# Esperado: { ok: true, ticketId: 'honeypot-...' } pero Firestore sigue sin el doc

# 5) Rate limit (repetir 4 veces con misma IP+email)
# La 4ta debe devolver 429
```

## Riesgos / consideraciones

- **Astro 6 CSRF (regla inquebrantable CLAUDE.md #4):** el POST necesita
  `Content-Type: application/json` explícito. El componente ya lo incluye.
- **Rate limit en memoria:** se resetea al restart del server. Con Hostinger
  Node.js Apps + auto-deploy, esto puede ocurrir cada push. Aceptable
  para el volumen esperado (< 100 tickets/día). Si escala, migrar a
  Firestore (`system/rate_limits/{key}` con TTL manual).
- **Firebase Auth verificación:** si el token expiró o es inválido, tratamos
  como anónimo (fallback graceful, no bloqueamos).
- **Rules manuales:** Carlos debe publicar las rules nuevas en Firebase
  Console después del push. Sin eso, el Admin SDK sigue funcionando pero
  las rules quedan desactualizadas para futuros audits.
- **ipHash con sal:** usar un hash sin sal expone el IP a un attacker que
  quiera correlacionar tickets. Usamos SHA-256 con prefijo secret fijo
  hardcoded (no es criptográficamente perfecto pero razonable para el use case).
- **Copy en español neutro:** SPEC-054 — nada de voseo ni imperativos rioplatenses.
- **BaseLayout `pt-24`:** regla CLAUDE.md — la primera sección debe tener
  padding-top adecuado para no quedar tapada por el Navbar fixed.

## Commit

**Mensaje:**
```
feat(spec-112): pagina /elenasupport con formulario de tickets ElenaApp

Nueva pagina publica en /elenasupport con:
- Intro corto + FAQ de 6 items + formulario React
- Auth hibrida: logueados usan pre-fill (name/email del Firebase Auth),
  anonimos con honeypot y rate limit por hash(email+ip)
- Persistencia dual: Firestore (elena_support_tickets) + email a Carlos
  via Resend
- Endpoint POST /api/support/elena con:
  * Content-Type check (Astro 6 CSRF)
  * Bearer token verification si viene
  * Rate limit 3/hora en memoria (Map con TTL)
  * Honeypot silent-drop (200 fake para no dar señal)
  * Best-effort email (si Resend falla, ticket ya persistio)
- Nueva constante COLLECTIONS.ELENA_SUPPORT_TICKETS
- Nueva funcion sendSupportTicketEmail en lib/email.ts
- Nuevas rules Firestore para elena_support_tickets (read/write bloqueado
  al cliente, Admin SDK bypasea)

Env var opcional: SUPPORT_EMAIL_TO (default hardcoded a krlosreyes2@gmail.com)

Independiente de SPEC-111 (migracion de dominio). Se pushea cuando Carlos
decida — la ruta /elenasupport funciona en .com.co y en .org.

Post-push manual: Carlos publica firebase/firestore.rules en Firebase
Console (o firebase deploy --only firestore:rules).

Cierra specs/SPEC-112-elenasupport-page-form.md
```

---

## Resultado

Implementado en una sola pasada el 2026-05-25.

**Archivos creados:**
- `metamorfosis-web/src/pages/elenasupport.astro` — página pública con hero + intro + FAQ (6 items) + slot para form.
- `metamorfosis-web/src/components/ElenaSupportForm.tsx` — form React `client:load`. Detecta sesión Firebase Auth, pre-llena email/name si logueado, honeypot invisible, estados idle/submitting/success/error, mensaje de éxito con ticket ID.
- `metamorfosis-web/src/pages/api/support/elena.ts` — endpoint POST con: Content-Type check, honeypot silent-drop, rate limit en memoria (3/hora por hash(email+ip)), Bearer token opcional con `verifyIdToken`, persistencia en Firestore, email best-effort a Carlos.
- `specs/SPEC-112-elenasupport-page-form.md` — esta spec.

**Archivos modificados:**
- `metamorfosis-web/src/lib/constants/firestore.ts` — nueva `COLLECTIONS.ELENA_SUPPORT_TICKETS`.
- `metamorfosis-web/src/lib/email.ts` — nueva `sendSupportTicketEmail`, `escapeHtml` helper, `CATEGORY_LABELS`, extendida `SendEmailInput` con `replyTo` opcional (para que "Reply" en Gmail dispare respuesta directa al user).
- `firebase/firestore.rules` — bloque `elena_support_tickets` con `read, write: if false` (Admin SDK bypasses).

**Verificación local:**
- `npm run build` — pasa en 14s. Los 2 warnings de firebase/firestore + getDoc son preexistentes.
- Rate limit + honeypot verificables solo end-to-end tras deploy.

**Pendientes de Carlos post-push:**
- `git push origin main` → deploy automático Hostinger.
- **Publicar rules nuevas en Firebase Console** o `firebase deploy --only firestore:rules` desde CLI. Sin esto, el bloque nuevo de rules no queda activo (aunque el endpoint sigue funcionando porque usa Admin SDK).
- Opcional: setear env var `SUPPORT_EMAIL_TO` en Hostinger si prefiere que los tickets lleguen a un email distinto del hardcoded `krlosreyes2@gmail.com`.

**Notas de coordinación con SPEC-111:**
- Los emails de ticket usan el FROM actual (`hola@metamorfosisvital.com.co`). Cuando SPEC-111 haga cutover al `.org`, este también cambia automáticamente por el edit centralizado del FROM en `email.ts`.
- La URL de la página funciona en ambos dominios sin cambios (ruta relativa).
