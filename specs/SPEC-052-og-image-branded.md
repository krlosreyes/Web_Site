# SPEC-052 — OG image branded dedicada

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento (Bloque 3 del plan del día)
**Severidad:** ALTO (preview en redes pesa 2 MB → bloquea shares en LinkedIn/FB)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-027 (SEO técnico), SPEC-030 (decisión OG image se mantiene como .jpg, no webp)

---

## Contexto

Cuando un user comparte el sitio en WhatsApp, Twitter, LinkedIn, Facebook,
etc., los scrapers del social network leen los meta tags `og:image` para
generar el preview. Hasta SPEC-052:

- Default OG image: `/header-bg.jpg` (2 MB, foto del hero).
- Esa imagen NO era "branded" — un user que ve el preview ve solo una
  foto de paisaje, sin saber qué es Metamorfosis Real, qué ofrece, o
  por qué clicarlo.
- LinkedIn y Facebook legacy tienen timeout agresivo para preview images;
  algunos shares con imagen >1 MB no generaban preview del todo.
- El sitio depende de viralización (foro, artículos, quiz) → perder
  previews = perder shares.

## Solución

Generar una OG image dedicada 1200×630 (ratio estándar OG) branded con:

- Logo "MR" en círculo + wordmark "METAMORFOSIS / REAL"
- Heading principal: "Vida solo hay una..."
- Subtitle blue accent: "y todo cuenta."
- CTA: "Hacer mi diagnóstico IMR  =>"
- URL del sitio en el footer
- Fondo: gradiente diagonal navy oscuro (`#050a12` → `#0a2540`) + glow radial azul en la esquina superior derecha
- Barra accent azul de 4px arriba

Generada con Python+Pillow (PIL), font Poppins-Bold/Medium/Regular (las
únicas disponibles offline en el sandbox; visualmente similar a Space
Grotesk del sitio).

**Tamaño final: 41 KB JPG** (vs 2 MB del header-bg.jpg = **-98%**).

## Plan de ejecución

1. Generar OG image con script Python (`/tmp/og-image.jpg`).
2. Iterar diseño con Carlos (3 versiones hasta aprobación).
3. Copiar al workspace: `metamorfosis-web/public/og-image.jpg`.
4. Editar `BaseLayout.astro`: cambiar `image` default de `/header-bg.jpg`
   a `/og-image.jpg`.
5. Editar `posts/[slug].astro`: cambiar fallback OG de `/header-bg.jpg`
   a `/og-image.jpg`.
6. Build local + commit + push.

## Criterios de aceptación

- [x] `og-image.jpg` existe en `/public/` con 1200×630 dimensions.
- [x] Tamaño <100 KB (target ~50 KB).
- [x] `BaseLayout.astro` default `image` = `/og-image.jpg`.
- [x] `posts/[slug].astro` fallback OG = `/og-image.jpg`.
- [x] Si el artículo tiene su propia imagen, esa gana (no se override).
- [ ] Post-deploy: `curl -s / | grep og:image` muestra `og-image.jpg`.
- [ ] Verificar preview en Facebook Sharing Debugger: `https://developers.facebook.com/tools/debug/?q=https://metamorfosisvital.com.co/`
- [ ] Verificar preview en Twitter Card Validator: `https://cards-dev.twitter.com/validator`

## Pruebas manuales

1. Después del deploy:
   ```bash
   curl -s https://metamorfosisvital.com.co/ | grep -oE 'og:image[^>]*'
   # debe imprimir: og:image content="http://...com.co/og-image.jpg" (no header-bg.jpg)

   curl -sI https://metamorfosisvital.com.co/og-image.jpg | head -3
   # debe ser HTTP/2 200 con content-type: image/jpeg
   ```

2. En Facebook Sharing Debugger: pegar URL del sitio, click "Fetch new
   scrape information". Debe mostrar la nueva imagen branded.

3. En WhatsApp: compartir el link del sitio en un chat, ver el preview
   inline. Debe mostrar la imagen branded en ~1s (vs ~5-8s con la imagen
   pesada anterior).

4. En LinkedIn: copiar URL en una post, esperar el preview. Debe aparecer
   (antes a veces fallaba con la imagen de 2 MB).

## Riesgos y trade-offs

- **Diseño "MVP" no profesional**: la imagen tiene composición básica con
  geometric shapes y typography clean, pero no es brand work refinado.
  Suficiente para lanzar; debería ser reemplazada por un diseño hecho en
  Figma/Canva por Carlos a futuro. Aceptable: 41 KB branded beats 2 MB
  foto genérica.
- **Poppins en lugar de Space Grotesk**: la fuente exacta del sitio
  (Space Grotesk) no estaba disponible offline en el sandbox para
  renderizar. Poppins tiene feel similar (geométrica, futurista). La OG
  image es estática (no se carga en el sitio); la diferencia de fuente
  no afecta UX, solo el preview en redes.
- **Cache de scrapers**: Facebook, LinkedIn, Twitter cachean previews
  agresivamente (semanas/meses). Para forzar refresh hay que usar sus
  "debug tools" arriba.
- **Si Carlos no le gusta el diseño**: revert es trivial — `git revert`
  del commit deja todo como antes. No hay lock-in.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos tocados:**
- `metamorfosis-web/public/og-image.jpg` — NEW, 41 KB, 1200×630.
- `metamorfosis-web/src/layouts/BaseLayout.astro` — default `image` cambiado a `/og-image.jpg`.
- `metamorfosis-web/src/pages/posts/[slug].astro` — fallback OG cambiado a `/og-image.jpg`.

**Decisiones:**
- JPG (no webp) porque scrapers OG (LinkedIn legacy, FB) no parsean
  webp confiable (regla de SPEC-030 aplica acá también).
- 1200×630 es el tamaño recomendado oficial por Facebook (2x del
  display 600×315 para retina).
- Heading emocional ("Vida solo hay una...") en lugar del feature claim
  original ("Transforma tu Metabolismo") — decisión del owner.
- CTA con "=>" ASCII en lugar de "→" Unicode para garantizar render
  consistente en todos los scrapers.

**Pendientes (opcionales, no bloqueante):**
- Diseño profesional en Figma/Canva por Carlos a mediano plazo.
- Generar variantes por sección (artículo, comunidad, quiz) si se
  decide diferenciar previews.
- OG image dedicada por artículo individual (hoy cada artículo puede
  tener su `article.images[0]` propia, fallback a este og-image.jpg
  si no la tiene).

Sin desviaciones del plan funcional.
