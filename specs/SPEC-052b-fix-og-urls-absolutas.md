# SPEC-052b — Fix OG URLs absolutas (Astro.site)

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento (Bloque 3 sub-spec)
**Severidad:** 🔴 BLOQUEANTE (rompe TODOS los previews de redes)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-027 (SEO meta tags), SPEC-052 (OG image branded)

---

## Contexto

Durante la verificación post-deploy de SPEC-052, Carlos corrió:

```bash
curl -s https://metamorfosisvital.com.co/ | grep -oE 'og:image[^>]*' | head -1
# og:image" content="http://localhost:4321/header-bg.jpg"
```

El meta tag `og:image` se renderiza con **dominio `localhost:4321`** en
lugar del dominio real. Lo mismo ocurre con `og:url`, `twitter:url`,
`twitter:image`, y todas las URLs absolutas del JSON-LD de artículos.

## Causa raíz

`BaseLayout.astro` (y `posts/[slug].astro`) usaban `Astro.url` para
construir URLs absolutas:

```astro
<meta property="og:image" content={new URL(image, Astro.url)} />
```

`Astro.url` en SSR es la URL del request actual. Bajo el adapter
`@astrojs/node` corriendo detrás del reverse proxy de Hostinger HCDN, el
header `Host` del request no siempre se propaga al server Node. Cuando
no se propaga, Astro cae al default del dev server: `http://localhost:4321/`.

Resultado: los scrapers de Facebook, LinkedIn, Twitter, WhatsApp leen el
meta tag, intentan fetchear `http://localhost:4321/og-image.jpg` desde
sus propios servers, **fallan con connection refused** y NO renderizan
preview de imagen — aunque la imagen exista perfectamente en
`https://metamorfosisvital.com.co/og-image.jpg`.

Esto rompe TODOS los previews de redes sociales del sitio, no solo el
default. Cualquier share — home, artículos, comunidad — queda sin
imagen de preview.

## Solución

Usar `Astro.site` (URL canónica configurada) en lugar de `Astro.url`
(request URL) para construir URLs absolutas.

`Astro.site` viene de la propiedad `site:` en `astro.config.mjs`. Si no
está seteada, `Astro.site` es `undefined`. La solución:

1. Setear `site: 'https://metamorfosisvital.com.co'` en `astro.config.mjs`.
2. Reemplazar `Astro.url` por `Astro.site` (con `!` non-null assert)
   en TODOS los puntos donde se construya URL absoluta para OG, canonical,
   Twitter, JSON-LD.
3. Mantener `Astro.url.pathname` y `Astro.url.searchParams` donde se
   usan — esos son fragmentos del request real y son confiables; el
   problema es solo el host/origin.

## Plan de ejecución

1. Editar `astro.config.mjs`: agregar `site: 'https://metamorfosisvital.com.co'`.
2. Editar `BaseLayout.astro`:
   - Calcular `pageURL = new URL(Astro.url.pathname, Astro.site!).href` en frontmatter.
   - Calcular `imageURL = new URL(image, Astro.site!).href` en frontmatter.
   - Reemplazar `Astro.url` por `pageURL` en `og:url`, `twitter:url`.
   - Reemplazar `new URL(image, Astro.url)` por `imageURL` en `og:image`, `twitter:image`.
   - Reemplazar `Astro.url.href` default de `canonicalURL` por `pageURL`.
3. Editar `posts/[slug].astro`:
   - `image` del JSON-LD: `new URL(ogImage, Astro.site!).toString()`.
   - `publisher.logo.url`: `new URL('/logoSite.png', Astro.site!).toString()`.
   - `mainEntityOfPage.@id`: `new URL(Astro.url.pathname, Astro.site!).toString()`.
4. Build local + commit + push.

## Criterios de aceptación

- [x] `astro.config.mjs` tiene `site: 'https://metamorfosisvital.com.co'`.
- [x] `BaseLayout.astro` NO usa `Astro.url` para URLs absolutas — usa `Astro.site`.
- [x] `posts/[slug].astro` NO usa `Astro.url` para URLs absolutas — usa `Astro.site`.
- [x] `Astro.url.pathname` y `Astro.url.searchParams` se mantienen donde se usan (esos son safe).
- [x] Build local pasa OK.
- [ ] Post-deploy: `curl -s / | grep og:image` muestra dominio real `https://metamorfosisvital.com.co/og-image.jpg`.
- [ ] Post-deploy: ningún meta tag muestra `localhost:4321`.
- [ ] Facebook Sharing Debugger renderiza preview con imagen.

## Pruebas manuales

Después del deploy:

```bash
echo "=== og:image debe ser dominio real ==="
curl -s https://metamorfosisvital.com.co/ | grep -oE 'og:image[^>]*'
# Esperado: og:image" content="https://metamorfosisvital.com.co/og-image.jpg"

echo "=== og:url debe ser dominio real ==="
curl -s https://metamorfosisvital.com.co/ | grep -oE 'og:url[^>]*'

echo "=== canonical debe ser dominio real ==="
curl -s https://metamorfosisvital.com.co/ | grep -oE 'rel="canonical"[^>]*'

echo "=== No debe haber NINGUNA referencia a localhost en meta tags ==="
curl -s https://metamorfosisvital.com.co/ | grep -c "localhost"
# Esperado: 0
```

Visual:
- `https://developers.facebook.com/tools/debug/?q=https://metamorfosisvital.com.co/`
  → Click "Fetch new scrape information" → debe mostrar la OG image branded.

## Riesgos y trade-offs

- **Si Astro.site no está configurada y alguien lo borra**: el `Astro.site!`
  (non-null assertion) fallaría en runtime con `Cannot read property 'href' of undefined`. Mitigación: la
  propiedad está commiteada en astro.config.mjs y CLAUDE.md mencionará la
  regla en sección 2 (Stack).
- **Cache de scrapers**: Facebook/LinkedIn cachean previews. Después del
  deploy, hay que forzar refresh en sus debug tools para ver el cambio.
- **`Astro.url.pathname` también caería a localhost?** NO — `pathname`
  es relativo (`/biblioteca`, `/posts/foo`), no depende del host. Es
  derivado del path del request, que sí llega bien.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos tocados:**
- `metamorfosis-web/astro.config.mjs` — añadida `site: 'https://metamorfosisvital.com.co'`.
- `metamorfosis-web/src/layouts/BaseLayout.astro` — refactor: `pageURL` + `imageURL` calculados con `Astro.site`; reemplazadas 4 referencias a `Astro.url` por las constantes.
- `metamorfosis-web/src/pages/posts/[slug].astro` — 3 referencias `Astro.url` → `Astro.site` en JSON-LD (image, publisher.logo, mainEntityOfPage.@id).

**Decisiones:**
- `Astro.site!` (non-null assert): es seguro porque la propiedad está
  en config commiteado.
- Mantener `Astro.url.pathname` y `Astro.url.searchParams` (estos no
  dependen del host).
- NO migrar el sitemap.xml.ts que ya usa `BASE_URL` hardcoded — esa es
  una solución independiente que también funciona.

**Próximo bloque:** Bloque 4 — Smoke test pre-lanzamiento.

Sin desviaciones del plan.
