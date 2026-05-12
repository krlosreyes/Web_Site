# SPEC-084 — Umami custom events: funnel del lanzamiento

**Estado:** ✅ Cerrada (pendiente de `npm run build` local + smoke en prod)
**Fase:** Pre-lanzamiento — visibilidad del funnel para SPEC-083
**Severidad:** MEDIO (sin esto, los primeros 100 usuarios no se pueden optimizar)
**Fecha de creación:** 2026-05-12
**Autor:** Carlos Reyes
**Depende de:** SPEC-028 (Umami activo en prod), SPEC-083 (estrategia de
adquisición primeros 100 usuarios)

---

## Contexto

Umami ya está corriendo en producción (SPEC-028 / SPEC-028b) y captura
pageviews, visitas, visitantes únicos, rebote y tiempo promedio. Pero las
métricas actuales solo dicen "cuánta gente entró", no "cuánta gente
**convirtió**".

Para ejecutar `docs/ACQUISITION-FIRST-100.md` necesitamos saber:

- De cada 100 visitantes, ¿cuántos arrancan el quiz?
- De cada 100 que arrancan el quiz, ¿cuántos lo completan?
- De cada 100 que completan el quiz, ¿cuántos se registran?
- De cada artículo, ¿cuántos clickean en La Tribu vs. el CTA del quiz?
- ¿Qué fuente de tráfico (hero / artículo / biblioteca / página IMR) lleva
  más gente al quiz?
- ¿La gente abre el modal de ElenaApp y termina reservando, o se queda?

Sin estos números, vamos a optimizar a ciegas en las primeras 12 semanas.

## Problema

Hoy no medimos eventos custom — solo pageviews. Las métricas de la screenshot
de Umami (24 visitantes, 25 visitas, 59 vistas, 68% rebote, 3m 5s tiempo)
no diferencian entre alguien que entró al home y se fue, vs. alguien que
hizo el quiz, lo completó y se registró. Ambos cuentan igual en pageviews.

## Solución propuesta

Instrumentar Umami con eventos custom mediante dos mecanismos paralelos:

1. **Declarativo (`data-umami-event="..."`):** para CTAs estáticos en
   archivos `.astro`. Umami auto-attachea el handler cuando carga el
   script; cero JS adicional, cero impacto en bundle.
2. **Programático (`window.umami?.track(name, props)`):** para
   transiciones de estado dentro de componentes React (start del quiz,
   completion del quiz, registro exitoso). Wrappeado en un helper
   `src/lib/analytics/track.ts` que es no-op si `window.umami` no está
   cargado (dev local, ad-blocker, fallo de red).

**Convención de nombres:** `snake_case`, prefijo por dominio
(`quiz_*`, `registro_*`, `cta_*`). Properties en `snake_case` también.

### Catálogo de eventos

| Evento | Disparador | Props |
|---|---|---|
| `quiz_iniciado` | Click en "Iniciar mi diagnóstico" en step 0 del IMRQuiz | — |
| `quiz_completado` | Llega al final del quiz (anónimo o logueado) | `score`, `label` |
| `registro_completado` | Cuenta nueva creada con éxito | `source` (`quiz` o `login_directo`) |
| `cta_quiz_iniciar` | Click en cualquier link/botón que apunta a `/quiz` | `source` (`hero`, `articulo`, `biblioteca`, `imr_page`) |
| `cta_imr_explicacion` | Click en el link "IMR" del hero hacia `/imr` | — |
| `cta_elenaapp_abrir` | Apertura del modal de ElenaApp desde el navbar | — |
| `cta_elenaapp_reservar` | Click en "Reserva tu lugar" del modal | — |
| `cta_tribu_discutir` | Click en "Discutir este artículo" en `posts/[slug]` | — |
| `cta_tribu_entrar` | Click en "Entrar a la comunidad" en `posts/[slug]` | — |

### Alternativas descartadas

- **GA4 / Mixpanel:** más potente pero requiere consentimiento explícito
  (GDPR/LFPDPPP), trae cookies y nos obliga a un banner más invasivo que
  el actual de `SPEC-080`. Umami no setea cookies — ya está auto-resuelto.
- **Eventos solo declarativos:** no cubren transiciones de estado en
  React (no hay click directo en el momento de `quiz_completado` —
  se dispara cuando termina el último substep). Necesitamos
  programático sí o sí para esos.

## Plan de implementación

1. **Crear** `metamorfosis-web/src/lib/analytics/track.ts` — helper
   tipado para `window.umami.track(name, props)`. No-op si no está
   cargado. SSR-safe (`typeof window === 'undefined'`).
2. **Modificar** `metamorfosis-web/src/components/IMRQuiz.tsx`:
   - `setStep(1)` en step 0 → `track('quiz_iniciado')`.
   - `handleFinish` → `track('quiz_completado', { score, label })`.
   - `handleFinalRegister` éxito → `track('registro_completado', { source: 'quiz' })`.
3. **Modificar** `metamorfosis-web/src/pages/login.astro`:
   - Tras `createUserWithEmailAndPassword` exitoso →
     `window.umami?.track('registro_completado', { source: 'login_directo' })`.
4. **Modificar** `metamorfosis-web/src/components/ElenaAppCTA.tsx`:
   - `setOpen(true)` desde el botón del navbar (no auto-open) →
     `track('cta_elenaapp_abrir')`.
   - Click en "Reserva tu lugar" → `track('cta_elenaapp_reservar')`.
5. **Modificar** `metamorfosis-web/src/components/Hero.astro`:
   - CTA "Obtener mi diagnóstico IMR" → `data-umami-event="cta_quiz_iniciar"`
     + `data-umami-event-source="hero"`.
   - Link "IMR" → `data-umami-event="cta_imr_explicacion"`.
6. **Modificar** `metamorfosis-web/src/pages/posts/[slug].astro`:
   - "Discutir este artículo" → `data-umami-event="cta_tribu_discutir"`.
   - "Entrar a la comunidad" → `data-umami-event="cta_tribu_entrar"`.
   - "Iniciar diagnóstico IMR" del CTA final →
     `data-umami-event="cta_quiz_iniciar"` + `data-umami-event-source="articulo"`.
7. **Modificar** `metamorfosis-web/src/pages/biblioteca.astro`:
   - "Iniciar diagnóstico IMR" del CTA final →
     `data-umami-event="cta_quiz_iniciar"` + `data-umami-event-source="biblioteca"`.
8. **Modificar** `metamorfosis-web/src/pages/imr.astro`:
   - Dos CTAs `/quiz` → `data-umami-event="cta_quiz_iniciar"`
     + `data-umami-event-source="imr_page"`.

## Criterios de aceptación

- [ ] `npm run build` no lanza errores.
- [ ] El helper `track()` no rompe si `window.umami` es `undefined`
      (verificado con `astro dev`).
- [ ] En el dashboard de Umami (sección Events) se ven los 9 eventos
      después de smoke-test manual.
- [ ] Los eventos `cta_quiz_iniciar` muestran property `source` con los
      4 valores esperados (hero / articulo / biblioteca / imr_page).
- [ ] Los eventos `quiz_completado` muestran props `score` y `label`.
- [ ] No hay regresiones visibles: clickear cualquier CTA sigue
      navegando como antes (los `data-umami-event-*` son inocuos para el
      browser si Umami no se cargó).

## Pruebas

```sh
# Local
cd metamorfosis-web && npm run build

# Smoke (post-deploy, ~2 min después del push):
#  1. Anónimo: home → click "Obtener mi diagnóstico IMR" (espera cta_quiz_iniciar)
#  2. Completar 8 substeps del quiz (espera quiz_completado al finalizar)
#  3. Registrar cuenta nueva (espera registro_completado source=quiz)
#  4. Logout, ir a /login, registrar otra cuenta (espera registro_completado source=login_directo)
#  5. Abrir un post, click "Discutir este artículo" (espera cta_tribu_discutir)
#  6. Abrir modal ElenaApp desde navbar (espera cta_elenaapp_abrir)
#  7. Click "Reserva tu lugar" (espera cta_elenaapp_reservar)
#
# En Umami: Events → ver los 9 eventos con sus contadores.
```

## Riesgos / consideraciones

- **`window.umami` undefined en localhost:** Umami solo se inyecta en
  prod (`UmamiScript.astro` chequea `isProd`). El helper debe ser
  silenciosamente no-op en dev o vamos a llenar la consola de
  TypeErrors. Mitigación: optional chaining `window.umami?.track(...)`.
- **Ad-blockers:** ~30% de usuarios bloquean Umami. Los eventos no
  llegarán, pero el flujo del usuario sigue funcionando. Aceptado —
  Umami es "directional", no "ground truth".
- **PII en props:** NUNCA pasar `email`, `name`, `uid` como property
  del evento (violaría la promesa de privacy de Umami). Solo enums y
  números agregados (score numérico, label categórico).
- **Sobre-tracking:** Si dentro de 2 semanas vemos que un evento nunca
  se dispara o aporta cero señal, lo borramos. Empezar mínimo y
  expandir; no instrumentar 30 eventos al mismo tiempo.

## Commit

**Mensaje sugerido:**
```
feat(spec-084): Umami custom events para funnel pre-lanzamiento

- Helper src/lib/analytics/track.ts (SSR-safe, no-op si Umami offline)
- 9 eventos: quiz_iniciado, quiz_completado, registro_completado,
  cta_quiz_iniciar (con source), cta_imr_explicacion,
  cta_elenaapp_abrir, cta_elenaapp_reservar, cta_tribu_discutir,
  cta_tribu_entrar
- Declarativo (data-umami-event) en CTAs estáticos de Astro
- Programático (track()) en transiciones de estado de IMRQuiz +
  ElenaAppCTA + login.astro

Cierra specs/SPEC-084-umami-custom-events.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-12).

**Archivos tocados (8):**
- `src/lib/analytics/track.ts` (nuevo) — helper SSR-safe.
- `src/components/IMRQuiz.tsx` — eventos `quiz_iniciado`, `quiz_completado`
  (props `score` + `label`), `registro_completado` (`source=quiz`).
- `src/components/ElenaAppCTA.tsx` — eventos `cta_elenaapp_abrir` (solo
  apertura desde navbar, NO auto-open) y `cta_elenaapp_reservar`.
- `src/components/Hero.astro` — `cta_quiz_iniciar` (`source=hero`) +
  `cta_imr_explicacion`.
- `src/pages/posts/[slug].astro` — `cta_tribu_discutir`,
  `cta_tribu_entrar`, `cta_quiz_iniciar` (`source=articulo`).
- `src/pages/biblioteca.astro` — `cta_quiz_iniciar`
  (`source=biblioteca`).
- `src/pages/imr.astro` — `cta_quiz_iniciar` (`source=imr_page`) en los
  dos CTAs.
- `src/pages/login.astro` — `registro_completado` (`source=login_directo`)
  con inline guard porque login.astro usa script vanilla, no React.

**Decisiones:**
- Helper en lugar de inline `window.umami?.track()` en cada componente
  React para consistencia y para que el optional chaining + try/catch
  vivan en un solo lugar.
- `cta_elenaapp_abrir` NO se dispara en el auto-open del modal (SPEC-055)
  porque eso no refleja intent del user — solo medimos cuando el user
  clickea el botón del navbar.
- Login usa inline guard (no helper) porque es un `<script>` vanilla
  dentro del `.astro`, no un componente React; importar el helper
  obligaba a re-bundlear el script.
- TS transpile validation OK en los 3 archivos TS/TSX.
- `npm run build` no se pudo ejecutar en el sandbox por mismatch de
  arquitectura (sandbox Linux ARM64, Rollup compilado para macOS).
  Carlos debe correr `npm run build` localmente antes del commit.

**Smoke plan post-deploy:**
1. Abrir Umami → ver que aparecen los 9 eventos en la sección Events.
2. Verificar properties de `cta_quiz_iniciar` (4 valores de `source`).
3. Verificar props de `quiz_completado` (`score`, `label`).
