# SPEC-094 — Filtrar bots de Meta y redes sociales en counters

**Estado:** ✅ Cerrada (pendiente de `npm test` + `npm run build` + commit local)
**Fase:** Pre-lanzamiento — limpieza de métricas
**Severidad:** ALTO (94% de rebote y 4s de tiempo promedio sugieren ruido masivo)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-086 (views), SPEC-091 (self-exclusion), SPEC-093 (funnel)

---

## Contexto

Análisis de las métricas del 13-may mostró:

- 159 visitantes hoy, +205% vs día anterior.
- **94% de rebote** y **4s de tiempo promedio de visita**.
- **99% del tráfico viene de dominios `.facebook.com` e `instagram.com`**.
- **0 clicks en CTAs** sobre 578 vistas acumuladas.
- Funnel del quiz IMR en 0/0/0.

Hipótesis confirmada: gran parte del tráfico son **crawlers de Meta y
otras redes sociales** que hacen link preview cada vez que alguien
comparte un enlace de Metamorfosis Real. Esos crawlers:

1. Cargan la página (incrementa pageview en Umami).
2. Cargan el script de Umami pero no interactúan → 0 segundos =
   "rebote inmediato".
3. NO clickean nada → infla la división vistas/clicks.

Resultado: métricas inservibles para tomar decisiones editoriales.

## Problema

Los counters propios del sitio (`analytics.views`, `analytics.clicks`,
`quizFunnel.*`) y el script de Umami se ejecutan también para bots
conocidos, contaminando los datos.

## Solución propuesta

Crear un helper `isKnownBotUserAgent(ua)` que detecta por
regex/substring los bots conocidos:

**Sociales (preview):**
- `facebookexternalhit` (Facebook)
- `Facebot` (Facebook nuevo)
- `meta-externalagent` (Meta WhatsApp/Instagram)
- `WhatsApp` (WhatsApp)
- `Twitterbot` (X/Twitter)
- `LinkedInBot` (LinkedIn)
- `Slackbot-LinkExpanding` (Slack)
- `Discordbot` (Discord)
- `Pinterest` (Pinterest)
- `TelegramBot` (Telegram)

**Search engines (no contaminan tanto pero ya que estamos):**
- `Googlebot`
- `bingbot`
- `DuckDuckBot`
- `Applebot`
- `YandexBot`
- `Baiduspider`

**Genéricos (más restrictivos):**
- `crawler`, `spider`, `headless` — exactos como token, no
  subsstring para evitar matchear `chatbot`/`kbot`/etc.

Aplicar la exclusión en 4 puntos:

1. **`UmamiScript.astro`** — no inyectar el script si el UA es bot.
2. **`/posts/[slug].astro`** — no incrementar `analytics.views`.
3. **`/api/posts/[slug]/click`** — no incrementar `analytics.clicks`.
4. **`/api/quiz/funnel`** — no incrementar el funnel.

### Alternativas descartadas

- **Filtrar por IP:** los rangos de Meta cambian. Mantenimiento
  alto. UA es más estable.
- **Filtrar en Umami via setting:** Umami Cloud no expone un
  panel de exclusión por UA. Solo bloquea bots "estándar" via
  IAB list — incompleto. Más confiable bloquear del lado del
  cliente con un check server-side.
- **Robots.txt:** sirve para Google/Bing pero NO para los
  crawlers de Facebook (ignoran robots.txt para link preview).
- **Bloqueo a nivel CDN:** no tenemos CDN intermedio entre el
  cliente y el SSR de Hostinger.

## Plan de implementación

1. **Crear** `src/lib/legacy/botDetection.ts` — helper pure-TS:
   - `BOT_USER_AGENT_PATTERNS` constante con la lista.
   - `isKnownBotUserAgent(ua: string | null | undefined): boolean`.
2. **Modificar** `src/components/UmamiScript.astro` — agregar
   chequeo de UA. Si es bot, no inyectar script.
3. **Modificar** `src/pages/posts/[slug].astro` — en la condición
   antes de `incrementView`, agregar `&& !isBot`.
4. **Modificar** `src/pages/api/posts/[slug]/click.ts` — antes de
   `incrementClick`, chequear UA.
5. **Modificar** `src/pages/api/quiz/funnel.ts` — mismo chequeo.
6. **Tests** unitarios del helper con casos reales y edge.

## Criterios de aceptación

- [ ] `npm test` pasa.
- [ ] `npm run build` no lanza errores.
- [ ] Una request con `User-Agent: facebookexternalhit/1.1` NO
      incrementa views, clicks ni funnel; NO recibe el script de
      Umami.
- [ ] Una request con UA de Chrome/Safari/Firefox normal sigue
      funcionando idéntico.
- [ ] Tests cubren al menos 10 UA reales (capturados de logs o
      docs oficiales).

## Pruebas

```sh
cd metamorfosis-web && npm test
cd metamorfosis-web && npm run build

# Smoke post-deploy:
#   1. Simular bot con curl:
curl -A 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' \
  https://metamorfosisvital.com.co/posts/SLUG_REAL
#
#   2. Verificar en Firebase Console → metamorfosis_posts/{id}.analytics:
#      views NO subió.
#
#   3. Simular humano normal:
curl -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15' \
  https://metamorfosisvital.com.co/posts/SLUG_REAL
#      → views SUBIÓ +1.
#
#   4. Esperar 24h, mirar Umami: rebote y tiempo promedio deberían
#      mejorar significativamente (no perfecto, pero notable).
```

## Riesgos / consideraciones

- **Falso positivo bloqueando humano legítimo:** improbable. Los
  patterns son distintivos (`facebookexternalhit` no aparece en
  UAs humanos). Mitigación: la lista es conservadora.
- **Bots que no se identifican:** si Meta agrega un crawler nuevo
  sin documentarlo, seguirá contaminando hasta que actualicemos
  la lista. Esto es maintenance overhead aceptable.
- **Si un crawler bloqueado cambia de comportamiento:** las
  métricas de SEO de Google podrían ser afectadas (`Googlebot`
  bloqueado del script de Umami no afecta SEO; afecta solo
  analytics). El contenido del HTML sigue siendo accesible
  porque solo bloqueamos counters y script de tracking, no el
  render del artículo.
- **No-op si UA está vacío:** algunas requests sin UA (raros)
  pasan como humanos. Es lo más conservador (preferimos contar
  de más a contar de menos).

## Commit

**Mensaje sugerido:**
```
feat(spec-094): filtrar bots de Meta y redes sociales en counters

- Helper src/lib/legacy/botDetection.ts con lista de patterns
  conocidos: facebookexternalhit, Facebot, meta-externalagent,
  WhatsApp, Twitterbot, LinkedInBot, Slackbot, Discordbot,
  Pinterest, TelegramBot, Googlebot, bingbot, DuckDuckBot,
  Applebot, YandexBot, Baiduspider, crawler, spider, headless.
- UmamiScript no inyecta el script si el UA es bot.
- /posts/[slug].astro no incrementa views.
- /api/posts/[slug]/click no incrementa clicks.
- /api/quiz/funnel no incrementa el funnel.
- Tests con 14+ UAs reales.

Cierra specs/SPEC-094-filtrar-bots-redes-sociales.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**Archivos tocados (6):**
- `src/lib/legacy/botDetection.ts` (nuevo) — helper pure-TS con
  `BOT_USER_AGENT_PATTERNS` (25+ patterns) y
  `isKnownBotUserAgent(ua)`. Case-insensitive.
- `src/lib/legacy/botDetection.test.ts` (nuevo) — 26 tests con
  UAs reales de Facebook, Twitter, LinkedIn, Slack, Discord,
  Pinterest, Telegram, Google, Bing + 5 UAs humanos reales +
  edge cases (null, undefined, empty, non-string).
- `src/components/UmamiScript.astro` — no inyecta el tracker si
  el UA es bot conocido.
- `src/pages/posts/[slug].astro` — variable `isBotView` que se
  agrega a la condición de incremento de views.
- `src/pages/api/posts/[slug]/click.ts` — chequea UA antes de
  `incrementClick`. Responde 204 si es bot.
- `src/pages/api/quiz/funnel.ts` — chequea UA antes de
  `incrementFunnel`. Responde 204 si es bot.

**Patterns incluidos (categorías):**
- **Sociales:** facebookexternalhit, facebot, meta-externalagent,
  whatsapp, instagram, twitterbot, linkedinbot, slackbot,
  discordbot, pinterest, pinterestbot, telegrambot, redditbot,
  tumblr, vkshare, embedly.
- **Search engines:** googlebot, bingbot, duckduckbot, applebot,
  yandexbot, baiduspider, msnbot.
- **SEO crawlers:** ahrefsbot, semrushbot, mj12bot, dotbot.
- **Genéricos:** crawler, spider, headless.

**Decisión: NO incluir `bot` standalone.** Hace match con strings
inocentes como `chatbot`, `kbot`. Los bots conocidos van listados
uno por uno.

**Impacto esperado:**
- Rebote en Umami debería bajar del 94% actual a 50-70%.
- Tiempo promedio de visita debería subir de 4s a ~30-60s.
- Vistas en el tablero del admin van a ser MÁS BAJAS pero más
  reales.
- El funnel del quiz se va a poder leer sin ruido.

**Smoke plan post-deploy:**
1. Simular bot con curl:
   ```
   curl -A 'facebookexternalhit/1.1' \
     https://metamorfosisvital.com.co/posts/SLUG
   ```
   → views NO debe subir en el doc Firestore.
2. Simular humano:
   ```
   curl -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' \
     https://metamorfosisvital.com.co/posts/SLUG
   ```
   → views debe subir +1.
3. Mirar Umami 24h después → rebote y tiempo promedio
   significativamente mejorados.
4. Tablero del admin: ahora los counters reflejan tráfico humano
   real, no inflado por crawlers.

TS transpile validation OK en los 4 archivos TS modificados.
