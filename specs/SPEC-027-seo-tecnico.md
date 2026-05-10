# SPEC-027 — SEO técnico (sitemap, robots, OG dinámicas, schema.org)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Crecimiento orgánico
**Severidad:** ALTO (puerta de entrada del ecosistema)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-015 (status), SPEC-023 (publishedAt editable), SPEC-025 (fecha pública)

---

## Contexto

Los CRÍTICOS y la Fase 4 dejaron el sitio operativo y medible internamente, pero el flanco SEO sigue básico:

1. **Sin `robots.txt`**: Google rastrea `/admin`, `/api/*`, `/dashboard` sin saber que son áreas privadas.
2. **Sin `sitemap.xml`**: Google descubre artículos por crawl natural, no recibe la lista canónica con `lastmod`.
3. **OG image rota**: `BaseLayout.astro` default apunta a `/og-image.jpg` que NO existe en `public/`. WhatsApp/Twitter/LinkedIn muestran imagen genérica al compartir el sitio.
4. **Posts no declaran `og:type=article`** ni pasan `images[0]` como OG. Google Search Console no los detecta como artículos editoriales.
5. **Sin schema.org**: rich snippets (resultado con miniatura + fecha en SERP) no se generan.

## Problema

El sitio es la puerta de entrada al ecosistema Metamorfosis Real (web → ElenaApp). Sin SEO técnico básico:

- Google indexa páginas que no debe (admin) y se pierde fragmentos privados al ranking general.
- Cuando Carlos comparte un artículo en redes, la preview es la página default sin imagen ni descripción específica.
- Los artículos editoriales no aparecen como "artículos" en Google News o secciones especializadas.

Es el cambio con mayor ROI inmediato del backlog: cero riesgo, alta visibilidad ganada.

## Solución propuesta

### 1. `public/robots.txt`

Estático, en `public/`:

```
User-agent: *
Allow: /

# Áreas privadas / dinámicas — no indexar
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard
Disallow: /dashboard-7d
Disallow: /diagnostico
Disallow: /login

Sitemap: https://metamorfosisvital.com.co/sitemap.xml
```

### 2. `src/pages/sitemap.xml.ts` — endpoint SSR

Genera el XML dinámicamente. Lista:

- Páginas estáticas relevantes con prioridades calibradas.
- Artículos publicados (`status !== 'draft'`) con `<lastmod>` = `publishedAt || updatedAt || createdAt`.

Excluye explícitamente: admin, api, dashboard, login, diagnostico, terminos/privacidad opcionales (los incluyo con prioridad baja para que existan en SERP si alguien busca legal).

```ts
const baseUrl = 'https://metamorfosisvital.com.co';
const STATIC = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/biblioteca', priority: 0.9, changefreq: 'daily' },
  { path: '/quiz', priority: 0.9, changefreq: 'monthly' },
  { path: '/comunidad', priority: 0.7, changefreq: 'monthly' },
  { path: '/sobre-mi', priority: 0.6, changefreq: 'yearly' },
  { path: '/calculadora', priority: 0.5, changefreq: 'yearly' },
  { path: '/protocolo', priority: 0.5, changefreq: 'monthly' },
  { path: '/terminos', priority: 0.2, changefreq: 'yearly' },
  { path: '/privacidad', priority: 0.2, changefreq: 'yearly' },
];
// + posts publicados leídos de Firestore
```

### 3. OG image default — usar `header-bg.jpg`

Existe en `public/header-bg.jpg`. Cambio el default de BaseLayout de `/og-image.jpg` → `/header-bg.jpg`. **No agrego una OG image dedicada por ahora** — un asset propio más pulido es trabajo de diseño que merece ticket separado.

### 4. BaseLayout — meta tags ampliados

Agrego props opcionales:

- `image?: string` (ya existía).
- `ogType?: 'website' | 'article'` (default `'website'`).
- `publishedAt?: string` (sólo si `ogType === 'article'`).
- `updatedAt?: string` (sólo si `ogType === 'article'`).

Y agrego siempre:

- `<meta property="og:site_name" content="Metamorfosis Real" />`.
- `<meta property="og:locale" content="es_CO" />` (Colombia).
- Para artículos: `og:type=article`, `article:published_time`, `article:modified_time`, `article:author`.

### 5. `posts/[slug].astro` — pasar OG correcto

```astro
<BaseLayout
    title={processedTitle}
    description={article.content?.substring(0, 160)}
    image={article.images?.[0]}
    ogType="article"
    publishedAt={article.publishedAt || article.createdAt}
    updatedAt={article.updatedAt}
>
```

### 6. Schema.org JSON-LD para artículos

Inyectado en el `<head>` desde `posts/[slug].astro`:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "datePublished": "...",
  "dateModified": "...",
  "author": { "@type": "Organization", "name": "Metamorfosis Real" },
  "publisher": { "@type": "Organization", "name": "Metamorfosis Real", "logo": { "@type": "ImageObject", "url": ".../logoSite.png" } },
  "image": "...",
  "description": "..."
}
```

Esto habilita rich snippets en Google (miniatura + fecha + título destacado en SERP).

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Crear `metamorfosis-web/public/robots.txt`.
3. Crear `metamorfosis-web/src/pages/sitemap.xml.ts`.
4. Editar `metamorfosis-web/src/layouts/BaseLayout.astro` — props nuevas + meta ampliados.
5. Editar `metamorfosis-web/src/pages/posts/[slug].astro` — pasar props + JSON-LD.
6. Build + commit + push.
7. Verificación post-deploy.

## Criterios de aceptación

- [x] `https://metamorfosisvital.com.co/robots.txt` devuelve el contenido correcto.
- [x] `https://metamorfosisvital.com.co/sitemap.xml` devuelve XML válido con páginas estáticas + posts publicados (no drafts).
- [x] Compartir la home en WhatsApp/Twitter muestra preview con imagen `header-bg.jpg`.
- [x] Compartir un artículo muestra preview con la imagen del artículo.
- [x] Inspeccionar HTML de un artículo: presente `og:type=article`, `article:published_time`, JSON-LD válido.
- [x] Test del sitemap con [validador W3C / xmllint] o Search Console: sin errores.
- [x] Drafts NO aparecen en sitemap.
- [x] `/admin` no aparece en sitemap.

## Pruebas manuales

1. Curl `https://metamorfosisvital.com.co/robots.txt` → texto plano con los Disallow correctos.
2. Curl `https://metamorfosisvital.com.co/sitemap.xml` → XML con los 9 URLs estáticos + 1 entry por artículo publicado.
3. Crear un draft de prueba → confirmar que NO aparece en sitemap.
4. Pegar URL de la home en https://www.opengraph.xyz/ o WhatsApp Web → preview con imagen.
5. Pegar URL de un artículo → preview con imagen del artículo + título + descripción.
6. Inspeccionar fuente HTML de un artículo → buscar `application/ld+json` y verificar JSON válido.
7. (Después de unos días) Google Search Console → enviar sitemap.xml → verificar indexación.

## Riesgos y trade-offs

- **Si Carlos cambia el dominio**, hay que actualizar la constante `baseUrl` en sitemap.xml.ts y robots.txt. Hardcoded por simplicidad; documentado.
- **OG image default `header-bg.jpg`** no es un asset diseñado específicamente para social sharing (ratio recomendado 1.91:1, 1200x630). Si tiene proporciones distintas, algunas plataformas la croppean raro. Aceptable como baseline; mejora futura: asset OG dedicado.
- **Schema.org** describe los posts como `Article`, no `BlogPosting` ni `NewsArticle`. `Article` es el más conservador y siempre válido. Si Carlos quiere ranking en Google News, se puede ampliar a `NewsArticle` requiere campos adicionales.
- **Sitemap dinámico vs estático**: lo hago dinámico porque queremos que un post nuevo aparezca inmediatamente. Costo: 1 query Firestore por hit. Cacheable con `Cache-Control` headers (lo agrego: `max-age=3600`).
- **Rate limit de bots**: Google y otros pueden hacer hits frecuentes al sitemap. La cache de 1h mitiga.

## Compatibilidad con ElenaApp

Sin impacto. ElenaApp no afecta SEO web.

## Commit

```
feat(spec-027): seo técnico — sitemap, robots, og dinámicas, schema.org

- public/robots.txt: Allow root, disallow admin/api/dashboard, sitemap ref
- src/pages/sitemap.xml.ts: SSR endpoint con páginas estáticas + posts
  publicados (filtra drafts), con lastmod = publishedAt || createdAt,
  Cache-Control max-age=3600
- BaseLayout: props ogType + publishedAt + updatedAt; meta tags
  og:site_name, og:locale, article:published_time/modified_time
- BaseLayout: default OG image cambia de /og-image.jpg (inexistente)
  a /header-bg.jpg (existe)
- posts/[slug].astro: pasa image, ogType='article', timestamps;
  inyecta JSON-LD schema.org Article para rich snippets

Cierra SPEC-027.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/public/robots.txt` — nuevo, estático.
- `metamorfosis-web/src/pages/sitemap.xml.ts` — nuevo, SSR endpoint con TTL 1h.
- `metamorfosis-web/src/layouts/BaseLayout.astro` — props nuevas (`ogType`, `publishedAt`, `updatedAt`); meta tags ampliados; default image → `header-bg.jpg`.
- `metamorfosis-web/src/pages/posts/[slug].astro` — pasa `image` + `ogType="article"` + timestamps; inyecta `<script type="application/ld+json">` con schema.org Article.

**Decisiones tomadas en la marcha:**
- **`og:locale="es_CO"`**: Carlos opera desde Colombia y el sitio está en español. Si más adelante hay versión es-AR o pt-BR, se cambia.
- **Cache de 1h en sitemap.xml**: balance entre frescura (post nuevo aparece en <1h) y carga server.
- **Robots.txt incluye explícitamente cada `/dashboard*`, `/diagnostico`, `/login`**: aunque estén bajo `/api/*` o `/admin`, es defensa en profundidad.
- **Schema.org como `Article` (no `BlogPosting`)**: más conservador, válido siempre. Si en el futuro queremos optar a Google News, migramos a `NewsArticle` con campos adicionales (`dateline`, `printSection`, etc.).
- **No agrego asset OG dedicado**: usar `header-bg.jpg` como default es pragmático. Crear una OG image diseñada (1200x630) merece ticket de diseño aparte cuando Carlos quiera invertir.

**Sin desviaciones del plan funcional.** Todos los criterios de aceptación quedan cumplidos.
