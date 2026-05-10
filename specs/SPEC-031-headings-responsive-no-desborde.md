# SPEC-031 — Headings responsive sin desborde (audit completo)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — UX/calidad visual
**Severidad:** ALTO (síntoma visible en producción: "HOLA, METAMORFOSIS" cortado)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-013 (layouts oscuros), SPEC-026 (navbar no tapa)

---

## Contexto

Carlos reporta con screenshot que el dashboard del usuario muestra "HOLA, METAMORFOSIS" con la "S" final cortada por el borde derecho del viewport en mobile. Audit del repo identifica el bug y revela que **otros lugares con texto dinámico podrían sufrir el mismo problema** con nombres / títulos largos.

## Problema

Audit de headings con texto dinámico en el repo:

| Archivo | Línea | Clase actual | Veredicto |
|---|---|---|---|
| `BioDashboard.tsx` | 150 | `text-6xl` (sin responsive) con `Hola, {userName}` | ❌ **BUG**: 60px × ~12 chars > 380px viewport mobile |
| `posts/[slug].astro` | 160 | `text-4xl md:text-7xl` con `{processedTitle}` | ⚠️ **Riesgo**: título largo (>40 chars) + `tracking-tighter` puede desbordar mobile |
| `ForumEngine.tsx` | 155, 215 | `text-3xl md:text-5xl` con `selectedTopic.title` | ⚠️ **Riesgo**: títulos largos en mobile |
| `Hero.astro` | 26 | `text-5xl md:text-7xl` (estático) | ✅ OK |
| `sobre-mi.astro` | 30 | `text-4xl sm:text-5xl lg:text-6xl` | ✅ OK |
| `protocolo.astro`, `dashboard-7d.astro` | varios | `text-3xl sm:text-4xl` | ✅ OK |

Causas raíz:

1. **Sin breakpoints responsive**: `text-6xl` en mobile = 60px puro.
2. **`tracking-tighter` agresivo**: comprime letras horizontalmente pero no compensa el largo total.
3. **Sin `break-words`**: cuando una palabra individual es más ancha que el contenedor (caso "METAMORFOSIS" en text-6xl mobile), CSS por defecto la deja overflow horizontal sin partir.
4. **Sin `min-w-0` en flex parent**: cuando el header es flex, el child con texto largo expande el contenedor.
5. **Sin defensa global**: cualquier heading nuevo que se agregue olvidando la regla repite el bug.

## Solución propuesta

### 1. Fix puntual de los 3 lugares identificados

**`BioDashboard.tsx`** (el del bug):

```tsx
// Antes
<h1 className="text-6xl font-black ...">
// Después
<h1 className="text-4xl sm:text-5xl md:text-6xl font-black ... break-words">
```

Y en el flex parent, agregar `min-w-0` para que el child pueda achicarse:

```tsx
<div className="flex flex-col md:flex-row md:items-end justify-between gap-6 ...">
    <div className="min-w-0 flex-1">  {/* min-w-0 nuevo */}
        <h1 ...>...</h1>
    </div>
    ...
</div>
```

**`posts/[slug].astro:160`**:

```astro
<!-- Antes: text-4xl md:text-7xl -->
<!-- Después: text-3xl sm:text-4xl md:text-5xl lg:text-7xl + break-words -->
```

**`ForumEngine.tsx:155, 215`**: agregar `break-words`.

### 2. Defensa global vía CSS

En `src/styles/global.css`, agregar regla que aplique a TODOS los headings:

```css
@layer base {
    h1, h2, h3, h4, h5, h6 {
        /* Cuando una palabra individual excede el contenedor (typo, nombre
           largo, slug raro), en lugar de overflow horizontal la partimos
           con guión. anywhere es más agresivo que break-word. */
        overflow-wrap: anywhere;
    }
}
```

Esto NO afecta el layout cuando el texto cabe normal — solo se activa cuando una palabra es más ancha que el contenedor. Defensa silenciosa.

### 3. Regla en `CLAUDE.md`

Agregar a la sección 4 ("Reglas inquebrantables"):

> Headings con texto dinámico (`{userName}`, `{title}` de artículo, etc.) DEBEN ser responsive con al menos `text-3xl sm:text-Nxl md:text-Mxl`. Y el flex parent debe tener `min-w-0` cuando hay un sibling fijo a la derecha. Sin esto, un nombre largo desborda en mobile.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Fix `BioDashboard.tsx` línea 148-153.
3. Fix `posts/[slug].astro` línea 160-164.
4. Fix `ForumEngine.tsx` líneas 155 y 215.
5. Agregar regla `overflow-wrap: anywhere` a `global.css`.
6. Agregar regla a CLAUDE.md.
7. Build + commit + push.
8. Verificación visual en mobile y desktop con un nombre largo (ej. registrar "METAMORFOSIS PRUEBA EXTENDIDA").

## Criterios de aceptación

- [x] El saludo del dashboard ("Hola, X") se ve completo en mobile (375px) sin cortarse, incluso con nombre de 15 chars.
- [x] El título de un artículo con título largo (>50 chars) se ve completo en mobile sin overflow horizontal.
- [x] El foro con tópico de título largo se ve completo en mobile.
- [x] Sin regresiones visuales en desktop (mismos tamaños donde antes se veían bien).
- [x] La regla CSS `overflow-wrap: anywhere` no rompe ningún heading existente.
- [x] CLAUDE.md tiene la regla anti-desborde.

## Pruebas manuales

1. Login con un user de nombre normal ("Carlos", 6 chars) en mobile 375px → "Hola, Carlos" se ve perfecto.
2. Login con user de nombre largo ("Metamorfosis Prueba", 18 chars) → se ve completo, wrappea si hace falta.
3. Abrir un artículo con título largo en mobile → título se ve completo sin overflow.
4. DevTools responsive: probar 320px (iPhone SE), 375px (iPhone), 414px (iPhone Plus), 768px (iPad), 1024px (laptop).
5. Verificar que nada se rompe en desktop (todos los headings que ya estaban OK siguen estándolo).

## Riesgos y trade-offs

- **`overflow-wrap: anywhere` puede partir palabras de forma poco estética** (ej. "META-MORFOSIS"). Solo se activa en el caso extremo "palabra más ancha que contenedor", que era exactamente el bug. Si un día Carlos quiere control fino, agregamos `hyphens: auto` con `lang="es"` en el HTML.
- **Mobile-first responsive**: no toco los lugares que ya están bien (`text-4xl sm:text-5xl lg:text-6xl` etc). Solo aplico fix donde hay bug confirmado o riesgo alto.
- **No hago breakpoint en cada heading del repo**: alguien puede agregar uno nuevo sin responsive en el futuro. La defensa global cubre el caso de "palabra demasiado larga" pero NO cubre "fuente demasiado grande" (ej. `text-9xl` en mobile sigue siendo 128px). Por eso la regla en CLAUDE.md.

## Compatibilidad con ElenaApp

Sin impacto.

## Commit

```
fix(spec-031): headings responsive sin desborde — audit completo

- BioDashboard.tsx: 'Hola, {userName}' ahora text-4xl sm:text-5xl md:text-6xl
  + break-words; flex parent con min-w-0 + flex-1 para shrink correcto
- posts/[slug].astro: título artículo text-3xl sm:text-4xl md:text-5xl
  lg:text-7xl + break-words (antes desbordaba con títulos >40 chars)
- ForumEngine.tsx: break-words en h2 de hero y h2 con selectedTopic.title
- global.css: overflow-wrap: anywhere en h1-h6 (defensa global)
- CLAUDE.md: regla agregada — headings con texto dinámico deben ser
  responsive y flex parent con min-w-0

Cierra SPEC-031.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/components/BioDashboard.tsx` — h1 con responsive + break-words; flex parent con min-w-0 + flex-1.
- `metamorfosis-web/src/pages/posts/[slug].astro` — h1 título con responsive más conservador en mobile + break-words.
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — break-words en los 2 h2 dinámicos.
- `metamorfosis-web/src/styles/global.css` — regla `overflow-wrap: anywhere` para h1-h6.
- `CLAUDE.md` — sección 4 ampliada con regla de headings dinámicos.

**Decisiones tomadas en la marcha:**
- **`overflow-wrap: anywhere` vs `break-word`**: `anywhere` es más permisivo y rompe en cualquier punto si hace falta. `break-word` solo rompe en oportunidades de wrap. Para evitar overflow horizontal real, `anywhere` es mejor garantía.
- **No agregué `hyphens: auto`**: en español los hyphens automáticos del browser pueden ser raros. Si Carlos los quiere, una iteración chica con `hyphens: auto` + `lang="es"` en `<html>`.
- **Flex parent con `min-w-0 flex-1`**: clave porque sin `min-w-0`, los flex children tienen `min-width: auto` por default = el ancho del contenido más largo. `flex-1` hace que ocupe el espacio sobrante pero el `min-w-0` permite que se achique cuando hace falta.
- **No toqué lugares que ya estaban OK** (Hero.astro, sobre-mi, protocolo, dashboard-7d): conservar el blast radius del cambio.

**Sin desviaciones del plan funcional.** Todos los criterios de aceptación quedan cumplidos.
