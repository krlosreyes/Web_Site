# SPEC-085 — Link a /imr desde el resultado del quiz y el dashboard

**Estado:** ✅ Cerrada (pendiente de `npm run build` + commit local)
**Fase:** Pre-lanzamiento — UX del primer encuentro
**Severidad:** ALTO (impacta directamente la retención del primer minuto)
**Fecha de creación:** 2026-05-12
**Autor:** Carlos Reyes
**Depende de:** SPEC-081 (página /imr), SPEC-084 (Umami custom events)

---

## Contexto

Hoy el flujo del usuario nuevo es:

1. Hace el quiz IMR (8 substeps).
2. Ve la pantalla "Análisis completado" + form de registro.
3. Se registra → redirect a `/dashboard`.
4. Ve un círculo con un número (ej. `47`) y tres porcentajes (E/M/C) con
   un párrafo de una línea ("Tu metabolismo necesita ajustes
   estructurales profundos").

Carlos observó que el usuario **no entiende qué significa ese número**.
¿Es bueno? ¿Es malo? ¿De dónde sale? ¿Qué significa E/M/C? El número
solo lo orienta si ya conoce el IMR — y la primera vez que lo ve, no
lo conoce.

La página `/imr` (creada en SPEC-081) tiene toda la pedagogía: qué es,
qué mide, por qué confiar en él, qué no es. Pero hoy no se linkea
desde el resultado, solo desde el hero del home y desde el navbar.
El usuario que llega del quiz al dashboard nunca pasa por el home, así
que nunca ve esa puerta.

## Problema

Falta un puente claro entre "tengo un resultado" y "entiendo qué
significa". El resultado sin contexto pedagógico es una pieza de
información sin valor para el usuario nuevo, y eso predice abandono
en el primer minuto del onboarding.

## Solución propuesta

Agregar un CTA secundario explicativo "🤔 ¿Qué significa este puntaje?"
con link a `/imr` en dos lugares:

1. **`BioDashboard.tsx`** — debajo del párrafo descriptivo del puntaje
   principal y antes del grid de pilares E/M/C. Variante destacada
   (bg-accent/10, border-accent/30) para que el usuario nuevo lo vea
   antes de scrollear.
2. **`IMRQuiz.tsx`** (pantalla `step 2` — "Análisis completado") —
   antes del form de registro, como link sutil ("¿Qué es el IMR?")
   debajo del eyebrow. Esto prepara al usuario para entender el
   resultado ANTES de comprometerse con el registro.

Ambos clicks se trackean con el evento ya existente
`cta_imr_explicacion` (SPEC-084) más una property `source` para
diferenciar de dónde vino el click (`hero` ya existe; ahora se
agregan `dashboard` y `quiz_resultado`).

### Alternativas descartadas

- **Modal explicativo in-place:** lo descartamos porque la pedagogía de
  `/imr` es larga (14 referencias científicas, 7 secciones). Un modal
  que la condense pierde el valor que justamente queremos mostrar:
  "esto está respaldado". Mejor link out, página dedicada.
- **Tooltip on-hover del número:** no funciona en mobile (donde está
  el 70%+ del tráfico) y un tooltip no transmite el peso editorial
  necesario. El usuario tiene que sentir que hay sustancia detrás.
- **Re-escribir el copy descriptivo en el dashboard para que sea más
  rico:** lo intentamos mentalmente. No hay forma de explicar IMR en
  3 líneas sin sacrificar la pedagogía. El link a página dedicada
  preserva ambos: dashboard limpio + explicación profunda a un click.

## Plan de implementación

1. **Modificar** `metamorfosis-web/src/components/BioDashboard.tsx`:
   - Después del párrafo "Tu metabolismo …" (~línea 250) y antes del
     grid de pilares, insertar un `<a>` link al `/imr` con estilo
     destacado (bg-accent/10, accent border, icono 🤔).
   - Atributos `data-umami-event="cta_imr_explicacion"` +
     `data-umami-event-source="dashboard"`.
2. **Modificar** `metamorfosis-web/src/components/IMRQuiz.tsx`:
   - En el render `step === 2` (pantalla "Análisis completado"),
     debajo del eyebrow "Vincula tu identidad…" y antes del form,
     agregar un link sutil "¿Qué es el IMR? Conoce qué medimos →"
     con `track('cta_imr_explicacion', { source: 'quiz_resultado' })`
     en `onClick`.
3. **Actualizar nota** en `specs/SPEC-084-umami-custom-events.md`
   para reflejar las nuevas properties `source` del evento
   `cta_imr_explicacion`.

## Criterios de aceptación

- [ ] `npm run build` no lanza errores.
- [ ] El link en BioDashboard aparece visible sin scrollear en
      viewports mobile estándar (375px de ancho).
- [ ] El link en IMRQuiz step 2 no compite visualmente con el form de
      registro (es secundario, no primario).
- [ ] Click en cualquiera de los dos lleva a `/imr` y dispara el
      evento `cta_imr_explicacion` con el `source` correcto.
- [ ] El copy es en tuteo neutro (sin voseo) — regla del proyecto.

## Pruebas

```sh
cd metamorfosis-web && npm run build

# Smoke post-deploy:
#   1. Anónimo → completa quiz → ver link "¿Qué es el IMR?" en step 2
#   2. Registrarse → llegar a /dashboard → ver botón "¿Qué significa
#      este puntaje?" justo debajo del círculo
#   3. Click ambos → verificar en Umami dos eventos cta_imr_explicacion
#      con source=quiz_resultado y source=dashboard respectivamente
```

## Riesgos / consideraciones

- **Cluttering del dashboard:** el dashboard ya tiene varias cards
  (ElenaApp waitlist, comunidad, etc). Mitigación: el link va DENTRO
  de la card del IMR principal, no como card separada. Visualmente
  pertenece al puntaje, no compite con las demás cards.
- **Linkeo al inicio de la sesión:** si el usuario clickea, sale del
  dashboard. Pero `/imr` tiene su propio CTA al final ("Iniciar
  diagnóstico IMR") y ya está logueado, así que ese CTA lo llevaría
  de vuelta. Aceptable como flujo.

## Commit

**Mensaje sugerido:**
```
feat(spec-085): link explicativo a /imr desde resultado del quiz + dashboard

- BioDashboard: CTA "¿Qué significa este puntaje?" debajo del círculo IMR
- IMRQuiz step 2: link sutil "¿Qué es el IMR?" pre-registro
- Trackeo via Umami: cta_imr_explicacion con source=dashboard|quiz_resultado

Cierra specs/SPEC-085-link-imr-desde-resultado.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-12).

**Archivos tocados (2):**
- `src/components/BioDashboard.tsx` — link "🤔 ¿Qué significa este
  puntaje?" entre el copy descriptivo y el grid de pilares E/M/C.
  Estilo destacado con `bg-accent/[0.08] + border-accent/30` para que
  resalte sin pelearse con el círculo del puntaje. Tracking declarativo
  `data-umami-event="cta_imr_explicacion"` +
  `data-umami-event-source="dashboard"`.
- `src/components/IMRQuiz.tsx` — link "¿Qué es el IMR? Conoce qué
  medimos →" en la pantalla `step 2` (Análisis completado), debajo
  del eyebrow y antes del form de registro. Estilo sutil (text-accent
  inline) para no robar peso al CTA primario del registro. Abre en
  pestaña nueva (`target="_blank"`) para no perder el progreso del
  form. Tracking programático con `track('cta_imr_explicacion',
  { source: 'quiz_resultado' })`.

**Decisiones de diseño:**
- En el dashboard el link es visual (botón pill teal) porque ese
  usuario YA pasó el embudo del registro y queremos máxima visibilidad
  de la pedagogía.
- En el quiz step 2 el link es textual sutil porque ese usuario está a
  punto de comprometerse al registro y no queremos competir con el CTA
  primario. Abrir en pestaña nueva preserva el form.
- Reutilizamos el evento `cta_imr_explicacion` (SPEC-084) en lugar de
  crear uno nuevo. La diferenciación por `source` permite analizar
  qué punto de entrada convierte más a la pedagogía.

**Smoke plan post-deploy:**
1. Completar quiz como anónimo → verificar link "¿Qué es el IMR?" en
   step 2.
2. Registrarse → llegar a /dashboard → ver botón "🤔 ¿Qué significa
   este puntaje?" debajo del círculo.
3. Click ambos → en Umami verificar `cta_imr_explicacion` con
   `source=quiz_resultado` y `source=dashboard`.
