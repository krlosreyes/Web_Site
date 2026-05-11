# SPEC-065 — Renderer de artículos con formato visual rico

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — editorial / visual
**Severidad:** ALTO (artículos lucen como muro de texto a pesar de SPEC-063)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-015 (drafts + editor), SPEC-062 (slugify), SPEC-063 (normalizar párrafos)
**Hermana:** SPEC-066 (prompts editoriales nuevos que generan el markdown que este renderer consume)

---

## Contexto

Carlos mostró un artículo de HubSpot ES (blog.hubspot.es/marketing/ai-search) como
referencia visual. El artículo tiene callouts coloridos diferenciados
("Respuesta rápida" naranja, "Dato clave" azul, "Rendimiento comprobado" verde),
tabla comparativa estilizada, listas con ✅/❌ inline, índice de contenidos
arriba. Sus palabras: *"los articulos siguen igual deladrilludos feos. lo quiero
asi: [HubSpot URL]. Se puede? que debemos modificar?"*

Diagnóstico: el renderer en `pages/posts/[slug].astro` ya tiene CSS elaborado
para `h2/h3` (icono ✦), `blockquote` (caja "CLAVE DEL PROTOCOLO"), `ul/ol`
(grid de cards / roadmap numerado). Pero:

- **No tiene estilos para `table`** — si la IA genera una, sale sin borders.
- **No tiene callouts diferenciados** — todos los blockquote son el mismo color teal.
- **No tiene listas con ✅/❌** estilizadas (el `::before` siempre es ✦).
- **No tiene índice de contenidos** automático.

Y el prompt no le pide a la IA generar callouts diferenciados, tablas, ni listas
✅/❌. Aunque extendamos el CSS solo, la IA no genera el input que activa
esos estilos.

Decisión de Carlos: ir con plan completo (renderer + prompts), commit conjunto,
manteniendo paleta de marca Metamorfosis (dark + teal/azul) con colores nuevos
naranja/morado/amber/azul SOLO en los acentos de los 5 callouts.

## Solución

### 1) Helper `lib/utils/enrichArticleHtml.ts`

Post-procesa el HTML que produce `marked.parse()` con regex. Recibe el HTML
crudo y devuelve `{ html, headings }`.

Operaciones:

1. **IDs slugificados en cada `<h2>`** — para que el TOC pueda linkear con
   anchors limpios (`#por-que-el-ayuno-funciona`).
2. **Callout classes por prefijo del blockquote.** Detecta `<blockquote><p><strong>Tipo:</strong>...`
   y le añade una clase `callout-{fast,key,perf,transition,impl}` según el tipo:
   - `Respuesta rápida` → `callout-fast` (naranja)
   - `Dato clave` → `callout-key` (azul)
   - `Rendimiento comprobado` → `callout-perf` (verde teal)
   - `Transición recomendada` → `callout-transition` (amber)
   - `Dato de implementación` → `callout-impl` (morado)

   Blockquotes sin prefijo NO reciben clase → conservan el estilo
   "CLAVE DEL PROTOCOLO" original (teal centrado).
3. **`<li class="check-yes">` / `check-no`** detectando ✅/❌ como primer
   carácter del listitem.
4. **TOC** (índice de contenidos) auto-generado si hay ≥3 H2s. Se inserta
   después del primer `</p>` (intro). Estructura `<nav class="article-toc">`.

Implementado en `metamorfosis-web/src/lib/utils/enrichArticleHtml.ts`
(~120 líneas con docstring completo). Pure function, sin dependencias externas.

### 2) Integración en `[slug].astro`

```ts
import { enrichArticleHtml } from "../../lib/utils/enrichArticleHtml";
// ...
const rawHtml = marked.parse(cleanedContent) as string;
const { html: processedContent } = enrichArticleHtml(rawHtml);
```

El `<div set:html={processedContent} />` existente sirve sin cambios.

### 3) CSS nuevo en `<style is:global>`

Añadidos al final del bloque `.prose` (antes del `@keyframes fadeInUp`):

- **5 variantes de `.prose blockquote.callout-*`** con border-left de 5px del
  color del tipo + label uppercase de 10px arriba. El `::before` "CLAVE DEL
  PROTOCOLO" se anula con `content: none` para estos casos.
- **`.prose table`** con header navy + acento teal en bottom-border + filas
  alternadas + hover teal sutil. Primer columna en blanco bold (jerarquía).
- **`.prose ul li.check-yes/check-no`** que anula el grid card del default
  (`@apply !bg-transparent !border-0`) y deja el ✅/❌ que ya viene en el texto.
- **`.prose .article-toc`** caja con gradient teal→blue sutil + label uppercase
  + lista numerada con counter `decimal-leading-zero` (01, 02, 03...).
- **`scroll-behavior: smooth`** + `scroll-margin-top: 100px` en `h2[id]` para
  que el navbar fixed no tape el destino al hacer scroll por el TOC.

## Tests

Helper validado en sandbox Node con `marked` real del proyecto. 11/12
aserciones pasan; la 12 fallaba por contar mentalmente 4 H2 cuando el sample
tenía 3 (siguiendo `feedback_test_values_calibration.md` — la verdad es el
helper, no la estimación).

Cobertura del test:
- Los 5 callouts se asignan correctamente.
- ✅/❌ en listas reciben sus clases.
- TOC se genera con ≥3 H2.
- H2 reciben IDs slugificados.
- Tablas pasan sin tocar.
- Blockquotes SIN prefijo conservan el estilo default (no se les añade clase).

## Criterios de aceptación

- [x] `lib/utils/enrichArticleHtml.ts` exporta `enrichArticleHtml(html): { html, headings }`.
- [x] Pure function, sin side effects.
- [x] Asigna `callout-*` a blockquotes según los 5 prefijos.
- [x] Blockquote sin prefijo NO recibe clase (fallback al default existente).
- [x] H2 reciben `id="..."` slugificado.
- [x] `<li>` con ✅/❌ inicial recibe `class="check-yes"` / `check-no`.
- [x] TOC se inserta si hay ≥3 H2.
- [x] Validado en sandbox con `marked` del proyecto.
- [x] `[slug].astro` usa el helper después de `marked.parse()`.
- [x] CSS para las 5 variantes de callout + tabla + ✅/❌ + TOC añadido.
- [x] `scroll-behavior: smooth` para navegación del TOC.
- [ ] Post-deploy: generar un artículo nuevo con el prompt de SPEC-066 y
      verificar que los 5 callouts, la tabla, las listas con ✅/❌ y el TOC
      lucen como en HubSpot pero con paleta Metamorfosis.

## Riesgos y trade-offs

- **Post-procesamiento con regex en lugar de custom renderer de marked:**
  más simple y robusto frente a cambios de API de marked (v9 → v10), pero
  acoplado al formato HTML que marked emite. Si marked cambiara el wrapping
  (ej. omitiera el `<p>` dentro de blockquote), los regex fallan. Mitigado
  con el test sandbox — si algún día sube marked, re-correr el test.
- **Conflicto con `.prose ol` (roadmap numerado) y el TOC que usa `<ol>`:**
  resuelto con `.article-toc-list` que anula `!bg-transparent !border-0
  !p-0 !my-0 !list-none`. Igual el counter del TOC es separado
  (`counter-reset: toc-counter`).
- **5 colores nuevos en la paleta (naranja, azul, amber, verde teal, morado):**
  cohesivos visualmente porque solo aparecen en acento de border-left + label
  pequeño, no como fondos grandes. Mantiene la sensación dark + teal de
  Metamorfosis.
- **Artículos antiguos sin callouts NO se rompen:** el helper hace
  pass-through del HTML que no matchea ninguna regla. Compatible 100% con
  contenido legacy (que de todos modos Carlos ya borró).

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos creados:**
- `metamorfosis-web/src/lib/utils/enrichArticleHtml.ts` — helper de
  post-procesamiento del HTML de marked.
- `docs/PROMPTS-EDITORIAL.md` — los 5 frameworks de prompt (Ver SPEC-066).

**Archivos modificados:**
- `metamorfosis-web/src/pages/posts/[slug].astro` — import + uso del
  helper + ~150 líneas nuevas de CSS para callouts diferenciados, tablas,
  listas ✅/❌ y TOC.

**Decisiones:**
- Helper como pure function (no extension de marked): testeable
  independientemente, sin atarse al API mutante de marked.
- Detección de callout por prefijo del blockquote (no por sintaxis
  admonition `:::`): se mantiene markdown 100% estándar; cualquier editor
  externo (NotebookLM, GitHub) sigue pudiendo procesarlo sin extension.
- TOC solo si hay ≥3 H2: artículos cortos no necesitan TOC y sería ruido.
- Sin `<details>` colapsable en TOC: ya es lo suficientemente compacto;
  agregar interacción innecesaria para un panel admin de single user.

**Notas operativas para Carlos:**
1. Genera artículos nuevos con los prompts de `docs/PROMPTS-EDITORIAL.md`
   (SPEC-066). Los outputs incluirán los callouts/tablas/listas automáticamente.
2. Pega el output en el editor admin (lo normaliza SPEC-063, lo enriquece
   este renderer, lo muestra con paleta Metamorfosis).
3. Si la IA en algún caso omite un callout, NO pasa nada: el artículo se
   ve igual de bien; los callouts son aditivos.

Sin desviaciones del plan.
