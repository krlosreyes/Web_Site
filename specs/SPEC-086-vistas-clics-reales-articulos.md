# SPEC-086 — Vistas y clics reales en artículos del admin

**Estado:** ✅ Cerrada (pendiente de `npm run build` + commit local)
**Fase:** Pre-lanzamiento — herramientas operativas del admin
**Severidad:** ALTO (las decisiones editoriales se están tomando con data falsa)
**Fecha de creación:** 2026-05-12
**Autor:** Carlos Reyes
**Depende de:** SPEC-056 (pattern atómico de counter), SPEC-005 (schema Firestore)

---

## Contexto

En el panel admin (`/admin/dashboard` → tab Posts) cada artículo muestra
"Vistas: NNNN" y "Clics: NNN". Al revisar el código:

```ts
// src/pages/api/admin/posts.ts:52-65
const mockViews = Math.floor(Math.random() * 5000) + 500;
const mockClicks = Math.floor(mockViews * (Math.random() * 0.3 + 0.1));
const mockConversions = Math.floor(mockClicks * (Math.random() * 0.1 + 0.02));

return {
    ...
    views: data.analytics?.views || mockViews,
    clicks: data.analytics?.clicks || mockClicks,
};
```

Los números son **aleatorios y cambian en cada request**, no reflejan
tráfico real. Esto invalida cualquier decisión editorial basada en
"qué artículo está funcionando".

## Problema

El admin muestra métricas inventadas. Necesitamos contadores reales,
pegados a la realidad del tráfico del sitio.

## Solución propuesta

Implementar contadores propios en Firestore en el doc de cada artículo
bajo `analytics: { views, clicks }`. Incrementarlos en dos puntos:

1. **`analytics.views`** — incremento atómico server-side cada vez que
   se renderiza `/posts/[slug]`, con dedupe por cookie de sesión y
   exclusión del propio admin.
2. **`analytics.clicks`** — incremento atómico via endpoint dedicado
   `/api/posts/[slug]/click` invocado con `navigator.sendBeacon()` al
   clickear los CTAs principales del artículo (Iniciar diagnóstico IMR
   y Entrar a la comunidad).

Quitar los mocks aleatorios del endpoint admin y devolver el valor
real (o 0 si no existe el campo).

### Alternativas descartadas

- **Pull desde Umami API:** considerado. Umami ya mide pageviews por
  URL y los eventos de click (SPEC-084). Razones para no usarlo ahora:
  (a) requiere API key + setup adicional; (b) agrega latencia al admin
  cuando carga lista de posts (fetch a Umami por cada slug);
  (c) Umami filtra parcialmente bots pero no Facebook crawlers; (d) si
  Umami queda offline o el sitio cambia de analytics, el admin queda
  sin métricas. La opción de Firestore es self-contained y simple.
  **Reconsiderar Opción C cuando el sitio supere 10k pageviews/mes** y
  los counters de Firestore se vuelvan caros, o cuando queramos
  reportes más ricos (bounce per article, source, etc.).
- **Contar clics en cada link interno del artículo:** sobre-tracking
  innecesario para la fase actual. Empezamos con los dos CTAs
  primarios y, si la data justifica, ampliamos.
- **`navigator.sendBeacon` vs `fetch` + `preventDefault`:** sendBeacon
  está diseñado exactamente para este caso (envío reliable durante
  navegación), no requiere preventDefault del `<a>`, no agrega latencia
  perceptible al click, y el browser garantiza entrega. Fetch tiene
  riesgo de cancelación durante navigate.

### Dedupe y exclusión del admin

- **Cookie de sesión `viewed_posts`** (HttpOnly, Secure, SameSite=Lax,
  Path=/, sin expiración explícita — vive lo que dura la sesión del
  browser). Contiene un array CSV de slugs vistos. Si el slug ya está,
  no se incrementa.
- **Cookie `admin_session` presente y válida** → no incrementar nunca,
  no contar visitas internas del propio Carlos.
- Defensive: la operación de increment NUNCA debe romper el render del
  artículo. Si falla la transacción, se logueo y se sigue.

## Plan de implementación

1. **Crear** `metamorfosis-web/src/lib/postAnalytics.ts` —
   `incrementView(slug)` e `incrementClick(slug)`. Usan
   `FieldValue.increment(1)` sobre `metamorfosis_posts/{docId}` ubicando
   el doc por `where('slug', '==', slug).limit(1)`. Wrap en try/catch
   que loguea y no propaga.
2. **Modificar** `src/pages/posts/[slug].astro` — después del fetch
   exitoso del artículo (y antes del render), llamar
   `incrementView(slug)` async sin esperar, aplicando dedupe por
   cookie `viewed_posts` y exclusión por `admin_session`. Set-Cookie
   de `viewed_posts` actualizada con el slug nuevo.
3. **Crear** `src/pages/api/posts/[slug]/click.ts` — endpoint POST
   que llama `incrementClick(slug)`. Acepta `keepalive` requests de
   `sendBeacon`. Responde 204 No Content.
4. **Modificar** `src/pages/posts/[slug].astro` — agregar `<script>`
   inline que delega clicks en los CTAs principales
   ("Iniciar diagnóstico IMR" y "Entrar a la comunidad") al
   `navigator.sendBeacon('/api/posts/{slug}/click')` antes de
   permitir la navegación.
5. **Modificar** `src/pages/api/admin/posts.ts` — quitar los
   `mockViews/mockClicks/mockConversions`. Retornar
   `views: data.analytics?.views ?? 0` (cero, no random).
6. **Modificar** `src/components/admin/PostList.tsx` — si
   `views === 0` y `clicks === 0` mostrar `—` en lugar de "Vistas: 0".

## Criterios de aceptación

- [ ] `npm run build` no lanza errores.
- [ ] Al cargar el admin, los números de vistas y clics NO cambian
      entre refresh consecutivos (no son random).
- [ ] Visitar `/posts/{slug}` desde un browser anónimo incrementa
      `analytics.views` en Firestore exactamente +1 (no +2, no +0).
- [ ] Refrescar la misma URL en la misma sesión NO incrementa de nuevo
      (dedupe funciona).
- [ ] Visitar el mismo slug logueado como admin NO incrementa
      (exclusión funciona).
- [ ] Clickear el CTA "Iniciar diagnóstico IMR" o "Entrar a la
      comunidad" del artículo incrementa `analytics.clicks` en +1.
- [ ] El admin muestra `—` para artículos legacy sin views ni clicks
      en lugar de "0".

## Pruebas

```sh
cd metamorfosis-web && npm run build

# Smoke post-deploy:
#  1. Logueate como admin, abrí /admin/dashboard → tab Posts.
#     Anotá los números de vistas/clics actuales (deberían ser 0/0
#     o el valor real ya acumulado).
#  2. Abrí cualquier post en pestaña incógnita. Refrescá el admin →
#     vistas sube exactamente +1 para ese slug.
#  3. Recargá el post en la misma pestaña incógnita 5 veces. Refrescá
#     el admin → vistas NO sube (sigue +1, no +6).
#  4. Cerrá la incógnita, abrí nueva incógnita, mismo post. Vistas
#     sube +1 más (sesión nueva).
#  5. Como admin (con admin_session activa), entrá al post.
#     Vistas NO sube.
#  6. En el post, clickeá "Iniciar diagnóstico IMR" → clics sube +1.
```

## Riesgos / consideraciones

- **Carga adicional sobre Firestore:** cada pageview genera 1 write
  + 1 read (para localizar el doc por slug). Hostinger plan Business +
  Firestore Spark/Blaze deberían absorberlo holgadamente hasta
  ~100k pageviews/mes. Si crecemos, migrar a Umami API (alternativa
  descartada de arriba).
- **Cookie `viewed_posts` puede crecer mucho:** si un user en una
  sesión larga visita 200 artículos, la cookie tiene 200 slugs.
  Mitigación: cap a últimos 50 slugs vía rotación. Por ahora no es
  problema (tenemos ~15 artículos).
- **Bots que ignoren cookies pero no User-Agent:** seguirán contando
  como vistas. Aceptable para este MVP. La defensa real es bloquear
  bots conocidos (relacionado a SPEC pendiente sobre filtrar bots de
  Umami / mismo concepto).
- **`sendBeacon` y CSRF de Astro 6:** el endpoint `/api/posts/.../click`
  debe aceptar `Content-Type: application/json` o `text/plain`.
  Verificar con `fetch` también porque sendBeacon en algunos browsers
  manda `Content-Type` distinto.

## Commit

**Mensaje sugerido:**
```
feat(spec-086): vistas y clics reales en artículos del admin

- Quitar mocks aleatorios de /api/admin/posts (devolver el valor
  real o 0).
- Helper src/lib/postAnalytics.ts (FieldValue.increment idempotente).
- /posts/[slug].astro incrementa views con dedupe por cookie de
  sesión y exclusión del propio admin.
- Endpoint POST /api/posts/[slug]/click acepta sendBeacon para
  contar clicks en CTAs principales del artículo.
- PostList del admin muestra "—" cuando no hay data acumulada.

Cierra specs/SPEC-086-vistas-clics-reales-articulos.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-12).

**Archivos tocados (5):**
- `src/lib/postAnalytics.ts` (nuevo) — helpers `incrementView(slug)` e
  `incrementClick(slug)` con `FieldValue.increment(1)`, ambos
  best-effort (try/catch + log; nunca propagan).
- `src/pages/posts/[slug].astro` — incremento de view con dedupe por
  cookie de sesión `viewed_posts` (HttpOnly, sin maxAge, cap a 50
  slugs por rotación) y exclusión vía cookie `admin_session`. Inline
  script delega clicks en `[data-track-click="article-cta"]` a
  `navigator.sendBeacon('/api/posts/{slug}/click')` con blob de
  `application/json` vacío para pasar el filtro CSRF de Astro 6.
- `src/pages/api/posts/[slug]/click.ts` (nuevo) — endpoint POST 204
  que invoca `incrementClick`. Defensa: nunca lanza, siempre 204.
- `src/pages/api/admin/posts.ts` — eliminados los `mockViews`,
  `mockClicks` y `mockConversions` con `Math.random()`. Ahora retorna
  el valor real de `analytics.views/clicks/conversions` o 0.
- `src/components/admin/PostList.tsx` — muestra `—` cuando
  `views === 0 && clicks === 0` para diferenciar "sin tráfico aún" de
  "tráfico con 0 clics".

**Decisiones de implementación:**
- **Increment fire-and-forget en el frontmatter del .astro:** el page
  render NO espera la transacción de Firestore. Si Firestore tarda
  o falla, el HTML del artículo sale igual. Único trade-off: hay
  riesgo teórico de que el process termine antes de que la op llegue
  a Firestore. En Astro SSR sobre Node con keep-alive es muy
  improbable; aceptable para tracking best-effort.
- **Cookie de sesión vs IP+día:** elegimos cookie por simplicidad
  (cero infra), aceptando que un usuario que limpia cookies cuenta
  como visita nueva. Bots que ignoran cookies seguirán contando —
  defensa futura es bloquear bot user-agents (relacionado al tema
  pendiente de filtrar Facebook crawler).
- **`navigator.sendBeacon` vs `fetch` con `keepalive`:** sendBeacon
  está diseñado exactamente para tracking durante navigate y tiene
  mejor compatibilidad cross-browser. Fetch + keepalive funciona
  pero requiere preventDefault del `<a>` y reintroducir navigate
  manualmente, lo cual rompe modificadores (Cmd+Click → nueva tab).
- **No incrementamos vistas del propio Carlos:** chequeamos
  `admin_session` valid antes de incrementar. Crucial para que las
  visitas internas de revisión editorial no inflen las métricas.
- TS transpile validation OK en los 4 archivos TS/TSX.
- `npm run build` debe correr local (sandbox Linux ARM64 no puede
  compilar Rollup macOS).

**Smoke plan post-deploy:**
1. Abrir admin → tab Posts. Anotar todos los valores actuales.
2. Refrescar admin varias veces → los números NO cambian (confirma
   que los mocks aleatorios están muertos).
3. Abrir un post en pestaña incógnita → admin muestra +1 vista.
4. Recargar mismo post mismo incógnita 5 veces → admin sigue +1.
5. Cerrar incógnita, abrir nueva, mismo post → admin sumá otro +1.
6. Como admin logueado, entrar al post → admin NO suma.
7. Como anónimo, clickear "Iniciar diagnóstico IMR" en el post →
   admin suma +1 clic.
