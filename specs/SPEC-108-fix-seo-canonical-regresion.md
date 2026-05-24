# SPEC-108 — Fix regresión SEO: canonical y OG apuntan a localhost (sitio sin indexar)

**Estado:** ✅ Cerrada (pendiente verificación post-deploy)
**Fase:** 4 (Operación / Crecimiento)
**Severidad:** 🔴 CRÍTICO (sitio 0% indexado en Google)
**Fecha de creación:** 2026-05-24
**Autor:** Carlos Reyes (diagnóstico vía agente Cowork)
**Depende de:** SPEC-027 (SEO técnico), SPEC-052b (Astro.site canonical), SPEC-107 (BaseLayout usa componentes reales)

---

## Contexto

Carlos reporta que `https://www.metamorfosisvital.com.co/` no recibe visitas
orgánicas. Diagnóstico en producción:

```bash
curl -s https://www.metamorfosisvital.com.co/ | grep -oE '(canonical|og:url|og:image|twitter:url|twitter:image)[^"]*"[^"]+"' | head
```

Resultado real (extraído del SSR vivo, 2026-05-24):

```
canonical:  http://localhost:4321/
og:url:     http://localhost:4321/
og:image:   http://localhost:4321/og-image.jpg
twitter:url:   http://localhost:4321/
twitter:image: http://localhost:4321/og-image.jpg
title:      | Metamorfosis Real    (vacío con pipe huérfano)
```

Búsqueda externa: `site:metamorfosisvital.com.co` en Google → **0 resultados**.
El sitio está completamente fuera del índice.

## Problema

`BaseLayout.astro` fue reescrito en el commit `7bcfae6` (SPEC-107) y la
reescritura **borró la lógica de SPEC-052b** que construía URLs absolutas
desde `Astro.site`. El layout actual volvió a usar `Astro.url`, que bajo
el reverse proxy de Hostinger HCDN cae a `http://localhost:4321/` cuando el
header `Host` no se propaga. Resultado: Google ve canonical → localhost,
descarta la página como no canónica/no accesible, y no indexa nada del sitio.

Además SPEC-107 perdió de paso:

- `og:site_name`, `og:locale` (señales para Open Graph).
- `ogType`, `publishedAt`, `updatedAt` props + `article:published_time/modified_time`
  (rich snippets de artículos).
- `preloadImage` / `preloadImageType` props (LCP del Hero — la home las pasa
  pero las ignora).
- Import de `UmamiScript` (analítica **completa** fuera de servicio).
- Preconnects a Firebase y Umami (performance).
- Fonts non-blocking (`media=print` + `onload` swap) — degradaron a `<link rel=stylesheet>` síncrono.

Con todo, esta regresión es la causa raíz del 0% de indexación y de que
caigan también los previews de redes y la analítica.

## Solución propuesta

Restaurar el `BaseLayout.astro` previo a SPEC-107 (versión de SPEC-052b en
commit `4e2ebb4`) y agregar encima los siguientes refuerzos SEO específicos
para empujar la indexación inicial:

1. **Title con fallback inteligente.** Si el caller no pasa `title`, renderizar
   solo `siteName` (sin pipe huérfano). Fix definitivo de SPEC-079 que también
   se perdió.
2. **`<meta name="robots">` explícito** con `index, follow, max-image-preview:large, max-snippet:-1`
   en páginas públicas, y `noindex, nofollow` cuando el caller pase `noindex`.
3. **JSON-LD Organization + WebSite** en todas las páginas (no solo artículos).
   Esto le dice a Google qué es el sitio (logo, social profiles) y habilita
   la sitelinks searchbox.
4. **Soporte opcional de Google Search Console** vía meta tag
   `<meta name="google-site-verification">` leído de env var
   `PUBLIC_GSC_VERIFICATION` (Carlos puede pegar el token cuando lo verifique).
5. **Prop `noindex`** en BaseLayout, aplicado a `/login`, `/dashboard`,
   `/dashboard/plan` (refuerzo del Disallow de `robots.txt`).

Se mantiene el resto del comportamiento intacto: Navbar / Footer reales
(SPEC-107), fonts pattern, preconnects, Umami script.

## Plan de implementación

1. **`metamorfosis-web/src/layouts/BaseLayout.astro`** — reescritura completa
   restaurando la versión de SPEC-052b + las 5 mejoras arriba.
2. **`metamorfosis-web/src/pages/login.astro`** — pasar `noindex={true}` a
   BaseLayout.
3. **`metamorfosis-web/src/pages/dashboard.astro`** y `dashboard/plan.astro` —
   pasar `noindex={true}`.
4. **`metamorfosis-web/src/pages/index.astro`** — pasar `title=""` explícito
   (para que el fallback aplique con claridad de intención, no por accidente).
5. `npm run build` desde `metamorfosis-web/` para validar.
6. Commit + push + esperar deploy 90-120s + verificación con curl.
7. **Pasos manuales post-deploy (Carlos):** verificar/crear Google Search
   Console, submit sitemap, request indexing del home y 5 páginas clave.

## Criterios de aceptación

- [ ] `curl https://www.metamorfosisvital.com.co/ | grep localhost` → 0 resultados.
- [ ] `og:url`, `og:image`, `twitter:url`, `twitter:image`, `canonical` todos con dominio real.
- [ ] `<title>` de la home es `Metamorfosis Real` (sin pipe huérfano).
- [ ] `og:site_name`, `og:locale` presentes.
- [ ] `<meta name="robots" content="index, follow, ...">` en home, `/imr`, `/biblioteca`, `/quiz`.
- [ ] `<meta name="robots" content="noindex, ...">` en `/login`, `/dashboard`, `/dashboard/plan`.
- [ ] JSON-LD Organization + WebSite presentes en home.
- [ ] `/sitemap.xml` accesible y con URLs del dominio real.
- [ ] `/robots.txt` accesible.
- [ ] `npm run build` pasa sin errores.
- [ ] Umami funciona de nuevo (script presente en producción).

## Pruebas

```sh
# 1) Build local
cd metamorfosis-web && npm run build

# 2) Post-deploy (≥120s después del push), correr en orden:

# a) Cero referencias a localhost en el HTML SSR
curl -s https://www.metamorfosisvital.com.co/ | grep -c "localhost:4321"
# Esperado: 0

# b) Canonical, OG y Twitter con dominio real
curl -s https://www.metamorfosisvital.com.co/ | \
  grep -oE '(canonical|og:url|og:image|twitter:url|twitter:image)[^"]*"[^"]+"' | head

# c) Title sin pipe huérfano
curl -s https://www.metamorfosisvital.com.co/ | grep -oE '<title>[^<]+</title>'
# Esperado: <title>Metamorfosis Real</title>

# d) Robots meta presente
curl -s https://www.metamorfosisvital.com.co/ | grep -oE 'name="robots"[^>]*'

# e) Login con noindex
curl -s https://www.metamorfosisvital.com.co/login | grep -oE 'name="robots"[^>]*'
# Esperado contiene: noindex

# f) Sitemap responde con URLs del dominio real
curl -s https://www.metamorfosisvital.com.co/sitemap.xml | head -5
```

**Validación externa (manual):**

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) → re-scrape la home → debe renderizar OG image branded.
- Google Search Console → verificar dominio → enviar `https://www.metamorfosisvital.com.co/sitemap.xml` → solicitar indexación de home + `/imr` + `/biblioteca` + `/quiz` + `/sobre-mi`.

## Riesgos / consideraciones

- **`Astro.site!` (non-null assert):** seguro porque `site:` está commiteado en `astro.config.mjs`. CLAUDE.md sección 2 ya lo declara como inquebrantable.
- **Re-deploy de SPEC-107:** restaurar el BaseLayout no afecta el uso de los componentes Navbar/Footer (esos se preservan). Solo cambia el `<head>`.
- **Cache de Google:** una vez deployado, Google tarda días/semanas en re-rastrear. Submit manual del sitemap en GSC acelera.
- **Si Hostinger no propaga `Host`:** SPEC-052b mostró que `Astro.site` es la ruta correcta. No depende del header.

## Commit

**Mensaje sugerido:**
```
fix(spec-108): regresión SEO crítica — canonical/og volvieron a localhost (sitio 0% indexado)

- BaseLayout.astro: restaurar versión SPEC-052b perdida en SPEC-107 (Astro.site para URLs absolutas)
- Restaurar og:site_name, og:locale, ogType/publishedAt/updatedAt, preloadImage props
- Restaurar UmamiScript y preconnects (Firebase, Umami) — analítica completa estaba caída
- Restaurar fonts non-blocking pattern (preload as=style + media=print + noscript)
- Nuevo: <meta robots> explícito con max-image-preview:large
- Nuevo: prop noindex (aplicada a /login, /dashboard, /dashboard/plan)
- Nuevo: JSON-LD Organization + WebSite en todas las páginas
- Nuevo: meta google-site-verification leído de PUBLIC_GSC_VERIFICATION env var
- Title fallback definitivo: sin title → sólo "Metamorfosis Real" (SPEC-079 reforzado)

Cierra specs/SPEC-108-fix-seo-canonical-regresion.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-24).

**Archivos tocados:**
- `metamorfosis-web/src/layouts/BaseLayout.astro` — reescritura completa: restaurada lógica de SPEC-052b (Astro.site) perdida en SPEC-107, sumados refuerzos SPEC-108 (robots meta explícito, JSON-LD Organization+WebSite, prop noindex, GSC verification opcional, og:image dimensions, title fallback).
- `metamorfosis-web/src/layouts/Layout.astro` — añadida prop `noindex` al forwarding.
- `metamorfosis-web/src/pages/login.astro` — pasa `noindex={true}`.
- `metamorfosis-web/src/pages/dashboard.astro` — pasa `noindex={true}`.
- `metamorfosis-web/src/pages/dashboard/plan.astro` — pasa `noindex={true}`.
- `metamorfosis-web/src/pages/index.astro` — `title=""` explícito (intent claro, no por accidente).

**Build:** `npm run build` corrió limpio en 7.77s. Grep al bundle SSR confirma que `BaseLayout_*.mjs` contiene `Organization`, `article:published_time`, `google-site-verification`, `max-image-preview`, `og:locale`, `og:site_name`.

**Pendientes (post-deploy, manuales de Carlos):**
- [x] Verificar curl post-deploy: canonical/og/twitter con dominio real (2026-05-24).
- [x] Token GSC hardcodeado en BaseLayout como fallback (SPEC-108b, 2026-05-24).
- [ ] Hacer click "Verificar" en GSC (token actual: `VWsHvjRtNCUgVX6rC0IYhGmiH0jRitHEu8rXd746S1A`; el primer token `bsVKXS...` resultó ser de otra propiedad y se reemplazó).
- [ ] Submit `https://www.metamorfosisvital.com.co/sitemap.xml` en GSC.
- [ ] Request indexing manual de: `/`, `/imr`, `/biblioteca`, `/quiz`, `/sobre-mi`.
- [ ] Re-scrape en Facebook Sharing Debugger para forzar refresh de OG preview.

### Sub-spec SPEC-108b — Hardcodear token GSC (2026-05-24)

Carlos eligió método de verificación "meta tag" en Google Search Console para
`https://www.metamorfosisvital.com.co/`. El token vigente es
`VWsHvjRtNCUgVX6rC0IYhGmiH0jRitHEu8rXd746S1A` (el primero compartido,
`bsVKXS...`, era de otra propiedad y se reemplazó antes de verificar). Pegarlo en Hostinger env vars
agrega una dependencia operativa para algo que no es secreto (el token es
público — Google lo lee del HTML servido). Lo hardcodeamos como fallback
en `BaseLayout.astro`. La env var `PUBLIC_GSC_VERIFICATION` queda como
override por si se rota la propiedad o cambia el método sin tocar código.

Sin desviaciones del plan.
