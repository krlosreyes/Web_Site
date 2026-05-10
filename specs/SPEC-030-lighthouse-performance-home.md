# SPEC-030 — Performance home (webp + fonts async + preload LCP)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — performance / Core Web Vitals
**Severidad:** ALTO (LCP 6.7s en mobile bloquea ranking SEO)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-013 (BaseLayout unificado), SPEC-027 (SEO técnico)

---

## Contexto

Lighthouse mobile audit del home arrojó:

| Categoría | Score |
|---|---|
| Performance | **62** ❌ |
| Accessibility | 94 ✅ |
| Best Practices | 100 ✅ |
| SEO | 100 ✅ |

Solo Performance está debajo del target (≥90). Métricas:

| Métrica | Valor | Estado |
|---|---|---|
| FCP | 5.4 s | ❌ |
| LCP | 6.7 s | ❌ |
| TBT | 0 ms | ✅ |
| CLS | 0 | ✅ |
| Speed Index | 5.8 s | ❌ |

**TBT 0 / CLS 0** son oro. El problema NO es JavaScript bloqueando ni
layout shifts — es **descarga + render bloqueado por assets pesados**.

## Causa raíz

Auditoría de `/public`:

| Archivo | Tamaño | Comentario |
|---|---|---|
| header-bg.jpg | **2.0 MB** | LCP del hero — el browser lo descubre TARDE porque está en `background-image` del CSS |
| logoSite.png | **1.4 MB** | El logo del navbar pesa 1.4 MB para mostrarse a 56px |
| carlos-reyes.png | 1.6 MB | /sobre-mi (no afecta home pero es waste) |
| elena-mockup.png | 591 KB | Sección ElenaApp preview |

Total: **~5.5 MB de imágenes públicas**. La home carga ~4 MB en el primer view.
En 4G simulada (Moto G Power) eso es 3-4 segundos solo de descarga.

Bonus: `header-bg.jpg` internamente es PNG (alguien lo renombró sin reencodear),
así que ni siquiera tiene la compresión decente de JPG.

Lighthouse también marcó:
- **Render-blocking 970ms**: el `<link rel="stylesheet">` de Google Fonts bloquea render hasta descargar el CSS de fuentes.
- **Descubrimiento de solicitudes de LCP**: el browser no descubre `header-bg.jpg` hasta parsear el CSS del Hero.
- **78 KiB caché**: assets sin Cache-Control largo (fuera de scope, requiere Nginx).
- **230 KiB JS sin usar**: NotificationBell + ElenaAppCTA con `client:load` (fuera de scope; TBT 0ms ya está bien).

## Solución

Tres fixes en un solo commit, ordenados por impacto:

### 1. Convertir imágenes pesadas a webp (impacto mayor)

Generadas con `convert <orig> -quality 82-85 -define webp:method=6 <out>.webp`:

| Archivo | Original | webp | Ahorro |
|---|---|---|---|
| header-bg.jpg | 2.0 MB | **141 KB** | -93% |
| logoSite.png | 1.4 MB | **54 KB** | -96% |
| elena-mockup.png | 591 KB | **64 KB** | -89% |
| carlos-reyes.png | 1.6 MB | **82 KB** | -95% |
| **TOTAL** | **5.5 MB** | **341 KB** | **-94%** |

Los originales `.jpg/.png` se mantienen en `/public` porque OG image scrapers
(Facebook, LinkedIn, Twitter parser legacy) no parsean webp confiablemente.
Se usan SOLO para OG meta tags y JSON-LD Publisher logo.

### 2. Preload del LCP image

`BaseLayout.astro` ahora acepta props `preloadImage` y `preloadImageType`. Cuando se
pasan, inyecta:

```html
<link rel="preload" as="image" href="/header-bg.webp" type="image/webp" fetchpriority="high">
```

Sin esto, el browser descubre la imagen recién después de parsear el CSS del
Hero. Con preload, se descarga en paralelo con el HTML. Soluciona el
"Descubrimiento de solicitudes de LCP" de Lighthouse.

`index.astro` pasa el preload del header-bg. Otras páginas con hero pueden
hacerlo (sobre-mi podría agregarlo en una iteración futura si el LCP de esa
página sube).

### 3. Google Fonts non-blocking

Pattern de los expertos (ej. web.dev/font-display):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="...css2?...display=swap">
<link href="...css2?...display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="...css2?...display=swap"></noscript>
```

- `preconnect`: handshake DNS+TLS temprano.
- `preload as="style"`: el browser descarga el CSS sin que bloquee render.
- `<link rel="stylesheet" media="print" onload="..."`: trick clásico — `media="print"` hace que el browser NO bloquee render mientras lo descarga; cuando carga, el `onload` lo cambia a `media="all"` y se aplica.
- `<noscript>`: fallback para users con JS off; en ese caso sí bloquea, que es lo aceptable como degradación.

`display=swap` ya estaba — significa que el browser muestra texto con la fuente
de sistema mientras llega la web font y la swappea cuando carga. No hay FOIT.

## Plan de ejecución

1. Generar las 4 webp con ImageMagick (`-quality 82-85`).
2. Copiar las webp a `metamorfosis-web/public/`.
3. Actualizar referencias en código (in-page only; OG/schema mantienen jpg/png):
   - `components/Hero.astro` — `background-image` a webp.
   - `components/Navbar.astro` — `<img>` del logo a webp + width/height.
   - `components/ElenaAppCTA.tsx` — `<img>` del mockup a webp + width/height + lazy.
   - `pages/index.astro` — `<img>` del mockup a webp + width/height + lazy.
   - `pages/sobre-mi.astro` — `<img>` de Carlos a webp + width/height.
   - `pages/login.astro` — `<img>` del logo a webp + width/height.
   - `styles/global.css` — `.header-bg-image` background a webp.
4. `BaseLayout.astro`: agregar props `preloadImage` + `preloadImageType` y el `<link rel="preload">` condicional.
5. `BaseLayout.astro`: cambiar el `<link rel="stylesheet">` de Google Fonts al pattern non-blocking + preload + noscript.
6. `pages/index.astro`: pasar `preloadImage="/header-bg.webp"`.
7. Commit + push.
8. Esperar 90-120s de Hostinger deploy + correr Lighthouse otra vez.

## Criterios de aceptación

- [x] Las 4 webp generadas y copiadas a `/public`.
- [x] Originales `.jpg/.png` se mantienen para OG/schema.
- [x] Hero, Navbar, ElenaAppCTA, index, sobre-mi, login, global.css apuntan a webp.
- [x] `BaseLayout` acepta `preloadImage` y lo emite cuando está presente.
- [x] `index.astro` declara `preloadImage="/header-bg.webp"`.
- [x] Google Fonts cargan con pattern non-blocking + preload + noscript fallback.
- [x] CLAUDE.md actualizado: regla "no commitear imágenes >500 KB sin webp".
- [ ] Post-deploy: Lighthouse mobile Performance ≥90.
- [ ] Post-deploy: LCP < 2.5s, FCP < 1.8s.

## Pruebas manuales

1. Tras deploy:
   ```bash
   curl -s https://metamorfosisvital.com.co/ | grep -oE 'rel="preload"[^>]*header-bg.webp'
   ```
   Debe imprimir el tag de preload.

2. Lighthouse mobile en pagespeed.web.dev — Performance ≥90 esperado.

3. Verificar a ojo en mobile que:
   - El hero se muestra rápido (no espera 3s).
   - El texto aparece de inmediato con fuente de sistema y swappea a Inter/Space Grotesk en ≤500ms (display=swap).
   - El logo del navbar carga.
   - El mockup de ElenaApp en la sección preview carga lazy al hacer scroll.

4. OG / Facebook sharing debugger: el sitio aún muestra preview con
   header-bg.jpg (.jpg porque FB no parsea webp).

## Riesgos y trade-offs

- **Soporte de webp**: ~96% global en 2026 (Can I Use). Browsers que no soporten
  van a mostrar un broken image. Mitigación: el target del proyecto es mobile
  moderno (iOS Safari 14+, Chrome Android), todos soportan webp. Si aparece
  reporte de un user con browser viejo, agregamos `<picture>` con fallback jpg.
- **OG en webp NO funciona en algunos scrapers**: por eso mantenemos el `.jpg`
  como default de OG image y el webp solo para in-page rendering.
- **`onload="this.media='all'"` con JS off**: el `<noscript>` fallback cubre
  este edge case. Sin él, users con JS off verían texto sin web fonts (lo cual
  no es catástrofe con `display=swap` igual).
- **Lazy loading del mockup**: si el user hace scroll muy rápido al hero,
  podría ver un flicker. Aceptable porque la imagen pesa solo 64 KB y carga
  en milisegundos.
- **`fetchpriority="high"` en preload**: solo soportado en Chrome/Edge 102+
  y Safari 17+. Browsers viejos lo ignoran (el preload sigue funcionando, solo
  pierde el bump de prioridad). Sin downside.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/public/header-bg.webp` — NEW, 141 KB.
- `metamorfosis-web/public/logoSite.webp` — NEW, 54 KB.
- `metamorfosis-web/public/elena-mockup.webp` — NEW, 64 KB.
- `metamorfosis-web/public/carlos-reyes.webp` — NEW, 82 KB.
- `metamorfosis-web/src/components/Hero.astro` — background-image a webp.
- `metamorfosis-web/src/components/Navbar.astro` — logo a webp + width/height.
- `metamorfosis-web/src/components/ElenaAppCTA.tsx` — mockup a webp + lazy.
- `metamorfosis-web/src/pages/index.astro` — mockup a webp + lazy + preloadImage prop.
- `metamorfosis-web/src/pages/sobre-mi.astro` — carlos-reyes a webp + width/height.
- `metamorfosis-web/src/pages/login.astro` — logo a webp + width/height.
- `metamorfosis-web/src/styles/global.css` — `.header-bg-image` a webp.
- `metamorfosis-web/src/layouts/BaseLayout.astro` — props `preloadImage`/`preloadImageType`, preload condicional, Google Fonts pattern non-blocking.
- `CLAUDE.md` — regla nueva sección 4: no PNG/JPG >500KB en /public sin webp.

**Decisiones:**
- webp directo (sin `<picture>` fallback): soporte 96%+ y target del sitio
  es mobile moderno. Simpler markup.
- Mantener originales en `/public` para OG/schema, no borrarlos.
- Width/height en `<img>` para prevenir CLS (cuando carga lazy o slow network).
- Lazy loading para imágenes below-the-fold (elena-mockup, mockup en modal).
- `decoding="async"` en imágenes grandes — no bloquea main thread mientras decodifica.

**Pendientes a chequear post-deploy:**
- Correr Lighthouse otra vez en pagespeed.web.dev. Si Performance < 90 todavía,
  abrir SPEC-030b con: (a) `client:idle` en NotificationBell + ElenaAppCTA;
  (b) Cache-Control largo en static assets vía Hostinger Nginx; (c) audit
  de imágenes en posts del blog que el admin sube.

Sin desviaciones del plan funcional.
