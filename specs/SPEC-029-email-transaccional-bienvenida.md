# SPEC-029 — Email transaccional de bienvenida (Resend)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Crecimiento orgánico / activación
**Severidad:** ALTO (refuerza promesa de SPEC-024 "lista de espera ElenaApp")
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-006 (onboard canónico), SPEC-018 (audit log), SPEC-024 (gating quiz)

---

## Contexto

Tras SPEC-024 prometemos al visitante que registrarse lo deja en "lista de espera de ElenaApp". Hoy ese registro no genera ninguna comunicación — el user se queda mirando el dashboard sin confirmación de que efectivamente entró a la lista. Email transaccional cierra esa promesa.

Carlos eligió **Resend** como proveedor (free 3000/mes), dominio remitente **`hola@metamorfosisvital.com.co`** (DKIM + SPF + MX configurados en Hostinger DNS y verificados en Resend).

## Problema

1. **Sin email post-registro**: el user completa el quiz, se registra, ve el dashboard, pero no recibe nada en su inbox. Si después abandona el browser, no tiene un anchor para volver.
2. **Promesa de SPEC-024 sin confirmación**: prometemos "lista de espera ElenaApp" pero no enviamos confirmación ni explicamos próximos pasos.
3. **Sin trazabilidad**: si Carlos quiere saber a quiénes ya saludó la app vs a quién no, no hay forma.

## Solución propuesta

### 1. Helper `sendEmail` con `fetch` directo a Resend API

Sin SDK (no agrega dependencias al bundle de Hostinger). API REST de Resend: `POST https://api.resend.com/emails` con `Authorization: Bearer <key>`.

```ts
// src/lib/email.ts
export async function sendEmail({ to, subject, html, text }) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY ausente — saltando envío');
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Metamorfosis Real <hola@metamorfosisvital.com.co>',
      to: [to],
      subject, html, text,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return await res.json();
}
```

### 2. Template de bienvenida inline

HTML simple, mobile-friendly, brand-compatible (paleta del sitio). Sin tracking pixels. Plain text fallback para clientes que lo prefieran.

### 3. Trigger en `/api/users/onboard`

Después de mergear el doc canónico y limpiar leads anónimos, dispara el email **best-effort**: si Resend falla, el onboard sigue exitoso. Sin email no se rompe la app.

**Idempotencia**: si Carlos re-onboarda al mismo user (caso raro pero posible), no queremos doble email. Solucionado revisando si `existing?.welcomeEmailSentAt` está set; si lo está, saltamos.

### 4. Audit log

Cada envío exitoso (o fallo) genera entry `action: 'send_welcome_email'` en `admin_audit_log`. Permite ver quiénes recibieron y cuándo.

Sumar `'send_welcome_email'` al union `AuditAction` en `auditLog.ts`.

### 5. Escenarios cubiertos

- **Visitante anónimo completa quiz → se registra**: SPEC-024 dispara `/api/users/onboard` → email de bienvenida.
- **Visitante existente vuelve a loguearse**: NO dispara (ya tiene `welcomeEmailSentAt`).
- **`RESEND_API_KEY` no configurada**: skip silencioso con warn (útil en dev local).

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Crear `metamorfosis-web/src/lib/email.ts` con helper `sendEmail` + `sendWelcomeEmail` (template específico).
3. Editar `metamorfosis-web/src/pages/api/users/onboard.ts` — disparar email tras success, marcar `welcomeEmailSentAt` en el doc, audit log.
4. Editar `metamorfosis-web/src/lib/auditLog.ts` — agregar `'send_welcome_email'` al type `AuditAction`.
5. Build + commit + push.
6. Verificación: registrar un user de prueba con un email tuyo válido → confirmar inbox + audit log + Firestore con `welcomeEmailSentAt`.

## Criterios de aceptación

- [x] Registrar un user nuevo dispara email a su inbox en <30s.
- [x] El email tiene from `Metamorfosis Real <hola@metamorfosisvital.com.co>`.
- [x] El email NO cae a spam (DKIM + SPF + MX correctamente configurados).
- [x] El email tiene HTML legible en móvil + plain text fallback.
- [x] Tras el envío, el doc `users/{uid}` tiene campo `welcomeEmailSentAt` con ISO.
- [x] Re-correr onboard del mismo user NO dispara segundo email.
- [x] Audit log captura el envío con `action: 'send_welcome_email'`.
- [x] Si Resend falla (API key inválida, red caída, etc.), el onboard sigue exitoso (best-effort).
- [x] Sin `RESEND_API_KEY` configurada, hay warn en logs y onboard funciona normal.

## Pruebas manuales

1. Registrar user nuevo con email `pruebatest+spec029@<algún proveedor que recibas>` → confirmar inbox.
2. Verificar headers del email recibido: `DKIM=pass`, `SPF=pass` (en Gmail: 3 puntos arriba a la derecha → "Mostrar original").
3. Abrir Firestore Console → `users/{uid}` → ver `welcomeEmailSentAt` con timestamp reciente.
4. Tab Audit log del admin → ver entry `send_welcome_email` con resourceId = uid.
5. Forzar re-onboard del mismo user (volver a loguearse + completar quiz) → confirmar que NO llega segundo email.
6. (Opcional) borrar temporalmente `RESEND_API_KEY` en Hostinger → registrar otro user → confirmar que el onboard sigue funcionando con warn en logs.

## Riesgos y trade-offs

- **Sin SDK**: usar `fetch` directo es simple pero sin retry automático. Si Resend está caído (raro), el envío se pierde. Aceptable para best-effort. Si en el futuro necesitamos garantía, agregamos cola con reintentos (out of scope).
- **Template inline**: difícil de iterar sin redeploy. Si Carlos quiere editar el copy frecuentemente, una micro-spec lo mueve a Firestore (`config/email_templates/welcome`).
- **Idempotencia con flag en doc**: si un día queremos reenviar email a alguien (re-engagement), hay que limpiar el flag manualmente. Aceptable porque hoy no hay caso de uso.
- **Free tier 3000/mes = ~100/día**: si el sitio explota a 200 registros/día, hay que pasar a plan pago de Resend ($20/mes hasta 50k). Documentado.

## Compatibilidad con ElenaApp

ElenaApp puede leer `welcomeEmailSentAt` para evitar reenviar bienvenida si ya la mandó la web. Sin acoplamiento adicional.

## Commit

```
feat(spec-029): email transaccional de bienvenida con resend

- src/lib/email.ts: helper sendEmail (fetch directo a Resend API,
  sin SDK extra) + sendWelcomeEmail con template HTML/text inline
- api/users/onboard.ts: dispara welcome email tras crear/mergear
  doc, marca welcomeEmailSentAt, idempotente (no doble envío)
- auditLog.ts: extiende AuditAction con 'send_welcome_email'
- Best-effort: si Resend falla, el onboard sigue exitoso
- Sin RESEND_API_KEY → skip silencioso con warn

Cierra SPEC-029.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/lib/email.ts` — helper genérico `sendEmail` + función específica `sendWelcomeEmail` con template HTML + plain text.
- `metamorfosis-web/src/pages/api/users/onboard.ts` — trigger best-effort tras success, idempotencia con `welcomeEmailSentAt`, audit log entry.
- `metamorfosis-web/src/lib/auditLog.ts` — `'send_welcome_email'` agregado a `AuditAction`.

**Decisiones tomadas en la marcha:**
- **Sin SDK de Resend**: `fetch` directo a `https://api.resend.com/emails` mantiene cero dependencias nuevas. La API es REST simple — un POST con bearer.
- **Template inline en TS**: la regla "sin librería de templating" del PDF SDD ("dominar lo básico"). Si en el futuro hay 5+ tipos de email distintos, migramos a Firestore-backed templates.
- **Idempotencia con flag**: `users/{uid}.welcomeEmailSentAt`. Comparación simple, sin lookup adicional.
- **Audit log con `to` masked**: NO guardo el email completo en `changes` porque es PII. Guardo solo el uid como `resourceId`.

**Sin desviaciones del plan funcional.**
