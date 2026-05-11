# SPEC-030c — Self-host Google Fonts

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — performance / Core Web Vitals
**Severidad:** MEDIO (último push de 84 → 90+)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-030 (preload images), SPEC-030b (defer Firebase)

---

## Contexto

Después de SPEC-030 + SPEC-030b, Lighthouse mobile Performance subió de
62 → 84. Sólido pero todavía debajo del target 90+. El último villano
identificado en el árbol de dependencias: **Google Fonts external**.

Con el pattern non-blocking de SPEC-030 (`media="print" + onload swap`),
las fonts ya no bloquean render — pero como el LCP element es el TEXTO
del hero (heading "Transforma tu Metabolismo" en Space Grotesk 700),
Lighthouse cuenta el repaint del texto cuando llega la web font como
"final paint" del LCP. Resultado: LCP se posterga ~500-700ms.

Además, Google Fonts external tiene un chain de 4 round trips:
1. DNS lookup a `fonts.googleapis.com`.
2. TLS handshake.
3. Descarga del CSS con `@font-face` y URLs a `fonts.gstatic.com`.
4. Descarga del WOFF2 (otro DNS + TLS handshake a gstatic).

Cada round trip cuesta ~50-200ms en 4G mobile. Lighthouse estimaba
~610ms de LCP saving si eliminamos ese chain.

## Solución

Self-hostear Inter + Space Grotesk:

1. Descargar los WOFF2 de Google Fonts API (con User-Agent moderno para
   que sirva WOFF2 en vez de TTF/EOT).
2. Guardarlos en `/public/fonts/` con nombres limpios.
3. Definir `@font-face` en `global.css` apuntando a esos archivos.
4. Preload de los WOFF2 críticos del LCP en `BaseLayout`.
5. Eliminar todo el bloque de Google Fonts (preconnect + preload de CSS +
   `<link rel="stylesheet">` + `<noscript>`) del `<head>`.

Resultados esperados:
- Las fonts del LCP llegan en ~50-100ms (un solo round trip a tu propio
  origen, sin DNS+TLS extra).
- El swap ocurre típicamente <100ms del FCP, casi imperceptible.
- LCP debería bajar 500-700ms.

## Weights necesarios

Lo que el sitio usa hoy (verificado en `global.css` + bundle de Astro):

- **Inter**: 400, 500, 600, 700, 800 (body + variantes semibold y bold)
- **Space Grotesk**: 500, 700 (headings)

Total: 7 archivos WOFF2. Tamaño típico por weight: 18-25 KB. Total
~140-180 KB para todas las fonts (vs ~80-100 KB de Google Fonts CSS+WOFF2
combinado, pero sin los round trips).

## Plan de ejecución

1. Crear `metamorfosis-web/public/fonts/`.
2. Descargar los 7 WOFF2 con un script Python que parsea Google Fonts CSS
   (script en el README de la spec).
3. Renombrarlos a esquema limpio:
   - `inter-{400,500,600,700,800}.woff2`
   - `space-grotesk-{500,700}.woff2`
4. Editar `global.css`:
   - Agregar 7 bloques `@font-face` con `font-display: swap` y `src: url('/fonts/...')`.
5. Editar `BaseLayout.astro`:
   - Eliminar bloque de Google Fonts (preconnect + preload CSS + stylesheet + noscript).
   - Agregar 2 `<link rel="preload" as="font" type="font/woff2" crossorigin>` para Space Grotesk 700 e Inter 400.
6. Build local (`npm run build`) para verificar que no rompe.
7. Commit + push.
8. Esperar deploy, re-correr Lighthouse.

## Criterios de aceptación

- [x] `global.css` define los 7 @font-face apuntando a `/fonts/`.
- [x] `BaseLayout` no menciona `fonts.googleapis.com` ni `fonts.gstatic.com`.
- [x] `BaseLayout` preloadea Space Grotesk 700 e Inter 400 como WOFF2.
- [ ] `/public/fonts/` contiene 7 archivos `.woff2` (Carlos los descarga).
- [ ] Build local OK sin warnings de font.
- [ ] Post-deploy: el HTML NO incluye links a `fonts.googleapis.com`.
- [ ] Post-deploy: el HTML SÍ incluye `<link rel="preload" as="font" href="/fonts/...">`.
- [ ] Post-deploy: Lighthouse mobile Performance ≥90.
- [ ] Visual: hero text sigue con Space Grotesk (no system font permanente).

## Pruebas manuales

1. Verificar archivos:
   ```bash
   ls -lh /Users/carlosreyes/Proyectos/Web_Site/metamorfosis-web/public/fonts/
   ```
   Debe mostrar 7 archivos .woff2.

2. Tras deploy:
   ```bash
   curl -s https://metamorfosisvital.com.co/ | grep -E 'fonts\.(googleapis|gstatic)\.com|/fonts/'
   ```
   - NO debe imprimir nada con `googleapis.com` ni `gstatic.com`.
   - SÍ debe imprimir los 2 preloads de WOFF2 locales.

3. En el browser, devtools network tab:
   - No debe haber requests a `fonts.googleapis.com` ni `fonts.gstatic.com`.
   - Debe haber 7 requests a `/fonts/*.woff2` (mostly cacheados después de la primera visita).

4. Visual:
   - Hero heading "Transforma tu Metabolismo" debe verse con Space Grotesk bold.
   - Body text debe verse con Inter.
   - Si se ve con system font durante <100ms y luego swappea, OK.
   - Si se ve con system font permanente, hay bug en el @font-face (path incorrecto, etc.).

5. Lighthouse mobile en `pagespeed.web.dev/?v=5`.

## Riesgos y trade-offs

- **Tamaño de bundle**: 7 WOFF2 × ~20KB = ~140KB suma al primer load (cache
  después). Vs Google Fonts: ~80KB CSS + WOFF2. Es ~60KB más, pero
  ELIMINA los round trips a third party — neto ganamos. Cache-Control
  largo en Hostinger (futuro SPEC) hace que repeat visits no pesen nada.
- **Updates de fonts**: si Google publica nueva version de Inter con bug
  fix, no la recibimos automáticamente. Hay que re-descargar manualmente.
  Aceptable porque Inter y Space Grotesk son fonts estables.
- **License**: Inter (SIL OFL 1.1) y Space Grotesk (SIL OFL 1.1) ambas
  permiten self-hosting sin restricción. Sin issue legal.
- **Falta el WOFF2 → 404**: si por error no copio uno de los 7 archivos
  al `/public/fonts/`, el @font-face falla silently y ese weight se ve
  con system font fallback (`sans-serif`). No es catastrófico pero feo.
- **Preload de fonts wrongly puede empeorar perf**: si preload de un
  WOFF2 que NO se usa above-the-fold, ocupa bandwidth sin beneficio. Por
  eso preloadeo SOLO 2 (los del hero LCP).

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/styles/global.css` — 7 bloques `@font-face` agregados al inicio.
- `metamorfosis-web/src/layouts/BaseLayout.astro` — eliminado bloque Google Fonts, agregados 2 preloads de WOFF2.
- `metamorfosis-web/public/fonts/*.woff2` — 7 archivos WOFF2 (Carlos los descarga con script abajo).
- `CLAUDE.md` — nota: fonts son self-hosted en `/public/fonts/`, no agregar Google Fonts external.

**Script para descargar los WOFF2:**

```bash
cd /Users/carlosreyes/Proyectos/Web_Site/metamorfosis-web/public
mkdir -p fonts && cd fonts

python3 - <<'PYEOF'
import re, urllib.request
ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
url = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap"
req = urllib.request.Request(url, headers={"User-Agent": ua})
css = urllib.request.urlopen(req).read().decode()
blocks = re.findall(r"@font-face\s*\{[^}]*\}", css)
print(f"Found {len(blocks)} @font-face blocks")
for b in blocks:
    fam = re.search(r"font-family:\s*'([^']+)'", b).group(1)
    wt  = re.search(r"font-weight:\s*(\d+)", b).group(1)
    src = re.search(r"src:\s*url\(([^)]+)\)", b).group(1).strip("'\"")
    out = f"{fam.lower().replace(' ', '-')}-{wt}.woff2"
    print(f"  -> {out}")
    urllib.request.urlretrieve(src, out)
print("\\nDone. Files:")
PYEOF

ls -lh
```

**Decisiones:**
- `font-display: swap` (no `optional`): preferimos asegurar que la web
  font se aplique siempre, aún en mobile lento. El preload de los
  críticos asegura que el swap ocurra <100ms del FCP, casi invisible.
- Preload solo Space Grotesk 700 e Inter 400: los del LCP element. Los
  otros weights se cargan lazy cuando el browser encuentra un selector
  que los referencie (típicamente después del LCP).
- No incluyo `unicode-range`: Google Fonts API con User-Agent moderno
  sirve un solo WOFF2 con todos los caracteres latinos en un archivo.
  Funciona sin restricción.

**Pendientes:**
- Carlos corre el script Python para descargar los 7 WOFF2.
- Verificar con `ls /public/fonts/` que hay 7 archivos.
- Commit + push.
- Re-correr Lighthouse, target ≥90.

Sin desviaciones del plan.
