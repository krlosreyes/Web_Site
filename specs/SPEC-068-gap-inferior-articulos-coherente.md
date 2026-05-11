# SPEC-068 — Gap inferior coherente entre artículo y footer cards

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — visual / UX
**Severidad:** MEDIO (no rompe nada, pero rompe percepción de orden visual)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-013 (layouts unificados), SPEC-065 (renderer rico)

---

## Contexto

Carlos publicó el primer artículo con el renderer rico (SPEC-065) y notó
que entre el final del contenido (el `<ol>` "Tu plan de acción para esta
semana") y la primera card del footer ("¿Te resultó útil este artículo?")
queda un espacio vacío excesivo. Pidió fix **coherente para todos los
artículos**, no caso por caso.

Diagnóstico: el container del contenido tenía `pb-0` (correcto) y el
container del footer tenía `pb-24` (correcto) pero **sin `pt-*`**. El
espacio entre ambos venía exclusivamente del `margin-bottom` natural del
último elemento del `.prose`.

Como el `.prose ol` tiene `@apply ... my-20 ...` (80px), cuando el artículo
termina en un `<ol>` (típico del cierre "Tu plan de acción" — lista
numerada que es el roadmap visual de SPEC-065), el espacio resulta de 80px.

El problema: ese espacio cambia según con qué elemento termine cada
artículo:

- Termina en `<ol>` (plan de acción) → 80 px de gap.
- Termina en `<p>` → ~40 px (mb-10 de `.prose p`).
- Termina en `<blockquote>` (callout) → variable (12-20 px según tipo).
- Termina en `<table>` → 64 px (`.prose table my-16`).

Resultado: artículos diferentes muestran gaps visualmente inconsistentes
ante el mismo bloque de reacciones. Mal "feel" de plataforma.

## Solución

Patrón estándar de CSS: **el margin del último child no debería aportar
al espaciado del contenedor padre; el espaciado lo controla el padding-top
del siguiente contenedor**.

### Cambio 1 — Anular margin-bottom del último child del prose

```css
.prose > div > *:last-child,
.prose > *:last-child {
    margin-bottom: 0 !important;
}
.prose > div:last-child > *:last-child {
    margin-bottom: 0 !important;
}
```

Cubrimos los tres casos:
- Último child directo del `.prose`.
- El último child del `<div set:html>` (el wrapper que Astro genera).
- El último child anidado un nivel más adentro cuando el último child es
  un wrapper (ej. el `<p>` dentro de un `<blockquote>` final).

### Cambio 2 — Padding-top controlado en el Footer Container

```diff
- <div class="container mx-auto px-6 pb-24 max-w-3xl">
+ <div class="container mx-auto px-6 pt-12 md:pt-16 pb-24 max-w-3xl">
```

`pt-12` = 48 px mobile, `md:pt-16` = 64 px desktop. Espaciado consciente
y constante, independiente del contenido del artículo.

### Por qué no reducir `.prose ol my-20`

Tentación inicial: bajar `my-20` (80px) a `my-12` (48px). Lo descarté
porque ese margin TAMBIÉN aplica a `<ol>` en medio del artículo (cuando
hay una lista numerada en una sección interna), y ahí 80px es la
intención visual del roadmap (es protagonista, no transición). Tocar el
margin global afecta tanto el caso "medio" como el caso "final". La
regla del `:last-child` resuelve **solo** el caso final que es donde
duele, sin afectar el resto.

## Criterios de aceptación

- [x] Regla `.prose > *:last-child { margin-bottom: 0 !important; }` en
      `<style is:global>` de `[slug].astro`.
- [x] Variantes para `>div>` y `>div:last-child>` para cubrir wrapping
      de marked/set:html.
- [x] Container Footer Sections con `pt-12 md:pt-16`.
- [ ] Post-deploy: el artículo del Código de la Obesidad muestra el mismo
      gap entre "Tu plan de acción" y "¿Te resultó útil este artículo?".
- [ ] Post-deploy: regenerar un segundo artículo (otro framework) y
      confirmar que el gap se ve idéntico aunque termine en otro elemento.

## Riesgos y trade-offs

- **`!important` en `margin-bottom: 0`:** necesario para anular las
  `@apply mb-10` / `my-20` que vienen de Tailwind con la misma o mayor
  especificidad. Es uso justificado, no abuso.
- **El último-child siempre tendrá margin 0:** si en el futuro un artículo
  termina con un elemento que SÍ necesita aire extra antes del footer,
  hay que ajustarlo agregando un `<hr>` o `<p>&nbsp;</p>` al final. Pero
  es escenario hipotético — el flow editorial actual siempre cierra con
  el plan de acción numerado.
- **`pt-12 md:pt-16` puede sentirse corto en pantallas muy grandes:** se
  puede agregar `lg:pt-20` si en review post-deploy se ve apretado en
  monitores grandes. Por ahora es razonable.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos modificados:**
- `metamorfosis-web/src/pages/posts/[slug].astro` — regla CSS para
  `:last-child` + cambio `pb-24` → `pt-12 md:pt-16 pb-24` en Footer
  Container.

**Decisiones:**
- Anular margin del `:last-child` en lugar de tocar las clases globales:
  preserva el spacing intermedio de `<ol>`, `<blockquote>`, `<table>`.
- Padding-top en el siguiente container en lugar de margin-top: control
  centralizado, predecible, fácil de ajustar.
- `pt-12 md:pt-16` (48/64px) en vez de número mayor: el bloque de
  reacciones ya tiene su propio aire interno (padding interno), no
  necesita más respiración exterior.

Sin desviaciones del plan.
