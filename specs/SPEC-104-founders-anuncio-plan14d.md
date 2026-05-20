# SPEC-104 — Anuncio del Plan IMR 14d a fundadores existentes

**Estado:** 🔨 En progreso (código listo, pendiente: `npm run build` + commit + push + click del botón en admin)
**Fase:** Operación de cohorte (post-SPEC-101)
**Severidad:** ALTA (6 fundadores activos sin enterarse de un beneficio entregable hoy)
**Fecha de creación:** 2026-05-19
**Autor:** Carlos Reyes
**Depende de:** SPEC-029 (email transaccional), SPEC-056 (cohorte fundadores), SPEC-058 (tab admin), SPEC-100 (plan 14d), SPEC-101 (progresión)

---

## Contexto

Carlos tiene **6 fundadores activos** que se registraron antes de que existiera el Plan IMR de 14 días (SPEC-100). Técnicamente el plan ya está accesible para ellos: la card en `BioDashboard` aparece automáticamente cuando hay `imr.current.blocks` válidos, y los 6 founders ya hicieron el quiz (por eso son founders). El problema es comunicacional: no se enteraron del nuevo beneficio.

## Problema

Falta un mecanismo para:

1. **Notificar a los 6 fundadores existentes** sobre el plan 14d que ya está disponible para ellos.
2. **Idempotencia operativa**: si el botón se presiona dos veces, no enviar dos emails al mismo usuario.
3. **Reusabilidad** para fundadores futuros (la cohorte sigue creciendo).

## Solución propuesta

Email transaccional + endpoint admin + botón en el tab Fundadores existente. Estructura:

### Schema (campo nuevo)

```ts
// types/user.ts → UserFounder
export interface UserFounder {
    isFounder: boolean;
    number: number | null;
    assignedAt: string | null;
    /** SPEC-104: timestamp ISO del email de anuncio del plan 14d. null = pendiente. */
    planAnnouncementSentAt?: string | null;
}
```

Campo opcional aditivo. NO requiere bump de `schemaVersion`. Rules ya restringen `founder.*` a Admin SDK (línea 47 de `firestore.rules`), perfecto para este caso — el cliente no debe escribirlo, solo el endpoint admin.

### Email template nuevo

`sendFounderPlanAnnouncementEmail({ to, name })` en `lib/email.ts`. Genérico (no personalizado por pilar débil — al hacer click llegan al dashboard donde sí está personalizado). Subject: *"Nuevo beneficio: tu Plan IMR de 14 días está listo"*.

Estructura del email:

1. **Greeting** con nombre del usuario
2. **Anuncio del beneficio nuevo** — "como parte del cohorte fundador, ahora tienes acceso a..."
3. **Qué es el plan 14d** — explicación de 2-3 oraciones
4. **Cómo funciona la progresión** — secuencial, día por día, persistente
5. **CTA** a `/dashboard/plan`
6. **Bloque "lo que ya tienes disponible"** reusado de `RESOURCES_HTML`

### Endpoint nuevo

`POST /api/admin/founders/announce-plan`:

- Auth gate cookie admin.
- Query: `users WHERE founder.isFounder = true`.
- Filtra in-memory los que NO tienen `planAnnouncementSentAt`.
- Itera secuencialmente:
  - Envía email con `sendFounderPlanAnnouncementEmail`.
  - Si éxito: actualiza `users/{uid}.founder.planAnnouncementSentAt = nowIso` via Admin SDK.
  - Si fallo: registra en `failures[]` y continúa con el siguiente.
- Audit log por user enviado (`action: 'announce_plan_to_founder'`).
- Response: `{ total, pending, sent, failed, failures }`.

### UI admin

En `FoundersList.tsx`:

1. **Card destacada** en el header del tab (debajo del header existente) si `pendingAnnouncementsCount > 0`:
   ```
   🎯 Anuncio del Plan IMR 14d
   N fundadores aún no han recibido el aviso del nuevo beneficio.
   [ Enviar a N pendientes ]
   ```
2. **Columna nueva en la tabla**: "Plan 14d" con `✓` si `planAnnouncementSentAt` ≠ null, `—` si null.
3. **Botón "Enviar"**: confirm + POST → resultado en toast/alert + refresh de la tabla.
4. **Modificar `GET /api/admin/founders`** para incluir `planAnnouncementSent: boolean` en cada row.

## Plan de implementación

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1 | Agregar `planAnnouncementSentAt?` a `UserFounder` en types | `lib/types/user.ts` | 5 min |
| 2 | Email template `sendFounderPlanAnnouncementEmail` | `lib/email.ts` | 45 min |
| 3 | Endpoint `POST /api/admin/founders/announce-plan` | nuevo `pages/api/admin/founders/announce-plan.ts` | 1 h |
| 4 | Modificar `GET /api/admin/founders` para exponer `planAnnouncementSent` en cada row | `pages/api/admin/founders.ts` | 15 min |
| 5 | UI: card destacada + columna nueva + botón en `FoundersList.tsx` | `components/admin/FoundersList.tsx` | 45 min |
| 6 | Verificación sintaxis + grep voseo | sandbox | 15 min |
| 7 | Commit + push | git | 5 min |
| 8 | Smoke post-deploy (90-120s) + envío real a los 6 | producción | 20 min |

**Esfuerzo total estimado:** ~3.5 horas.

## Criterios de aceptación

- [ ] Schema `UserFounder` incluye `planAnnouncementSentAt?: string | null`.
- [ ] `sendFounderPlanAnnouncementEmail` genera email con asunto y cuerpo correctos, en tuteo neutro.
- [ ] `POST /api/admin/founders/announce-plan` es idempotente: 2 requests consecutivas envían 0 emails extra en la segunda.
- [ ] Si Resend falla para un user, los demás se procesan; el fallido queda con `planAnnouncementSentAt: null` y aparece en `failures[]`.
- [ ] Cada envío exitoso queda registrado en `admin_audit_log` con `action: 'announce_plan_to_founder'`, `resource: 'user'`, `resourceId: uid`.
- [ ] Tab Fundadores muestra card destacada con pendientes solo si N > 0.
- [ ] Tabla muestra columna "Plan 14d" con ✓ o — según estado.
- [ ] Click "Enviar a N pendientes" pide confirmación, ejecuta, muestra resultado, refresca tabla.
- [ ] Build limpio.
- [ ] Sin voseo.

## Pruebas manuales

```sh
cd metamorfosis-web && npm run build
```

**Smoke post-deploy:**

1. Login admin → tab Fundadores → ver card "🎯 Anuncio del Plan IMR 14d · 6 pendientes" + columna "Plan 14d" con "—" en las 6 filas.
2. Click "Enviar a 6 pendientes" → confirm → endpoint procesa → alert "6 enviados, 0 fallos" → tabla refresca → columna "Plan 14d" muestra ✓ en las 6 filas.
3. Click "Enviar" otra vez → card de pendientes desaparece (idempotencia: 0 a enviar).
4. Verificar bandeja de entrada de un fundador → recibe el email correctamente con CTA al dashboard.
5. Click CTA del email → llega a `/dashboard/plan` con su versión del plan.
6. Verificar `admin_audit_log` en Firestore → 6 entries con `action: 'announce_plan_to_founder'`.

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Resend rate limit con 6 envíos seguidos | Muy baja | Resend permite ~100 req/s para cuentas estándar. 6 secuenciales son triviales |
| Email cae en spam de algún usuario | Media | DKIM/SPF ya configurados (SPEC-029). Tono editorial, no marketing |
| Doble click en el botón → race condition | Baja | `setSending(true)` disabled state + endpoint idempotente por marca en Firestore |
| Carlos quiere personalizar copy del email | Alta (esperable) | Copy vive en `lib/email.ts` — itera con commits |
| Welcome email actual NO menciona el plan 14d → futuros founders pueden quedar sin enterarse | Media | Fuera de scope de esta spec. Si llega más fundadores en próximas semanas, abrir SPEC-105 para actualizar `sendFounderWelcomeEmail` con sección del plan |

## Fuera de scope (intencional)

- **Actualizar `sendFounderWelcomeEmail`** para futuros founders. Aceptamos que la card del dashboard los notificará. Si se quiere proactividad, SPEC-105 separada de 30 min.
- **Email personalizado por pilar débil**: complejidad x3 por marginal value. Al hacer click, el dashboard les muestra su versión personalizada.
- **Tracking del open rate del email**: requeriría integrar pixel de tracking; out of scope.
- **Re-envío selectivo por uid**: el endpoint envía a TODOS los pendientes. Si Carlos quiere re-enviar a uno específico, lo hace borrando `planAnnouncementSentAt` manualmente desde Firebase Console y volviendo a presionar el botón.

## Commit sugerido

```
feat(spec-104): anuncio del Plan IMR 14d a fundadores existentes

- Schema: campo opcional founder.planAnnouncementSentAt (idempotencia).
- Email: sendFounderPlanAnnouncementEmail con CTA al dashboard.
- Endpoint POST /api/admin/founders/announce-plan: bulk idempotente
  con audit log por user enviado.
- GET /api/admin/founders expone planAnnouncementSent (bool).
- UI: card destacada con conteo de pendientes + columna nueva en
  la tabla + botón "Enviar a N pendientes".

Cierra specs/SPEC-104-founders-anuncio-plan14d.md
```

## Resultado

**Implementación 2026-05-19 — código aplicado en una pasada:**

### Archivos nuevos (1)

- **`src/pages/api/admin/founders/announce-plan.ts`** (~140 líneas)
  - Endpoint `POST` con auth gate cookie admin (igual patrón que el resto de `/api/admin/founders/*`).
  - Query: `users WHERE founder.isFounder = true`, filtra in-memory los pendientes (`!planAnnouncementSentAt`).
  - Procesa secuencialmente: envío Resend → si éxito, `updateDoc('founder.planAnnouncementSentAt')` + `logAdminAction`. Si fallo, se acumula en `failures[]` y continúa con el siguiente.
  - Skip silencioso si `RESEND_API_KEY` no está set (`result.skipped`) — agregado a failures para visibilidad, no marca como enviado.
  - Response: `{ total, pending, sent, failed, failures }`.

### Archivos modificados (4)

- **`src/lib/types/user.ts`**: agregado campo opcional `planAnnouncementSentAt?: string | null` a `UserFounder` con JSDoc explicando idempotencia y que solo Admin SDK lo escribe.

- **`src/lib/email.ts`**: nueva función `sendFounderPlanAnnouncementEmail({ to, name })` (~85 líneas). Subject *"Nuevo beneficio: tu Plan IMR de 14 días está listo"*. Body en HTML responsive con badge destacado, sección "¿Qué es?", sección "¿Cómo funciona?" (4 bullets), CTA primario a `/dashboard/plan`, bloque de recursos reusado (`RESOURCES_HTML`). Versión texto plano paralela.

- **`src/pages/api/admin/founders.ts`**: campo `planAnnouncementSent: boolean` agregado a `FounderRow` y a la respuesta del GET. Calculado como `Boolean(data.founder?.planAnnouncementSentAt)`.

- **`src/components/admin/FoundersList.tsx`**:
  - State nuevo `isSendingAnnouncements` (disabled del botón).
  - `useMemo` para `pendingAnnouncementsCount`.
  - Handler `handleSendAnnouncements` con confirm + fetch POST + alert con resultados detallados (incluye lista de fallos si los hay) + refresh de la tabla.
  - Card destacada nueva entre el header y el toolbar — solo se renderiza si `pendingAnnouncementsCount > 0`. Copy diferenciado para singular/plural.
  - Columna nueva "Plan 14d" en la tabla (✓ enviado / — pendiente).
  - Columna nueva `plan14d_anuncio_enviado` en el CSV export.

### Verificaciones pasadas en sandbox

- Braces balanceados en los 5 archivos (user.ts 21/21, email.ts 45/45, founders.ts 35/35, announce-plan.ts 37/37, FoundersList.tsx 119/119).
- Cero voseo en archivos nuevos/modificados.
- Imports cruzados correctos: `sendFounderPlanAnnouncementEmail` exportado de `email.ts`, consumido por `announce-plan.ts`. `planAnnouncementSentAt` referenciado en types, endpoint y UI.
- Schema NO requiere bump de `meta.schemaVersion` (campo additive).
- Rules NO requieren cambio (escrituras a `founder.*` ya restringidas a Admin SDK).

### Pendiente para Carlos antes del envío

1. Build local:
   ```bash
   cd metamorfosis-web && npm run build
   ```

2. Commit + push:
   ```bash
   git add metamorfosis-web/src/lib/types/user.ts \
           metamorfosis-web/src/lib/email.ts \
           metamorfosis-web/src/pages/api/admin/founders.ts \
           metamorfosis-web/src/pages/api/admin/founders/announce-plan.ts \
           metamorfosis-web/src/components/admin/FoundersList.tsx \
           specs/SPEC-104-founders-anuncio-plan14d.md
   git commit -m "feat(spec-104): anuncio del Plan IMR 14d a fundadores existentes"
   git push
   ```

3. Smoke post-deploy (90-120s):
   - Login admin → tab Fundadores → ver card "🎯 Anuncio del Plan IMR 14d · 6 pendientes" + columna "Plan 14d" con "— pendiente" en las 6 filas.
   - Click "Enviar a 6 pendientes" → confirm → alert con "6 enviado(s), 0 fallo(s)" → tabla refresca → columna muestra ✓ en las 6 filas → card destacada desaparece.
   - Verificar bandeja de un fundador → recibe el email correctamente con asunto y CTA.
   - Click CTA del email → llega a `/dashboard/plan` con su versión personalizada.
   - Verificar `admin_audit_log` en Firestore → 6 entries con `action: 'announce_plan_to_founder'`.

**Cierre de spec:** al pasar las 5 verificaciones, cambiar Estado a ✅ Cerrada y agregar fecha de cierre.

### Limitación operativa documentada

- **Resend en sandbox sin API key**: si Carlos ejecuta esto en un entorno sin `RESEND_API_KEY` (por ejemplo dev local sin .env), el endpoint procesa, marca todos como fallos con razón "RESEND_API_KEY no configurada en runtime", y NO marca como enviado en Firestore. Un re-run en producción procesa correctamente.
- **Welcome email para futuros founders NO se actualiza** en esta spec. El bloque dashboard ya muestra la card del plan al hacer login, lo que cubre el caso. Si Carlos quiere proactividad explícita en el welcome email, abrir SPEC-105.
