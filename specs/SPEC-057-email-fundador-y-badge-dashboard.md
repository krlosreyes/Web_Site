# SPEC-057 — Email de fundador diferenciado + badge en dashboard

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — comunicación
**Severidad:** ALTO (cumplimiento del compromiso con fundadores)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-029 (Resend), SPEC-056 (cohorte fundadores)

---

## Contexto

Después de SPEC-056 el sistema marca atómicamente quién es fundador y
quién no. Hace falta **comunicarle al usuario** que es fundador y mostrarle
sus beneficios. Dos canales:

1. **Email transaccional**: enviado en el onboard, antes que el user mire
   el sitio de vuelta. Diferenciado según cohorte:
   - Founder: subject "Eres fundador #N", bloque visual con el número
     grande, lista de los 2 beneficios garantizados.
   - Estándar (post-1000): bienvenida cálida sin mención del beneficio
     fundador (evita FOMO innecesario).

2. **Badge en el dashboard del user**: visible siempre que `founder.isFounder=true`.
   Cumple doble función:
   - Reconocimiento permanente cada vez que el user vuelve.
   - **Fallback al email**: si por cualquier motivo el correo no llegó
     (filtro de spam, dirección con typo, Resend caído), los beneficios
     siguen visibles dentro del producto.

## Solución

### 1. Refactor de `lib/email.ts`

- Helper interno `wrapEmailHtml({subject, heading, bodyHtml})`: layout
  común (header + footer + branding) extraído para evitar duplicación.
- Constantes `RESOURCES_HTML` y `RESOURCES_TEXT`: bloque "lo que ya tienes
  disponible" (dashboard, biblioteca, comunidad, YouTube) reusado en ambos
  templates.
- `sendFounderWelcomeEmail({to, name, founderNumber})`: subject "Eres
  fundador #N de Metamorfosis Real". Bloque destacado con el número grande
  + 2 beneficios + frase explicativa ("no tienes que hacer nada").
- `sendStandardWelcomeEmail({to, name})`: subject "Bienvenido a Metamorfosis
  Real, {name}". Tono cálido sin mencionar fundadores.
- `sendWelcomeEmail` se mantiene como alias deprecado que llama al estándar
  (retrocompatibilidad si algún caller olvida pasar founderNumber).

### 2. Onboard elige el template

En `POST /api/users/onboard`, después de `assignFounderIfEligible`:

```ts
const isFounder = founderAssignment?.isFounder === true
    && typeof founderAssignment.number === 'number';

const result = isFounder
    ? await sendFounderWelcomeEmail({ to, name, founderNumber: founderAssignment.number! })
    : await sendStandardWelcomeEmail({ to, name });
```

Auditoría registra el tipo enviado con `action: 'send_founder_welcome_email'`
o `'send_welcome_email'` + `founderNumber` en `changes`.

### 3. Badge en `BioDashboard.tsx`

Nuevo state `founderNumber: number | null` (poblado desde `data.founder.number`
si `data.founder.isFounder === true`). Banner renderizado encima del header
del dashboard cuando hay número:

- Background: gradiente sutil `amber-500/10 → yellow-500/5 → #00C49A/10`.
- Border: `amber-400/30`.
- Glow: blur radial amber en la esquina derecha.
- Contenido a la izquierda: pill "🎁 Acceso fundador" + número grande
  (`#42`) con gradiente amber→teal + "de los primeros 1000".
- Contenido a la derecha: heading + 2 beneficios numerados (precio
  permanente + sorpresa) + nota "sin acción requerida".

## Plan de ejecución

1. Editar `lib/email.ts`:
   - Extraer `wrapEmailHtml`, `RESOURCES_HTML`, `RESOURCES_TEXT`.
   - Crear `sendFounderWelcomeEmail`.
   - Crear `sendStandardWelcomeEmail`.
   - Mantener `sendWelcomeEmail` como alias deprecado.
2. Editar `pages/api/users/onboard.ts`:
   - Import de ambas funciones nuevas.
   - Decisión if/else según `founderAssignment.isFounder`.
   - Audit log con action diferenciada.
3. Editar `components/BioDashboard.tsx`:
   - Agregar `founderNumber: number | null` a `DashboardStats` + default.
   - Poblar el campo desde `data.founder` en `fetchUserData`.
   - Renderizar banner amber/teal con número + 2 beneficios + nota.
4. Build local + commit + push.

## Criterios de aceptación

- [x] `sendFounderWelcomeEmail` y `sendStandardWelcomeEmail` existen y son exportadas.
- [x] Templates de fundador muestran el número grande + 2 beneficios.
- [x] Templates estándar NO mencionan beneficios fundador.
- [x] Onboard elige correctamente según `founderAssignment.isFounder`.
- [x] Audit log diferencia acción por tipo de email.
- [x] BioDashboard muestra banner solo si `founder.isFounder === true`.
- [x] Banner incluye número + 2 beneficios + frase "sin acción requerida".
- [ ] Post-deploy: registrarse en home → recibir email "Eres fundador #N" en bandeja real.
- [ ] Post-deploy: dashboard del fundador muestra banner amber con número.
- [ ] Post-deploy: si manualmente seteamos `founderCount=1000` y registramos otro user, recibe email estándar (no founder) y dashboard NO muestra banner.

## Pruebas manuales

### Email fundador
1. Registrarse con email nuevo (incógnito, primer registro de prueba).
2. En 1-2 minutos, llegar email "Eres fundador #1 de Metamorfosis Real".
3. El email debe mostrar el bloque destacado con #1 grande + 2 beneficios.

### Email estándar
1. En Firebase Console: editar `system/counters.founderCount = 1000`.
2. Registrarse con OTRO email nuevo.
3. Llega email "Bienvenido a Metamorfosis Real, {nombre}" SIN mención
   de beneficios fundador.
4. Restaurar `founderCount` al valor real.

### Badge dashboard (fallback visual)
1. Como fundador (de los primeros 1000), abrir `/dashboard`.
2. Ver banner amber con `#N` + 2 beneficios encima del header "Hola, Carlos".
3. Como user post-1000 (sin `founder.isFounder=true`), abrir `/dashboard`.
4. NO debe haber banner amber.

## Riesgos y trade-offs

- **Email pierde nuestra reputación de remitente**: si Resend marca el
  dominio como spam por volume spike, los founders no reciben el correo.
  Mitigación: el dashboard muestra los beneficios igual.
- **Banner visual puede ser ruidoso si el user no entiende el contexto**:
  la nota "sin acción requerida" + el iconito 🎁 deberían dar suficiente
  contexto. Si testing posterior muestra confusión, agregar tooltip
  "¿Qué es esto?".
- **Si `founder.isFounder=false` (post-1000), el banner no aparece**:
  esperado. El user normal no necesita ver beneficios que no le aplican.
- **El alias deprecado `sendWelcomeEmail` puede crear ambigüedad**:
  marcado `@deprecated` en el JSDoc. Cualquier caller nuevo debe usar
  `sendFounderWelcomeEmail` o `sendStandardWelcomeEmail` explícitamente.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos modificados:**
- `metamorfosis-web/src/lib/email.ts` — refactor: 3 helpers comunes
  (`wrapEmailHtml`, `RESOURCES_HTML`, `RESOURCES_TEXT`) + 2 funciones
  públicas nuevas + alias deprecado para retrocompatibilidad.
- `metamorfosis-web/src/pages/api/users/onboard.ts` — imports cambiados,
  decisión if/else según `founderAssignment`, audit log diferenciado.
- `metamorfosis-web/src/components/BioDashboard.tsx` — nuevo state
  `founderNumber`, carga desde `data.founder`, banner amber/teal con
  número + 2 beneficios + nota.

**Decisiones:**
- Todo el copy en español neutro (sin voseo) siguiendo SPEC-054 y la regla
  ahora en CLAUDE.md.
- El banner usa amber + teal (no solo azul) para diferenciar visualmente
  del resto del dashboard, que es predominantemente azul/cyan. Da
  jerarquía: "esto es ESPECIAL, no es otro card más".
- "Sin acción requerida" se enfatiza tanto en el email como en el banner
  para evitar que el user piense que tiene que guardar un código o algo
  similar. El Firebase Auth compartido con ElenaApp hace el matching
  automático.
- `wasAssignedNow` del helper de SPEC-056 NO se usa todavía para evitar
  reenviar emails — eso ya lo cubre el flag `welcomeEmailSentAt` que
  existe desde SPEC-029.

**Próximas specs:**
- SPEC-058: dashboard admin "Fundadores" — vista en tiempo real con
  tabla, progreso, export CSV.

Sin desviaciones del plan.
