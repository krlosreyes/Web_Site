# SPEC-107 — BaseLayout usa componentes Navbar y Footer reales

**Estado:** 🔨 En progreso (código listo, pendiente: `npm run build` + commit + push + smoke producción)
**Fase:** Hotfix crítico
**Severidad:** CRÍTICA (9 páginas del sitio sirven header/footer legacy en lugar de los componentes reales con auth, mobile menu, ElenaApp CTA, etc.)
**Fecha de creación:** 2026-05-20
**Autor:** Carlos Reyes

---

## Contexto

Carlos envió screenshot mostrando un navbar con items "Ciencia / Protocolos / Comunidad / Calcular IMR / Admin" que no existen en el componente `Navbar.astro` real. Investigación reveló que `BaseLayout.astro` (líneas 62-106) tiene un `<header>` LEGACY hardcodeado embebido, sobreviviente del repo pre-SDD. Lo mismo con el `<footer>` (líneas 112-121).

**Páginas afectadas (9):**
- `index.astro`, `dashboard.astro`, `dashboard/plan.astro`, `quiz.astro`, `imr.astro`, `imr/metodologia.astro`, `biblioteca.astro`, `posts/[slug].astro`, `disclaimer-medico.astro`

Ninguna spec del repo modificó BaseLayout previamente — el archivo nunca fue migrado a usar los componentes `Navbar.astro` (creado/refinado en SPEC-003, SPEC-007, SPEC-011, SPEC-030b, SPEC-043, SPEC-048, SPEC-072, SPEC-080+081) y `Footer.astro`.

## Problema

El header legacy tiene 5 defectos críticos:

1. **Logo mal formateado**: "MetamorfosisReal" pegado (en lugar de "Metamorfosis Real" con espacio + acento teal).
2. **Items de menú muertos**: "Ciencia / Protocolos / Comunidad" con `href="#"` (en lugar de IMR / Biblioteca / La Tribu).
3. **Link "Admin" siempre visible**: sin gate `{isAdmin &&}`, expone la existencia del panel a visitantes anónimos. Viola SPEC-007 (ocultar UI admin).
4. **Sin botón Ingresar / Logout / NotificationBell / ElenaAppCTA**: el visitante no puede iniciar sesión, los logueados no pueden cerrar sesión, la cohorte fundadora pierde el modal de waitlist (SPEC-048, SPEC-097).
5. **Sin menú mobile**: el navbar legacy no tiene toggle hamburguesa. En mobile no hay forma de navegar.

El footer legacy también es minimal y no replica `Footer.astro` (que tiene redes sociales reales — SPEC-011).

## Solución

Reemplazar el header y footer embebidos del BaseLayout con los componentes existentes:

```astro
---
import Navbar from "../components/Navbar.astro";
import Footer from "../components/Footer.astro";
import "../styles/global.css";
---

<body>
  <Navbar />
  <main>
    <slot />
  </main>
  <Footer />
</body>
```

Lo que **se preserva**:
- `<head>` completo (SEO, OG tags, Twitter, favicon, viewport).
- Google Fonts links (SPEC-030 ya optimizado).
- `<div class="bg-glow">` decorativo si existe.
- `<style is:global>` con max-width de párrafos (si todavía aplica).

Lo que **se elimina**:
- `<header>` legacy entero (líneas 62-106).
- `<footer>` legacy entero (líneas 112-121).

## Plan de implementación

| # | Tarea | Esfuerzo |
|---|-------|---|
| 1 | Importar `Navbar` y `Footer` en frontmatter de BaseLayout | 2 min |
| 2 | Eliminar header legacy (líneas 62-106) | 2 min |
| 3 | Eliminar footer legacy (líneas 112-121) | 2 min |
| 4 | Reemplazar con `<Navbar />` y `<Footer />` | 3 min |
| 5 | Verificación sintaxis | 5 min |
| 6 | Commit + push | 5 min |

**Esfuerzo total:** ~20 min.

## Criterios de aceptación

- [ ] BaseLayout.astro renderiza `<Navbar />` en lugar del header hardcodeado.
- [ ] BaseLayout.astro renderiza `<Footer />` en lugar del footer hardcodeado.
- [ ] Las 9 páginas que usan BaseLayout muestran el navbar correcto (IMR / Biblioteca / La Tribu).
- [ ] Link "Admin" NO aparece para visitantes anónimos.
- [ ] Botón "Ingresar" aparece para anónimos.
- [ ] ElenaAppCTA + NotificationBell visibles donde corresponde.
- [ ] Menú hamburguesa mobile funciona.
- [ ] Footer muestra redes sociales reales.
- [ ] Build limpio.

## Pruebas manuales

```bash
cd metamorfosis-web && npm run build
```

**Smoke post-deploy:**

1. Anónimo en home: ve "MetamorfosisReal" → debería ver "Metamorfosis Real" con espacio + acento teal.
2. Anónimo en home: NO ve link "Admin" en navbar.
3. Anónimo en home: SÍ ve "Ingresar" + pill ElenaApp.
4. Anónimo en home mobile 375px: ve botón hamburguesa, abre menú con IMR/Biblioteca/La Tribu.
5. Login admin → cookie activa → ve link "Admin" + "Modo admin" + "Cerrar sesión".
6. Footer: redes sociales (YouTube, Instagram) visibles.

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Footer.astro tiene estructura distinta y rompe layout de alguna página | Baja | Footer ya existe y se usa indirectamente. Es defensivo |
| Navbar tiene padding distinto al header legacy → contenido se ve desplazado | Media | Navbar es `fixed top-0 h-20` per SPEC-026; las páginas con BaseLayout deben tener `pt-28` o equivalente. La regla está en CLAUDE.md §4. Verificar en cada página |
| Algún estilo global del legacy header se usa en otras páginas | Baja | El header legacy tiene clases inline; al borrarlas, nadie pierde nada |

## Commit sugerido

```
fix(spec-107): BaseLayout usa componentes Navbar y Footer reales

- Reemplazar <header> hardcoded legacy con <Navbar />.
- Reemplazar <footer> hardcoded legacy con <Footer />.
- 9 páginas del sitio ahora ven el navbar correcto con auth gates,
  menú mobile, ElenaApp CTA, NotificationBell y footer con redes.
- Resuelve: link Admin expuesto a anónimos, botón Ingresar ausente,
  logo malformado, items de menú con href="#" muertos.

Cierra specs/SPEC-107-baselayout-usa-componentes-reales.md
```

## Resultado

**Implementación 2026-05-20 — código aplicado:**

- **`src/layouts/BaseLayout.astro`**:
  - Imports nuevos: `Navbar` desde `../components/Navbar.astro` y `Footer` desde `../components/Footer.astro`.
  - Header legacy hardcodeado (líneas 62-106 del archivo original) **eliminado**. Reemplazado por `<Navbar />` con comentario que documenta qué aporta el componente.
  - Footer legacy hardcodeado (líneas 112-121 del archivo original) **eliminado**. Reemplazado por `<Footer />`.
  - Head intacto (SEO, OG, Twitter, fonts).
  - `<div class="bg-glow">` decorativo preservado.
  - `<style is:global>` con max-width de párrafos preservado.

**Verificaciones pasadas:**

- Braces balanceados (19/19).
- Cero rastros de items legacy en BaseLayout (Ciencia / Protocolos / Calcular IMR / Admin link directo).
- Únicas menciones de "Ciencia" / "Protocolos" en el resto del repo son textos contextuales (`index.astro:122` "Ciencia aplicada" como eyebrow de sección; `sobre-mi.astro:173` "Ciencia, no moda" como copy de párrafo). No son items de menú duplicados.

**Pendiente para Carlos:**

```bash
cd metamorfosis-web && npm run build

cd .. && git add metamorfosis-web/src/layouts/BaseLayout.astro \
                specs/SPEC-107-baselayout-usa-componentes-reales.md
git commit -m "fix(spec-107): BaseLayout usa componentes Navbar y Footer reales"
git push
```

**Smoke post-deploy (90-120s):**

1. **Anónimo en incógnito** abre el home:
   - Logo "Metamorfosis Real" con espacio + acento teal.
   - Items navbar: IMR / Biblioteca / La Tribu.
   - **NO** aparece link "Admin".
   - SÍ aparece botón "Ingresar" + pill ElenaApp + NotificationBell (esta última solo se hidrata cuando hay sesión).
2. **Anónimo mobile 375px**: hamburguesa visible, click abre menú con los mismos items + "Ingresar".
3. **Login admin** → cookie activa → ahora SÍ aparece link "Admin" + "Modo admin" + "Cerrar sesión".
4. **Footer**: redes sociales (YouTube + Instagram), links a recursos, copyright correcto.
5. Las 9 páginas con BaseLayout (`index`, `dashboard`, `dashboard/plan`, `quiz`, `imr`, `imr/metodologia`, `biblioteca`, `posts/[slug]`, `disclaimer-medico`) deben ver el mismo navbar/footer consistente.

**Si después del deploy alguna página se ve "cortada arriba"** (contenido tapado por el navbar), es porque ese page no tenía `pt-28` en su main. La regla CLAUDE.md §4 dice "≥80px de padding-top en el primer wrapper". Verificar y corregir caso por caso.
