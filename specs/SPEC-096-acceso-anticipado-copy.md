# SPEC-096 — Renombrar "fundador" a "acceso anticipado" en copy user-facing

**Estado:** ✅ Cerrada (pendiente de `npm run build` + commit local)
**Fase:** Pre-lanzamiento — copy de conversión
**Severidad:** ALTO (la palabra "fundador" genera fricción transaccional y reduce conversión)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-055 (modal de ElenaApp), SPEC-056 (cohorte), SPEC-057 (email transaccional)

---

## Contexto

Carlos observó que la palabra "fundador" genera ansiedad en usuarios
hispanohablantes. En español el término tiene carga transaccional
fuerte: "fundador" implica para muchos lectores "alguien que puso
plata para fundar la empresa". La gente entra al sitio buscando
información de salud y se topa con "Sé fundador" → asume que cuesta
plata → cierra.

Analizamos 3 alternativas (Acceso Anticipado / Lista Prioritaria /
Beneficio Exclusivo) y elegimos una propuesta híbrida basada en
Lista Prioritaria con badge de Acceso Anticipado.

## Problema

El copy actual de `ElenaAppCTA` y `BioDashboard` usa "fundador" en
posiciones de alta visibilidad (badge, título, cards, CTA), lo que
reduce la conversión del modal de waitlist.

## Solución propuesta

Reemplazar el copy user-facing manteniendo intacto el schema interno
y el panel admin.

**Copy nuevo (propuesta híbrida final):**

```
Badge:    🚀 ACCESO ANTICIPADO
Título:   Reserva tu acceso gratis
Subtítulo:Sé de los primeros en usar ElenaApp y recibe beneficios
          exclusivos de lanzamiento.
Card 1:   💎 Precio preferencial
          Condiciones especiales por registro anticipado.
Card 2:   ✅ Sin obligación
          Solo apartas tu lugar. Decides después si quieres continuar.
CTA:      Reservar mi lugar gratis →
Footer:   Gratis · Sin tarjeta · 2 minutos
```

**Decisión clave:** mantener "Precio preferencial" VAGO (sin % concreto)
hasta que tengamos la decisión comercial final de cuál será el
descuento real al lanzar ElenaApp.

### Lo que NO cambia

- **Schema interno** (`users/{uid}.founder.isFounder`,
  `founder.number`, `system/counters.founderCount`, `FOUNDER_CAP`).
  Renombrar esos campos rompería SPECs 056-058, la integración con
  ElenaApp y el endpoint admin `/api/admin/founders`.
- **Panel admin `/admin/founders` y componente `FoundersList.tsx`.**
  Carlos pidió mantenerlo con "Fundadores" porque es uso interno y
  solo él lo ve.
- **Email transaccional NO se envía al lanzamiento del cambio** —
  pero el template del email sí se actualiza para que los próximos
  envíos usen el nuevo copy.

## Plan de implementación

1. **Modificar** `src/components/ElenaAppCTA.tsx` (modal del navbar):
   - Título "Sé fundador / Uno de los primeros 1000" → "Reserva tu
     acceso gratis".
   - Subtítulo nuevo.
   - Card 1: "Precio fundador" → "Precio preferencial".
   - Card 2: "Beneficios sorpresa" → "Sin obligación".
   - CTA "Reserva tu lugar — gratis →" → "Reservar mi lugar gratis →".
   - Footer "Sin tarjeta · 2 minutos · Sin spam" → "Gratis · Sin
     tarjeta · 2 minutos".
2. **Modificar** `src/components/BioDashboard.tsx` (banner post-registro):
   - "Fundador #N / Precio fundador permanente en la suscripción
     anual de ElenaApp + beneficios sorpresa que se revelan el día
     del lanzamiento" → "Acceso anticipado / Precio preferencial en
     ElenaApp + beneficios exclusivos de lanzamiento".
   - El número (`founderNumber`) ya no se muestra (consistente con
     SPEC-077). Verificar.
3. **Modificar** `src/lib/email.ts` (template del email transaccional):
   - Asunto "¡Eres fundador!" → "¡Tu acceso está reservado!".
   - Cuerpo: reemplazar todas las menciones de fundador por copy
     equivalente sin transaccionalidad.
4. **NO tocar** schema, admin panel, lógica de asignación
   (`lib/founders.ts`), endpoints admin.

## Criterios de aceptación

- [ ] `npm run build` no lanza errores.
- [ ] Modal de ElenaApp muestra el copy nuevo sin "fundador" en
      ninguna posición visible.
- [ ] Dashboard de un usuario con `founder.isFounder=true` muestra
      "Acceso anticipado" en lugar de "Fundador #N".
- [ ] El email transaccional preview (renderizado en
      `previewEmail()` si existe, sino mockeado) muestra el copy
      nuevo.
- [ ] Admin panel `/admin/founders` se mantiene intacto (sigue
      diciendo "Fundadores").
- [ ] Schema interno (`isFounder`, `founder.number`, `founderCount`)
      sin cambios.

## Pruebas

```sh
cd metamorfosis-web && npm run build

# Smoke post-deploy:
#   1. Anónimo en /, esperar 3s → modal aparece con badge "ACCESO
#      ANTICIPADO" y título "Reserva tu acceso gratis".
#   2. Verificar las 2 cards (Precio preferencial + Sin obligación).
#   3. CTA debe decir "Reservar mi lugar gratis →".
#   4. Usuario con isFounder=true en /dashboard ve "Acceso
#      anticipado" en el banner superior.
#   5. Admin → /admin/dashboard → tab Fundadores: sigue diciendo
#      "Cohorte Fundadores" (intacto).
```

## Riesgos / consideraciones

- **Disonancia interna vs externa.** El usuario lee "Acceso
  anticipado" pero en el doc Firestore figura como `isFounder=true`.
  Esto es deliberado y manejable — el admin lo ve internamente como
  "fundador" (su lenguaje operativo) mientras el usuario no se
  expone al término.
- **El próximo cambio comercial.** Cuando tengamos el descuento
  real definido, actualizamos "Precio preferencial" para mencionar
  el % o ventaja concreta. SPEC futura.
- **ElenaApp móvil.** El agente del repo Flutter debe sincronizar
  el copy de la app móvil para coherencia. Apuntar en el doc
  `PALETTE-FOR-ELENAAPP.md` o crear `COPY-FOR-ELENAAPP.md`.

## Commit

**Mensaje sugerido:**
```
feat(spec-096): renombrar "fundador" → "acceso anticipado" en copy

- ElenaAppCTA: nuevo título/subtítulo/cards/CTA/footer.
- BioDashboard: banner "Acceso anticipado · Precio preferencial".
- lib/email: template "¡Tu acceso está reservado!".
- Schema interno (isFounder, founder.*, founderCount) intacto.
- Admin panel /admin/founders intacto (uso interno).

Cierra specs/SPEC-096-acceso-anticipado-copy.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**Archivos tocados (4):**

- `src/components/ElenaAppCTA.tsx` — modal del navbar:
  - Título: "Sé fundador / Uno de los primeros 1000" →
    "Reserva tu acceso / Gratis · Sin tarjeta".
  - Subtítulo: "ElenaApp está casi lista. Reserva tu lugar y obtén
    beneficios exclusivos." → "Sé de los primeros en usar ElenaApp
    y recibe beneficios exclusivos de lanzamiento."
  - Card 1: "🎁 Precio fundador / Descuento permanente en la
    suscripción anual. Solo para los primeros 1000." →
    "💎 Precio preferencial / Condiciones especiales por registro
    anticipado."
  - Card 2: "🔒 Beneficios sorpresa / Se revelan el día del
    lanzamiento. Vas a querer estar adentro." → "✅ Sin obligación
    / Solo apartas tu lugar. Decides después si quieres continuar."
  - CTA: "Reserva tu lugar — gratis →" → "Reservar mi lugar gratis →".
  - Footer: "Sin tarjeta · 2 minutos · Sin spam" → "Gratis ·
    Sin tarjeta · 2 minutos".

- `src/components/BioDashboard.tsx` — banner post-registro:
  - Color: amber/500 → accent teal (alineado con el design system).
  - Emoji: 🎁 → 🚀.
  - Eyebrow: "Acceso fundador" → "Acceso anticipado".
  - Heading: "Estás dentro del cohorte fundador" → "Tu lugar en
    ElenaApp está reservado".
  - Body: "Precio fundador permanente en la suscripción anual de
    ElenaApp + beneficios sorpresa que se revelan el día del
    lanzamiento" → "Precio preferencial en ElenaApp + beneficios
    exclusivos de lanzamiento".

- `src/lib/email.ts` — template de email transaccional
  `sendFounderWelcomeEmail`:
  - Subject: "Eres fundador #N de Metamorfosis Real" →
    "Tu acceso anticipado a ElenaApp está reservado".
  - Body text + HTML actualizado para no mencionar "fundador" en
    ningún lugar visible al usuario. Cambió color del badge de
    amber a accent teal. El número del fundador ya no se muestra
    al user (consistente con SPEC-077 que removió el número de la
    UI). Función + parámetro siguen llamándose `sendFounderWelcomeEmail`
    + `founderNumber` por naming interno del schema.
  - Comentario del email estándar actualizado para reflejar el
    nuevo lenguaje.

- `src/pages/terminos.astro` — sección 5 de Términos legales:
  - Heading: "5. Cohorte fundador y beneficios futuros" →
    "5. Acceso anticipado y beneficios futuros".
  - Párrafo introductorio: "Los primeros 1000 usuarios registrados
    conforman el 'cohorte fundador' de ElenaApp..." → "Los primeros
    1000 usuarios registrados conforman el cohorte de acceso
    anticipado de ElenaApp..."

**Lo que NO se tocó (deliberado):**
- Schema interno: `users/{uid}.founder.{isFounder, number}`,
  `system/counters.founderCount`, `FOUNDER_CAP`,
  `FOUNDER_COUNTER_FIELD`, etc. — todo intacto.
- Admin panel y `FoundersList.tsx` — sigue diciendo "Cohorte
  Fundadores" (decisión de Carlos: uso interno).
- Endpoint admin `/api/admin/founders` y `lib/founders.ts` —
  intactos.
- Comentarios técnicos de código (SPEC-057, SPEC-058) — los dejo
  con "fundador" porque es naming interno; agregar SPEC-096 al
  costado documenta el cambio.
- Función `sendFounderWelcomeEmail` y parámetro `founderNumber`
  — naming interno.

**Smoke plan post-deploy:**
1. Anónimo en home, esperar 3s → modal aparece con badge
   "🚀 ACCESO ANTICIPADO" y título "Reserva tu acceso".
2. Verificar las 2 cards (Precio preferencial + Sin obligación).
3. CTA dice "Reservar mi lugar gratis →".
4. Footer dice "Gratis · Sin tarjeta · 2 minutos".
5. Usuario con isFounder=true en /dashboard ve "🚀 Acceso
   anticipado / Tu lugar en ElenaApp está reservado" en accent
   teal (no amber).
6. Próximo email transaccional al asignar nuevo cupo: subject "Tu
   acceso anticipado a ElenaApp está reservado", cuerpo sin la
   palabra "fundador".
7. /terminos sección 5 dice "Acceso anticipado y beneficios
   futuros".
8. Admin → /admin/dashboard → tab Fundadores: sigue intacto.

TS transpile validation OK en los 3 archivos TS modificados.
