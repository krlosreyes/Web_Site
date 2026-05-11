# SPEC-059 — Pillars cards centradas + linkeables a biblioteca filtrada

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — navegación
**Severidad:** MEDIO (UX + descubrimiento de contenido)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-046 (pilares taxonomía unificada)

---

## Contexto

Las cards de "Los 5 Pilares" en la home eran decorativas: mostraban
emoji + título + descripción de cada pilar pero NO tenían acción. El
user que se interesaba en, por ejemplo, "Ayuno Intermitente" no tenía
forma directa de saltar a los artículos sobre ese tema — tenía que ir
manualmente a `/biblioteca` y aplicar el filtro de pilar.

Adicionalmente, los iconos quedaban alineados a la izquierda dentro de
cada card (visual asimétrico, sobre todo en pantallas anchas con grid
de 5 columnas donde cada card es estrecha).

## Solución

### 1. Iconos centrados con `mx-auto`

El div del icono pasa de:

```html
<div class="w-16 h-16 ... flex items-center justify-center text-accent-blue mb-6 ...">
```

a:

```html
<div class="w-16 h-16 ... flex items-center justify-center text-accent-blue mb-6 mx-auto ...">
```

`mx-auto` con `width` fijo de `w-16` centra el bloque horizontalmente
en cualquier resolución (mobile single column, tablet 3 cols, desktop
5 cols). El título y la descripción se mantienen en alineación natural
(text-align del card padre).

### 2. Cards como `<a>` linkeables

Cada card pasa de `<div>` a `<a href="/biblioteca?pilar={id}">`. Mapeo
display → ID canónico (de `lib/constants/pillars.ts`):

| Card title | Pillar ID | URL destino |
|---|---|---|
| Ayuno Intermitente | `ayuno` | `/biblioteca?pilar=ayuno` |
| Alimentación | `nutricion` | `/biblioteca?pilar=nutricion` |
| Hidratación | `hidratacion` | `/biblioteca?pilar=hidratacion` |
| Sueño | `sueno` | `/biblioteca?pilar=sueno` |
| Ejercicio | `ejercicio` | `/biblioteca?pilar=ejercicio` |

Atributo `aria-label` por card para lectores de pantalla
(`Ver artículos sobre Ayuno Intermitente`). `focus:ring` para
accesibilidad de teclado.

### 3. Refactor del componente para usar config-driven

Antes de SPEC-059, `Pillars.astro` tenía 5 bloques HTML duplicados (un
`<div>` por pilar con repetición visual). Ahora todo el array `CARDS`
está al inicio del frontmatter y el render itera con `.map()`. Mantenible
y propenso a menos copy-paste errors si se agrega un 6to pilar futuro
(que no debería pasar — son 5 fijos por SPEC-046).

### 4. `biblioteca.astro` lee el query param

```ts
const requestedPillar = Astro.url.searchParams.get('pilar');
const initialPillar = isValidPillarId(requestedPillar) ? requestedPillar! : 'todos';
```

- Si `?pilar=ayuno` válido → `initialPillar = 'ayuno'`.
- Si `?pilar=invalid` → fallback a `'todos'` (defense in depth).
- Sin query param → `'todos'` (comportamiento anterior).

El `initialPillar` se usa en 3 lugares server-side:
- `data-active` del contenedor del filtro.
- Clases CSS de los chip-buttons (el activo recibe `bg-white text-black`,
  los demás `bg-white/5`).
- Cada `<article>` recibe `class="hidden"` si no matchea el pillar
  inicial → **sin flicker** entre SSR y la hidratación del script.

### 5. Bonus: sync de query param con history API

Cuando el user clickea otro chip de filtro, el script ahora también
actualiza `window.history.replaceState({}, '', url)`. Beneficios:

- El user puede copiar la URL y compartir el link con el filtro aplicado
  (ej. mandar `/biblioteca?pilar=ayuno` a un amigo).
- El botón "atrás" del browser preserva el filtro.
- Si el user marca el link como favorito, vuelve al mismo estado.

`replaceState` (no `pushState`) para no inflar el history con cada toggle.

## Plan de ejecución

1. Reescribir `Pillars.astro`:
   - Definir array `CARDS: PillarCard[]` con id, title, description, Icon.
   - Renderizar con `.map()` en `<a href="/biblioteca?pilar={id}">`.
   - Agregar `mx-auto` al icon container.
   - aria-label + focus:ring.
2. Editar `biblioteca.astro`:
   - Import `isValidPillarId`.
   - Calcular `initialPillar` desde `Astro.url.searchParams.get('pilar')`.
   - Usar `initialPillar` en `data-active` + clases de chips + class `hidden` en cards.
   - Script: reemplazar `style.display` por `classList.add/remove('hidden')`.
   - Script: agregar sync con `history.replaceState`.
3. Build local + commit + push.

## Criterios de aceptación

- [x] Iconos centrados en mobile (1 col), tablet (3 cols) y desktop (5 cols).
- [x] Cada card es un `<a>` con `href="/biblioteca?pilar={id}"`.
- [x] Al clickear "Ayuno Intermitente" → `/biblioteca?pilar=ayuno` con el
  filtro Ayuno ya activo + cards filtradas a esa categoría.
- [x] `biblioteca.astro` con `?pilar=invalid` o sin query param → muestra
  todos (default, sin error).
- [x] Sin flicker entre SSR y hidratación: las cards no-matched ya tienen
  `class="hidden"` server-side.
- [x] Click en otro chip de filtro actualiza el URL sin recargar.
- [x] aria-label + focus:ring para teclado/lectores.

## Pruebas manuales

1. Home `/` → scroll a la sección "Los 5 Pilares".
2. Visualmente: iconos centrados arriba de cada card en mobile, tablet y desktop.
3. Click "Ayuno Intermitente" → navega a `/biblioteca?pilar=ayuno`.
4. En la biblioteca: el chip "⏱️ Ayuno" debe estar activo (fondo blanco).
5. Solo artículos con `pillar === 'ayuno'` deben estar visibles.
6. Click "✨ Todos" → la URL pasa a `/biblioteca` (sin query) + todas las cards visibles.
7. Click "🥗 Nutrición" → URL pasa a `/biblioteca?pilar=nutricion`.
8. Copiar URL `/biblioteca?pilar=sueno` + abrir en nueva pestaña → filtro Sueño ya aplicado.
9. URL `/biblioteca?pilar=basura` → muestra todos (fallback).
10. Browser back/forward preserva el filtro.

## Riesgos y trade-offs

- **Cards más grandes con la animación de hover**: el `transform:
  translate-y-2` puede mover el elemento sobre el siguiente section.
  Mitigación: el `py-24` de la section padre absorbe el movimiento.
- **`<a>` envolviendo elementos con hover propio**: cuidado con nested
  `<a>` si más adelante se agrega un botón "Ver más" dentro de la card.
  Por ahora la card entera es el click target.
- **Si un user lleva el `?pilar=foo` directo a la biblioteca pero ese
  pilar tiene 0 artículos**: muestra una grid vacía. Sin mensaje empty
  state — aceptable para ahora; si pasa con frecuencia, agregar copy
  "Sin artículos en este pilar todavía" en otra spec.
- **`history.replaceState` necesita HTTPS**: en localhost funciona; en
  prod (`https://...`) también. Sin issue.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos modificados:**
- `metamorfosis-web/src/components/Pillars.astro` — refactor completo:
  array `CARDS` config-driven, render con `.map()`, cards como `<a>`,
  `mx-auto` en icon container, aria-label, focus:ring.
- `metamorfosis-web/src/pages/biblioteca.astro` — lectura del query
  param `?pilar=`, render server-side de chips activos y cards
  filtradas con `class="hidden"`, script con `classList` consistente,
  sync de history API.

**Decisiones:**
- Mantener el copy display `"Alimentación"` (no `"Nutrición"`) en las
  cards aunque el ID canónico sea `nutricion`. El display es más
  amigable; el ID es para taxonomía cross-feature.
- Server-side `class="hidden"` en cards filtradas: previene flicker
  visual entre el SSR y la hidratación del script. UX mejor que
  parpadeo + reflow.
- `replaceState` en vez de `pushState`: no inflar history con cada toggle.
- `aria-label` por card con el nombre del pilar incluido: lectores de
  pantalla anuncian "Ver artículos sobre Ayuno Intermitente, link" en
  lugar de un genérico "link" sin contexto.

Sin desviaciones del plan.
