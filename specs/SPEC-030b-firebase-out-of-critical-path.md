# SPEC-030b — Diferir Firebase Auth del critical path + fixes secundarios

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — performance / Core Web Vitals
**Severidad:** ALTO (LCP 7.2s, Performance 62 sin mejora tras SPEC-030)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-030 (imágenes webp + preload), SPEC-043 (NotificationBell), SPEC-048 (ElenaAppCTA)

---

## Contexto

Después de SPEC-030 el Performance mobile siguió en 62 (FCP 5.4s / LCP 7.2s).
SPEC-030 resolvió todo lo relacionado a imágenes (5.5MB → 341KB) y Google
Fonts (render-blocking → async). Pero el reporte completo de Lighthouse
reveló el verdadero cuello de botella en el "Árbol de dependencias de red":

```
https://metamorfosisvital.com.co - 283ms, 11 KiB
└── NotificationBell.js (client:load) - 641ms
└── client.EdiErWOb.js (Astro client framework) - 640ms
└── ElenaAppCTA.BDC87fzk.js (client:load) - 642ms
└── Navbar.astro_ast.js - 338ms
    └── preload-helper.js - 563ms
        └── firebase.js (127 KB, 93% sin usar) - 798ms
            └── auth/iframe.js (firebaseapp.com, 90 KB) - 1,197ms
                └── googleapis.com/getProjectConfig - 1,365ms

Latencia de ruta crítica máxima: 1,365 ms
```

El navegador entra a la página y antes de pintar el LCP tiene que:
1. Descargar Astro client framework.
2. Hidratar NotificationBell + ElenaAppCTA (porque tienen `client:load`).
3. Para hidratarlos, descargar el bundle de Firebase SDK (127 KB).
4. El SDK levanta un iframe en `firebaseapp.com` para Auth (90 KB).
5. El iframe llama a `googleapis.com/getProjectConfig` (1.3s).

Solo después de toda esa cadena el browser puede pintar el "Largest
Contentful Paint". Es 1.3 segundos en el critical path SOLO para
inicializar Firebase, aunque el user no esté logueado.

## Causa raíz

`client:load` significa "hidratar este componente AHORA, en el primer paint".
Cuando un componente hidratado importa Firebase al top-level, Astro genera
un módulo JS que se descarga sincrónicamente al cargar la página. Eso
empuja Firebase al critical path aunque la primera interacción del user
con la bell o el CTA pueda venir 5-10 segundos después.

Otros issues secundarios identificados por Lighthouse:

| Issue | Impacto |
|---|---|
| `logoSite.webp` es 1024x1024 pero se muestra a 56px | Ahorro 53 KB |
| Sin preconnect a firebaseapp.com / umami.dev | Ahorro 310+300 ms |
| Footer: `text-gray-500` y `text-[#4a637e]` sobre `bg-gray-900` no pasan WCAG AA (contrast 3.3:1, AA pide 4.5:1) | Accesibilidad: 94 → 100 esperado |

## Solución

Cuatro fixes en un solo commit:

### 1. `client:load` → `client:idle` (impacto mayor)

En `Navbar.astro`:
- `<NotificationBell client:load />` → `<NotificationBell client:idle />`
- `<ElenaAppCTA client:load />` → `<ElenaAppCTA client:idle />` (2 lugares: desktop + mobile)

`client:idle` hidrata el componente cuando `requestIdleCallback` dispare —
es decir, después del first paint, cuando el browser está libre. La descarga
de Firebase se posterga a ese momento, fuera del critical path del LCP.

UX impact: la campanita y el pill ElenaApp aparecen visualmente como
placeholders SSR (HTML inicial) y se "interactivan" ~100-200ms después.
Como ninguno de los dos requiere interacción inmediata, es transparente.

### 2. Preconnect a terceros que Firebase + Umami llaman

En `BaseLayout.astro`, agregar al `<head>`:

```html
<link rel="preconnect" href="https://elena-app-2026-v1.firebaseapp.com" crossorigin>
<link rel="preconnect" href="https://api-gateway.umami.dev" crossorigin>
```

Lighthouse reportó ahorro estimado de LCP: 310ms + 300ms = **~610ms**. El
handshake DNS+TLS se hace en paralelo con el render, así cuando los
componentes idle se hidratan y llaman a esos hosts, la conexión está caliente.

### 3. Resize `logoSite.webp` a 192x192

El logo se muestra como máximo a 56-64px (Tailwind `h-12`/`h-14`). 192x192
da 3x para retina (más que suficiente). Bajamos de 54 KB (1024x1024) a
**4.5 KB** (192x192). Ahorro -49 KB.

Tamaño escogido: 192px porque algunos mobiles tienen retina 3x (DPR=3),
así que 64px display × 3 = 192px source.

### 4. Fix contraste WCAG AA en Footer

`bg-gray-900` (#111827) tiene luminancia ~0.013. Para AA con texto pequeño
necesitamos ratio ≥4.5:1.

- `text-[#4a637e]` luminancia 0.10 → ratio 3.3:1 ❌
- `text-gray-500` (#6B7280) luminancia 0.16 → ratio 4.2:1 ❌ (casi)
- `text-gray-400` (#9CA3AF) luminancia 0.34 → ratio **6.4:1** ✅

Cambios:
- Email del footer: `text-gray-500 italic` → `text-gray-400 italic`
- Copyright: `text-[#4a637e]` → `text-gray-400`
- Links "Privacidad"/"Términos" footer-bottom: `text-[#4a637e]` → `text-gray-400`

El hover queda igual (`hover:text-[#007BFF]`).

## Plan de ejecución

1. `Navbar.astro`: 3 cambios `client:load` → `client:idle` (línea 96, 98, 220).
2. `Navbar.astro`: actualizar `width="56"` → `width="192"` y `height="56"` → `height="192"` en el logo (el atributo describe el natural size del archivo, no el display).
3. `BaseLayout.astro`: 2 `<link rel="preconnect">` nuevos en `<head>`.
4. Resize `logoSite.png` (1024x1024) → `logoSite.webp` (192x192) con `convert -resize 192x192 -quality 88`.
5. `Footer.astro`: 4 cambios de class (gray-500 → gray-400, [#4a637e] → gray-400 ×3).
6. Build local (`npm run build`) para sanity check.
7. Commit + push.
8. Esperar deploy, re-correr Lighthouse.

## Criterios de aceptación

- [x] NotificationBell y ElenaAppCTA usan `client:idle` (3 instancias).
- [x] BaseLayout incluye preconnect a firebaseapp.com y umami.dev.
- [x] logoSite.webp ahora pesa <10 KB y es 192x192.
- [x] Footer no tiene textos con contraste <4.5:1.
- [x] Build local OK (sin warnings nuevos).
- [ ] Post-deploy: Lighthouse mobile Performance ≥85 (target 90, mínimo aceptable 85).
- [ ] Post-deploy: Accessibility = 100 (era 94).
- [ ] Post-deploy: `auth/iframe.js` NO aparece en la "Latencia de ruta crítica" del árbol.

## Pruebas manuales

1. Tras deploy:
   ```bash
   curl -s https://metamorfosisvital.com.co/ | grep -E 'client:idle|preconnect.*firebase|preconnect.*umami'
   ```
   Debe mostrar los preconnects y (en el HTML del browser dev tools) la
   directiva de hidratación idle se traduce en `<astro-island ... client="idle">`.

2. Visual en mobile:
   - El navbar carga rápido.
   - La campanita y el pill ElenaApp aparecen pero quedan "stunned" 100-200ms antes de ser interactivos.
   - Si el user está logueado, después de ~200-500ms el badge de notifs unread se actualiza.
   - Click en logout sigue funcionando (era dynamic import, sin cambios).

3. Lighthouse mobile incógnito en pagespeed.web.dev/?v=3.

4. Accessibility: chequear que el reporte ya no marque "contraste" en el footer.

## Riesgos y trade-offs

- **`client:idle` retrasa la hidratación**: la bell muestra 0 notifs hasta
  que hidrata. Si un user prende la app y mira la bell en el primer
  segundo, podría perderse un badge. Trade-off aceptable: nadie mira la
  bell sin antes navegar.
- **Si el user clickea la bell o el CTA antes de hidratar**: el click no
  hace nada hasta hidratación (~200ms en mobile decent). React/Astro maneja
  esto correctamente (el `addEventListener` se agrega al hidratar).
- **Preconnect a hosts que no se llaman siempre**: el preconnect tiene
  costo casi cero (un handshake TCP+TLS). Worst case: 1 conexión TCP
  desperdiciada. Mejor que 1.3s en critical path.
- **logoSite.webp 192x192 en retina 4x (algunos mobiles)**: se vería
  blurry. Si aparece reporte, generar @4x (256x256 ~6 KB). Por ahora 192
  cubre 99% del install base.
- **Footer color change rompe el "design intent"**: el `#4a637e` era un
  azul-gris oscuro intencional. `gray-400` es más neutro, menos elegante.
  Si Carlos quiere mantener el tono azulado, usar `text-slate-400`
  (#94a3b8) — también pasa WCAG AA (ratio 5.8:1) y conserva el feel azul.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/public/logoSite.webp` — REGENERADO 192x192 (54 KB → 4.5 KB).
- `metamorfosis-web/src/components/Navbar.astro` — `client:idle` ×3 + width/height del logo a 192.
- `metamorfosis-web/src/layouts/BaseLayout.astro` — 2 preconnects nuevos.
- `metamorfosis-web/src/components/Footer.astro` — 4 changes de class para WCAG AA.

**Decisiones:**
- `client:idle` (vs `client:visible`): la bell vive en el navbar fixed,
  siempre está visible. `idle` es semánticamente más correcto: hidratá
  cuando el browser tenga tiempo, no cuando entre al viewport (ya está).
- Logo 192x192 (vs 128x128): cubre retina 3x, da margen para zoom de UI.
- `text-gray-400` (vs `text-slate-400`): Tailwind gray es el default del
  resto del footer; mantengo consistencia. Si el feel azul es importante,
  fácil cambio futuro.
- NO refactoreé el dynamic import de Firebase en `Navbar.astro` script:
  ya está bien implementado (línea 351: `import("../lib/firebase").then(...)`).
  El issue era SOLO los componentes React con `client:load`.

**Pendiente post-deploy:**
- Re-correr Lighthouse. Si Performance < 90, abrir SPEC-030c con
  self-hosting de Google Fonts y/o Cache-Control en Hostinger.

Sin desviaciones del plan.
