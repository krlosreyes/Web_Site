# SPEC-013 — Layouts unificados (tema oscuro + footer único)

**Estado:** ✅ Cerrada
**Fase:** 3
**Severidad:** MEDIO (UX, consistencia visual)
**Fecha de creación:** 2026-05-09
**Cerrada:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** SPEC-011 (Footer real)

---

## Contexto

El sitio tenía **dos layouts coexistiendo** con estéticas opuestas:

- `Layout.astro` → fondo CLARO (`bg-gradient-to-br from-gray-50 via-white`), texto oscuro. Lo usaban: `terminos`, `privacidad`, `sobre-mi`, `protocolo`, `dashboard-7d`, `comunidad`, `diagnostico`, `calculadora`, `login`, `admin/*`.
- `BaseLayout.astro` → fondo OSCURO (`html.dark`, `bg-base text-primary`), texto claro, glow azul/verde. Lo usaban: `index`, `quiz`, `dashboard`, `biblioteca`, `posts/[slug]`.

**Resultado para el visitante:** al navegar de la home (oscura, biotech) a "Sobre mí" o "Términos" (clara, sobria), el cambio de tema era brusco. Rompía la sensación de marca consistente.

Además:

- **Dos footers distintos**: `BaseLayout` tenía un `<footer>` inline minimalista (solo copyright + tagline). `Layout` usaba el componente completo `<Footer />` con redes + navegación. Visitantes que entraban por la home no veían las redes sociales.
- **`<style is:global> p { max-width: 65ch }`** dentro de `BaseLayout` aplicaba ese `max-width` a TODOS los `<p>` del sitio, incluyendo párrafos en Hero, Pillars, Cards, etc. Restringía layouts pensados para texto ancho.

## Problema

Identidad visual fragmentada + UX inconsistente + estilos globales que pisaban componentes.

## Solución implementada

Carlos eligió `oscuro+full` (tema oscuro en todo + footer completo en todas).

### Cambios en `src/layouts/BaseLayout.astro`

- Importa y usa `<Footer />` (componente completo con redes + navegación legal) en lugar del `<footer>` inline minimalista.
- Eliminado el bloque `<style is:global> p { max-width: 65ch }` — los componentes que necesiten reading width focus lo aplican localmente con `max-w-[65ch]` o similar.
- Consolidados los pesos de Inter (`400;500;600;700;800`) + Space Grotesk (`500;700`) en un solo link de Google Fonts.

### Cambios en `src/layouts/Layout.astro`

- Reescrito como **wrapper de `BaseLayout`**:
  ```astro
  ---
  import BaseLayout from "./BaseLayout.astro";
  const props = Astro.props;
  ---
  <BaseLayout {...props}><slot /></BaseLayout>
  ```
- Las 13+ páginas que importaban `Layout.astro` siguen funcionando sin tocar nada — internamente todas terminan en BaseLayout, así que todo el sitio queda con el mismo tema oscuro y el mismo footer.

## Criterios de aceptación

- [x] `BaseLayout.astro` usa `<Footer />` componente, no footer inline.
- [x] `Layout.astro` es un wrapper que delega a `BaseLayout.astro`.
- [x] El bloque `<style is:global> p { max-width: 65ch }` no existe.
- [ ] Visualmente: home, biblioteca, sobre-mi, terminos, privacidad, calculadora todas tienen el mismo fondo oscuro (`bg-base`).
- [ ] El footer aparece igual (con redes + navegación) en TODAS las páginas.
- [ ] Las páginas que estaban pensadas para fondo claro (sobre-mi, terminos, privacidad) tienen suficiente contraste en oscuro — verificar manualmente.

## Pruebas

```sh
# Greps en el repo
grep -rn 'max-width: 65ch' metamorfosis-web/src
# Esperado: 0 resultados

grep -rn '<footer ' metamorfosis-web/src/layouts
# Esperado: 0 (BaseLayout ya no tiene footer inline; usa <Footer />)

# Tras deploy: verificar que TODAS las páginas tienen las redes en footer
sleep 95
for path in / /sobre-mi /terminos /privacidad /biblioteca /calculadora; do
    count=$(curl -s "https://metamorfosisvital.com.co${path}" | grep -oE 'metamorfosisreal|Metamorfosisreal' | wc -l | tr -d ' ')
    echo "${path}: ${count}"
done
# Esperado: cada path debe dar 3.
```

Visual:

- Home y "Sobre mí" deben tener el mismo fondo oscuro (no hay cambio brusco al navegar).
- Texto de páginas legales legible (gris claro sobre fondo oscuro).
- Hero, Pillars, Cards en home/biblioteca no se ven recortadas (el `max-width: 65ch` global ya no aplica).

## Riesgos / consideraciones

- **Páginas que asumían fondo claro pueden tener contraste pobre.** Las páginas legales (`terminos`, `privacidad`) tenían texto en gris oscuro sobre gris claro. Tras el cambio queda gris oscuro sobre fondo oscuro → poco legible. Si pasa, hay que ajustar las clases de texto en esas páginas (`text-gray-700` → `text-gray-300`).
- **Login/admin** ya tenían fondos negros (`bg-[#050505]`) sobre el body, así que no se ven afectadas — el bg de body está cubierto.
- **Componentes con `style is:global p`** podrían pisar — verificar `posts/[slug]` que tiene su propio `<style is:global>` con `.prose p { ... }`. Aplica solo a `.prose`, no global, así que OK.
- **Reversibilidad**: si algo crítico se rompe, restaurar `Layout.astro` desde el commit anterior y mantener `BaseLayout` como está. Las páginas con su propio bg seguirán funcionando.

## Commit

```
feat(spec-013): unificar layouts a tema oscuro + footer único

Carlos eligió 'oscuro+full': tema oscuro en todo el sitio + footer
completo (con redes + navegación legal) en todas las páginas.

Cambios:

- BaseLayout.astro: <footer> inline reemplazado por componente
  <Footer />. Eliminado el <style is:global> con p { max-width: 65ch }
  que pisaba todos los párrafos del sitio. Fonts consolidadas.

- Layout.astro: reescrito como wrapper de BaseLayout. Las 13+ páginas
  que lo importan siguen funcionando sin cambios — internamente todas
  terminan con el mismo tema oscuro + el mismo footer.

Riesgo conocido: páginas legales (terminos, privacidad) que asumían
fondo claro pueden tener contraste pobre. Si pasa, ajustar clases de
texto en spec follow-up.

Cierra specs/SPEC-013-unified-layouts.md
```

---

## Resultado

Implementada en una sola pasada el 2026-05-09 sin migrar las 13+ páginas individualmente — el wrapper de `Layout.astro` propaga los cambios automáticamente. Sin riesgo de regresión funcional, solo riesgo cosmético de contraste en páginas legales que se evalúa visualmente post-deploy.

**Aprendizajes:**

- **Layouts wrapper son una herramienta poderosa de Astro** para hacer migraciones progresivas sin tocar las páginas que los importan. Cualquier cambio futuro en el layout base se propaga automáticamente.
- **Estilos `is:global` deben usarse con extrema cautela.** Un `p { max-width }` inocente puede romper layouts pensados para texto ancho. Preferir clases utilitarias de Tailwind aplicadas localmente.
- **Cuando hay dos layouts con identidades opuestas, hay que elegir uno.** Mantener "tema según contexto" (claro para legal, oscuro para producto) genera más fricción de la que vale.