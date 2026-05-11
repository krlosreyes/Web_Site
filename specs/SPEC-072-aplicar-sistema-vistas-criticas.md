# SPEC-072 — Aplicar design system a 4 vistas críticas

**Estado:** 🔨 En progreso (BioDashboard ✅ · Hero ⏳ · IMRQuiz ⏳ · posts/[slug] ⏳)
**Fase:** Pre-lanzamiento — rediseño premium
**Severidad:** ALTO
**Fecha de creación:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-071 (design system foundation)

---

## Contexto

SPEC-071 estableció los tokens del design system (paleta teal único,
escala tipográfica, border-radius coherente, reglas de uso de decoración).
Esta SPEC los aplica componente por componente a las 4 vistas de mayor
exposición/conversión.

Por seguridad operativa, cada vista se commitea por separado para
permitir validación visual entre cada una, sin riesgo de tener que revertir
todo el rediseño si un componente sale mal.

## Aplicación 1 — BioDashboard.tsx ✅

### Antes (problemas)

- Banner fundador: gigante (`rounded-[2rem] p-8`), número en `text-6xl
  italic tracking-tighter`, beneficios en lista vertical de 2 items con
  círculos numerados grandes, blur backdrop pesado.
- Saludo "Hola, Charlie": `text-6xl font-black italic uppercase tracking-tight`
  con gradient bg-clip en el nombre. Es un h1 de dashboard, no de Hero
  principal — la decoración exagerada rompía la regla del system.
- Subtítulo: "Tu reporte IMR" en `text-[10px] tracking-[0.4em]`, gritando
  como código NASA.
- Badge de estado: `text-[8px]` con `tracking-[0.3em]`, dot de teal aunque
  el estado fuera "deteriorado" (debería reflejar el color del estado).
- Card IMR principal: `rounded-[3rem]`, `backdrop-blur-xl`, `shadow-2xl`,
  círculo de 240px, número en italic tracking-tighter.
- Stats internos (Estructura/Metabolismo/Conducta + grasa/magra/edad):
  cards `rounded-2xl` con números en `font-black italic`, labels en
  `text-[8px] tracking-widest`. 6 cards apretadas con tipografía extrema.
- Cards laterales (Elena App, Tribu, Dominio Teórico): `rounded-[2.5rem]
  p-8 shadow-2xl`, títulos en `text-lg font-black italic uppercase
  tracking-tighter`. Border-radius inconsistente con la card IMR
  (`[3rem]` vs `[2.5rem]`).
- Mezcla cromática: azul brillante (`blue-400`/`blue-600`) + teal
  (`#00C49A`) + amarillo (`amber-300`) compitiendo por atención.

### Después (sistema aplicado)

- **Banner fundador**: card compacta `rounded-xl p-5 md:p-6` con dos
  zonas separadas por divider sutil. Número `#1` en text-2xl bold (no
  italic). Beneficios en una sola línea de prosa en vez de lista vertical.
  Color amber-500/10 sutil en lugar de gradient pesado.
- **Banner needsOnboarding**: `rounded-xl`, icono accent en cuadrito,
  copy clean sin italic, CTA `btn-primary` style con `bg-accent text-bg-base`.
- **Saludo**: `text-3xl md:text-4xl font-semibold text-text-primary
  tracking-tight`. Nombre en `text-accent` sólido (sin gradient, sin
  italic, sin uppercase). Sigue siendo h1 pero proporcionado al contexto.
- **Subtítulo eyebrow**: `text-[11px] font-bold uppercase tracking-[0.2em]
  text-text-muted`. Mantiene la voz de marca con tracking-wide pero a
  un tamaño legible.
- **Badge estado**: `rounded-lg`, dot del color del IMR (rojo/amber/verde
  según puntaje), label "Estado" en `text-[10px]` y valor en `text-xs
  font-semibold` (no font-black con tracking-widest).
- **Card IMR principal**: `rounded-2xl p-6 md:p-8` (no `[3rem] p-10`),
  sin backdrop-blur ni shadow-2xl. Círculo 200px (de 240px), número en
  `text-5xl font-bold tracking-tight` (no italic). Línea superior de
  color del IMR como acento.
- **Stats internos**: cards `rounded-lg p-3` con fondo `bg-bg-base/60`,
  icono accent, label `text-[9px] font-bold uppercase tracking-wider`,
  número `text-base font-bold`. Compactas y legibles.
- **Cards laterales**: todas `rounded-xl p-5 md:p-6`. Títulos en `text-base
  font-semibold` (no `text-lg font-black italic uppercase`). Eyebrows en
  `text-[11px] tracking-[0.18em]` consistentes. CTAs en `bg-accent
  text-bg-base` (no azul). Sin shadow-2xl.
- **Card Dominio Teórico**: pill con conteo de módulos en accent-soft;
  filas de quizzes en `rounded-lg` con border sutil; checks/reintento
  con `bg-status-good/warn` (semántica clara). Línea "Reintentar →" en
  status-warn legible.
- **Mezcla cromática reducida**: dark + accent teal único + statuses
  (good/warn/bad para semántica del IMR). El azul brillante eliminado
  del cuerpo.

### Cambios concretos
- 5 secciones del componente reescritas (banner fundador, banner
  onboarding, header, card IMR, columna derecha de 3 cards).
- 0 cambios de lógica/datos — solo JSX + clases.
- Border-radius totalmente coherente: `rounded-lg` / `rounded-xl` /
  `rounded-2xl` solamente. Ningún `rounded-[Xrem]` arbitrario.
- Tipografía: ningún `italic uppercase tracking-[0.3em+]` en cuerpo de
  cards. Solo h1 principal en sans bold, eyebrows en uppercase
  tracking-wide chico, body en sans normal/medium.

## Aplicación 2 — Hero.astro ⏳ (pendiente)

Próximo commit. Hero ES el lugar donde se permite italic + uppercase +
gradient (regla confirmada por Carlos), pero proporcionado: UN h1 + un
sub-headline + CTAs limpios.

## Aplicación 3 — IMRQuiz.tsx ⏳ (pendiente)

## Aplicación 4 — posts/[slug].astro ⏳ (pendiente)

Limpiar uppercase + tracking-widest de los meta/labels (fecha, tiempo de
lectura, badges), reducir `rounded-[3rem]` de cualquier card auxiliar,
mantener los estilos prose internos (callouts SPEC-065).

## Criterios de aceptación (parciales actuales)

- [x] BioDashboard sin `italic uppercase tracking-[Xem]` en labels internos.
- [x] BioDashboard con border-radius coherente (sin `[Xrem]` arbitrario).
- [x] Banner fundador compactado (no acapara el primer pliegue).
- [x] Saludo proporcionado (text-3xl/4xl, no text-6xl).
- [x] Paleta sin azul brillante en cuerpo (solo accent teal + statuses).
- [ ] Hero, IMRQuiz, posts/[slug] aplicados.

## Riesgos y trade-offs

- **Tokens `bg-accent`, `text-text-primary` deben generar utilities en
  Tailwind v4**: si la build vuelve a fallar como en SPEC-071, debugear
  el procesamiento de @theme antes de aplicar el sistema a más
  componentes.
- **Cambio visual grande de un solo golpe**: Carlos puede sentirse
  "extraño" al ver el dashboard más sobrio. Es esperado — los tonos
  apagados y sans normal son característica de productos premium
  (Linear, Stripe Dashboard, Notion). La marca de Metamorfosis vive
  en el Hero, no en el dashboard.
- **Quitar gradient/italic del saludo** puede sentirse "menos personal".
  Pero el saludo es funcional, no decorativo — `Hola, Carlos` con
  el nombre en color teal sólido transmite calidez sin gritar.

## Resultado parcial

Implementado a la fecha:

**Archivo modificado:**
- `metamorfosis-web/src/components/BioDashboard.tsx` — 5 secciones
  reescritas aplicando design system.

**Decisiones:**
- El Dashboard NO es el Hero principal del sitio; por tanto NO usa
  italic + uppercase + gradient en su h1. La decoración expresiva queda
  reservada al Hero (próximo commit).
- Banner fundador compactado dramáticamente — sigue siendo prominente
  (border accent + amber, primera card del pliegue) pero ya no ocupa
  280px de alto.
- Color del dot de estado refleja el color del IMR — semánticamente
  correcto: dot teal con badge "deteriorado" rojo era contradicción.

**Siguiente:** rediseño de Hero.astro en próximo commit.
