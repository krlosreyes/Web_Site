# SPEC-026 — Navbar no tapa el contenido (dashboard + defensa global)

**Estado:** ✅ Cerrada
**Fase:** 4 (UX — extensión post-cierre)
**Severidad:** ALTO (UX visible: usuario ve el título cortado)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-013 (layouts oscuros unificados)

---

## Contexto

El `Navbar.astro` es `fixed top-0` con altura `h-20` (80px) inicial y `h-16` (64px) tras scroll (`Navbar.astro:17`). Las páginas que lo incluyen (vía `BaseLayout`) tienen que reservar al menos 80px de espacio en su primer wrapper para que el primer renglón de contenido no quede tapado.

Carlos vio en producción que el dashboard de usuario (`/dashboard`) muestra el título "Hola, Carlos | Prueba" cortado por el navbar (screenshot recibido 2026-05-10). El doc de la página tiene `pt-8` (32px) en el `<main>`, claramente insuficiente.

## Problema

1. **`dashboard.astro` con padding-top insuficiente**: `pt-8` (32px) vs navbar de 80px → el título queda tapado en escritorio. En mobile el navbar mantiene los mismos 80px hasta que se scrollea (donde baja a 64px), así que el bug se ve igual o peor.
2. **No hay defensa global** que evite que cualquier página futura olvide reservar espacio para el navbar. El `BaseLayout` deja el `<main>` sin padding-top y delega esa responsabilidad a cada página.
3. **Anchors `#section`**: si alguien linkea a una sección con `<a href="#alimentacion">`, el scroll hace que el ancla quede tapada por el navbar. Síntoma relacionado, hoy no reportado pero pendiente.

## Solución propuesta

### 1. Fix puntual: `dashboard.astro` con padding correcto

`pt-8` → `pt-28` (112px = 80px navbar + 32px respiro). Cubre el navbar en su altura inicial (80px), navbar reducido por scroll (64px), y deja respiro visual.

### 2. Defensa global vía CSS — `scroll-margin-top` en headings/anchors

Cualquier elemento con `id` (típicamente headings que reciben anchors) lleva `scroll-margin-top: 5rem` para que cuando se navegue con `#fragment` o se haga `scrollIntoView`, el elemento quede 80px abajo del top visible. Esto NO cambia el layout — solo afecta navegación a anchors.

### 3. Defensa por convención (sin tocar BaseLayout)

NO aplico padding-top al `<main>` global del BaseLayout porque algunas páginas (`posts/[slug].astro` con hero a 60vh, `index.astro` con Hero propio) esperan que el navbar quede transparente sobre la imagen del hero. Un padding global rompería esa estética.

En cambio, documento la regla en `CLAUDE.md` como regla inquebrantable. Cualquier agente futuro que cree una página nueva con `BaseLayout` la lee primero.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Fix `dashboard.astro:7` — `pt-8` → `pt-28`.
3. Agregar regla CSS en `metamorfosis-web/src/styles/global.css` para `scroll-margin-top`.
4. Agregar regla a la sección 4 de `CLAUDE.md` ("Reglas inquebrantables").
5. Build + commit + push.
6. Verificación visual en escritorio y mobile.

## Criterios de aceptación

- [x] El título del dashboard se ve completo en escritorio sin scroll.
- [x] El título del dashboard se ve completo en mobile sin scroll.
- [x] Después de scrollear (navbar pasa a h-16), el contenido no se "salta" raro.
- [x] Anchors `#fragment` no quedan tapados por el navbar.
- [x] CLAUDE.md tiene la regla: "páginas con BaseLayout deben reservar ≥80px de padding-top".

## Pruebas manuales

1. Login user → `/dashboard` → escritorio: el título "Hola, X | Prueba" se ve completo.
2. Mismo flow en mobile (responsive 380-414px): igual.
3. Hacer scroll: navbar se contrae a h-16, contenido sigue visible y sin saltos visuales.
4. Verificar que las otras páginas con BaseLayout siguen sin regresión:
   - `/biblioteca` (ya tenía pt-32 propio).
   - `/posts/{slug}` (hero a 60vh con imagen).
   - `/quiz` (centrado vertical).
   - `/` index (hero propio).
5. Probar navegación a anchor: forzar `#footer` en la URL → el target queda visible debajo del navbar, no tapado.

## Riesgos y trade-offs

- **Si en el futuro alguien crea una página con BaseLayout y olvida el padding**, vuelve a haber bug. Mitigado parcialmente con la entrada en CLAUDE.md, pero no es un guard estricto. Una alternativa más segura sería aplicar el padding al `<main>` del BaseLayout y forzar a las páginas con hero a usar margen negativo. Lo dejé como follow-up porque tocaría 5+ páginas y aumentaba el blast radius del cambio para un fix de UX.
- **`scroll-margin-top` global** se aplica a TODOS los elementos con id. Si en el futuro una página define un hero con `id="top"` esperando que el scroll lo deje pegado al borde superior, hay que sobreescribir. Aceptable.

## Compatibilidad con ElenaApp

Sin impacto.

## Commit

```
fix(spec-026): navbar no tapa contenido en dashboard + defensa global

- dashboard.astro: pt-8 → pt-28 (cubre navbar de 80px + respiro)
- global.css: scroll-margin-top: 5rem en [id] para que anchors no
  queden tapados por el navbar fixed
- CLAUDE.md: regla inquebrantable agregada — páginas con BaseLayout
  deben reservar ≥80px de padding-top en su primer wrapper

Cierra SPEC-026.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/dashboard.astro` — `pt-8` → `pt-28`.
- `metamorfosis-web/src/styles/global.css` — regla `[id] { scroll-margin-top: 5rem; }` para anchors.
- `CLAUDE.md` — sección 4 ampliada con la regla del navbar fixed.

**Decisiones tomadas en la marcha:**
- **No tocar BaseLayout**: hubiera roto las páginas con hero. La regla en CLAUDE.md + el fix puntual cubren el 100% del bug actual sin blast radius.
- **`scroll-margin-top` con valor fijo de 5rem**: matchea exactamente la altura inicial del navbar (h-20 = 5rem). Cuando el navbar se reduce a h-16 (4rem) tras scroll, el espacio extra de 1rem es respiro visual aceptable.
- **Aplico la regla a `[id]` y no solo a `h1, h2, h3`**: cualquier elemento puede ser anchor, no sólo headings. La regla es defensiva y pesa cero al render.

**Sin desviaciones del plan funcional.**
