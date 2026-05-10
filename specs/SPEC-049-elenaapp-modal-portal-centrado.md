# SPEC-049 — Modal ElenaApp con Portal + centrado robusto

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Bugfix UX
**Severidad:** ALTO (modal roto en producción, no se ve centrado)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-048

---

## Contexto

Carlos reporta con screenshot que el modal de ElenaApp (SPEC-048) NO se ve centrado:

- Aparece anclado a una posición errática en pantalla.
- El backdrop oscuro NO cubre toda la pantalla (se ve la página `/comunidad` debajo).
- En diferentes resoluciones / browsers el comportamiento varía.

## Análisis del bug

`<ElenaAppCTA>` se renderiza **dentro de `<Navbar.astro>`**, que es `fixed top-0 left-0 w-full` con `backdrop-blur-md`. El modal interno usa `position: fixed; inset: 0` — pero en algunos browsers (Chrome, especialmente con `backdrop-filter` o `transform` en ancestors), `position: fixed` se vuelve relativo al ancestor más cercano que crea **containing block**, no al viewport.

Resultado: el modal queda atrapado dentro del bounding box del navbar (80px de alto), y el backdrop tampoco cubre la página completa.

## Solución

Usar **React Portal** (`createPortal`) para renderizar el modal directamente como hijo de `<body>`, fuera de cualquier ancestor que pueda crear containing block. Patrón estándar para modals/dialogs en React; lo usan Radix, Headless UI, Reach UI, etc.

Cambios secundarios:

- Asegurar `flex justify-center` + `items-stretch sm:items-center` para layout robusto.
- `max-h-[90vh]` en modal interno para que el contenido haga scroll dentro si excede la altura disponible (no el body, que está bloqueado).
- Sumar guard `typeof document !== 'undefined'` para SSR-safety (Astro renderiza el componente con `client:load`, pero el primer paint puede correr en server).

## Beneficios

- **App**: modal funciona consistente en todas las resoluciones y browsers, sin importar dónde esté el componente en el árbol.
- **User**: ve siempre el modal como debe ser — centrado, con backdrop completo, escape routes claras.

## Plan de ejecución

1. Spec markdown (hecho).
2. Editar `src/components/ElenaAppCTA.tsx`:
   - Importar `createPortal` de `react-dom`.
   - Envolver el modal en `createPortal(..., document.body)`.
   - SSR guard.
3. Build + commit + push.

## Criterios de aceptación

- [x] El modal aparece siempre centrado en pantalla, sin importar desde qué componente se invoca.
- [x] Backdrop cubre 100% del viewport.
- [x] Mobile (<640px): modal full-screen con scroll interno si hace falta.
- [x] Desktop: modal centrado con `max-h-[90vh]`, scroll interno si el contenido excede.
- [x] ESC, click-outside y ✕ siguen funcionando.
- [x] Body scroll bloqueado mientras está abierto.

## Pruebas manuales

1. Abrir cualquier página del sitio → click ElenaApp en navbar → modal centrado en pantalla con backdrop completo.
2. Mobile real 375px → modal full-screen.
3. Tablet 768px → modal centrado con max-w + max-h.
4. Desktop 1440px → ídem.
5. Resize la ventana mientras el modal está abierto → modal se ajusta sin romperse.
6. Abrir modal desde la página `/comunidad` (donde se vio el bug) → ahora se ve centrado.

## Riesgos y trade-offs

- **Hydration mismatch en SSR**: el componente usa `client:load`, así que el primer render del cliente sí monta el modal en `document.body` cuando `open=true`. El primer paint del server NO tiene el modal renderizado (porque `open=false`). Sin mismatch.
- **Multiple instances**: si hay 2 `<ElenaAppCTA>` en la página (desktop nav + mobile nav), ambos pueden abrir el modal independientemente. Con Portal, ambos modals viven en `body` pero solo uno a la vez está `open=true` (estado local de cada componente). Aceptable.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/components/ElenaAppCTA.tsx` — `createPortal` + SSR guard.

**Decisiones:**
- Portal a `document.body` (no a un container dedicado): simplicidad, sin manejar refs adicionales.
- Mantengo el backdrop blur en el modal porque ahora sí cubre el viewport completo.

Sin desviaciones del plan funcional.
