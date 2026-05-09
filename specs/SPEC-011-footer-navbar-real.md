# SPEC-011 — Footer y Navbar reales

**Estado:** ✅ Cerrada
**Fase:** 3
**Severidad:** MEDIO (UX visible)
**Fecha de creación:** 2026-05-09
**Cerrada:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** ninguna

---

## Contexto

Tras el cierre de Fase 2 quedan varios placeholders cosméticos en Footer y Navbar que se ven todos los días:

- **Footer redes sociales** apuntan a homepages genéricas: `https://youtube.com`, `https://facebook.com`, `https://instagram.com`, `https://tiktok.com`. Cuando un visitante hace click cae en la home de cada plataforma, no en el canal/perfil de Metamorfosis Real.
- **Footer link "Artículos"** apunta a `/posts` que no existe (la lista vive en `/biblioteca`). 404.
- **Footer ícono de TikTok** es un path SVG aleatorio (no es el logo de TikTok real).
- **Navbar link "Abrir App"** → `https://elena-app.vercel.app/` con `target="_blank"` ya tiene `rel="noopener noreferrer"` (agregado en SPEC-003 fix).
- **Footer redes externas** sin `rel="noopener noreferrer"` consistente.
- **Decisión:** Carlos confirmó que las redes activas son **YouTube + Instagram + TikTok** (sin Facebook). Eliminar el ícono y link de Facebook.

## Problema

Footer y Navbar muestran links y placeholders que confunden o llevan a 404 — perjudican credibilidad de un sitio que se vende como "alta autoridad".

## Solución propuesta

1. Reemplazar las 3 URLs de redes por las reales de Metamorfosis Real (YouTube, Instagram, TikTok).
2. Eliminar el bloque de Facebook (no usado).
3. Reemplazar el `path d=...` SVG aleatorio del icono TikTok por el SVG oficial.
4. Cambiar `/posts` → `/biblioteca` en el Footer.
5. Asegurar `rel="noopener noreferrer"` en TODOS los `target="_blank"` (Footer y Navbar).

## Plan de implementación

### Footer.astro

- Reemplazar el `import { Facebook, Instagram, Youtube } from "lucide-astro"` para quitar `Facebook`.
- Eliminar el bloque `<a href="https://facebook.com" ...>` con su `Facebook size={...}` icon.
- Reemplazar las URLs:
  - YouTube: `<URL_YOUTUBE>`
  - Instagram: `<URL_INSTAGRAM>`
  - TikTok: `<URL_TIKTOK>`
- Reemplazar el `<svg>` inline de TikTok con un path oficial.
- Cambiar `<a href="/posts">Artículos</a>` → `<a href="/biblioteca">Artículos</a>`.
- Asegurar `rel="noopener noreferrer"` en cada `target="_blank"` de redes.

### Navbar.astro

- El link "Abrir App" ya tiene `rel="noopener noreferrer"` desde SPEC-003 fix. Verificar grep.

## Criterios de aceptación

- [ ] `grep "https://youtube.com" metamorfosis-web/src` no devuelve nada (genérico reemplazado por URL real).
- [ ] `grep "https://facebook.com" metamorfosis-web/src` no devuelve nada (Facebook eliminado).
- [ ] `grep 'href="/posts"' metamorfosis-web/src` no devuelve nada (link 404 corregido).
- [ ] `grep 'target="_blank"' metamorfosis-web/src/components/Footer.astro` siempre va acompañado de `rel="noopener noreferrer"` en la misma o siguiente línea.
- [ ] El SVG de TikTok renderiza el icono oficial (visualmente reconocible).
- [ ] Click en cada red lleva al canal/perfil real de Metamorfosis Real.

## Pruebas

```sh
# Verificación grep
grep -rn 'youtube.com"\|facebook.com"\|instagram.com"\|tiktok.com"' metamorfosis-web/src
# Solo deberían aparecer las URLs ESPECÍFICAS, no las homes genéricas.

grep -rn 'href="/posts"' metamorfosis-web/src
# Vacío.

grep -rn 'target="_blank"' metamorfosis-web/src
# Cada match debe tener rel="noopener noreferrer" cerca.
```

Visual:
- Abrir el sitio en producción → scroll al footer → click cada red → confirmar que abre el perfil/canal real.
- Click "Artículos" en footer → debe ir a `/biblioteca`, no 404.

## Riesgos / consideraciones

- **Si Carlos cambia las redes en el futuro**, hay que editar 3 strings en `Footer.astro`. Aceptable; no vale extraer a config por ahora.
- **TikTok es opcional** — si no tienen TikTok activo, lo eliminamos junto con Facebook.

## Commit

```
fix(spec-011): footer real — redes activas + link /posts corregido

- Eliminado Facebook (no usado por Metamorfosis Real)
- URLs reales de YouTube, Instagram, TikTok
- Ícono TikTok con SVG oficial (antes path aleatorio)
- /posts → /biblioteca (link era 404)
- rel="noopener noreferrer" consistente en target="_blank"

Cierra specs/SPEC-011-footer-navbar-real.md
```

---

## Resultado

Implementada el 2026-05-09. Carlos confirmó las 3 URLs reales.

**Cambios en `Footer.astro`:**

- Constante `SOCIAL_LINKS` arriba del frontmatter para centralizar las URLs:
  ```ts
  const SOCIAL_LINKS = {
    youtube:   "https://www.youtube.com/@Metamorfosisreal",
    instagram: "https://www.instagram.com/metamorfosisreal",
    tiktok:    "https://www.tiktok.com/@metamorfosisreal",
  } as const;
  ```
  Si en el futuro Carlos agrega o cambia una red, edita solo este bloque.

- **Eliminado Facebook**: ya no aparece en imports (`import { Instagram, Youtube } from "lucide-astro"` sin `Facebook`) ni en el HTML.

- **Ícono TikTok oficial**: el SVG anterior tenía un `path d="M9 12 a4 4 0 1 0 4 4..."` que no era el logo de TikTok. Reemplazado con el path canónico del logo oficial.

- **`/posts` → `/biblioteca`** en el link "Artículos" del bloque Navegación. Era 404.

- **`aria-label`** agregado a cada link de red para accesibilidad.

- **`rel="noopener noreferrer"`** ya estaba en los 3 `target="_blank"` (preservado).

**Verificación grep (post-cambio):**

```sh
grep -rn 'https://youtube\.com"\|https://facebook\.com\|https://instagram\.com"\|https://tiktok\.com"' metamorfosis-web/src
# Vacío — ya no hay URLs genéricas placeholder.

grep -rn 'href="/posts"' metamorfosis-web/src
# Vacío — el link a /biblioteca reemplazó al /posts 404.
```

**Aprendizajes:**

- **Centralizar URLs en una constante** desde el primer commit ahorra grep + edit múltiples cuando cambian. Vale para redes, dominios externos, etc.
- **`as const` en TypeScript** preserva los tipos literales y previene mutación accidental.
- **Iconos de marcas (TikTok, X, etc.)** suelen ser propietarios — usar el SVG oficial de la guía de marca o de iconos open-source actualizados (lucide-astro no tenía TikTok al momento de este commit).

**Pendientes que se mueven a otras specs:**

- Si Metamorfosis Real agrega Twitter/X, LinkedIn, Threads, etc. en el futuro, extender `SOCIAL_LINKS` y agregar el bloque correspondiente en el HTML. Trivial.
- El email del footer (`metamorfosisvitaloficial@gmail.com`) sigue tal cual — Carlos no pidió cambiarlo.
