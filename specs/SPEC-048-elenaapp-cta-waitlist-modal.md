# SPEC-048 — ElenaApp CTA con modal de waitlist (primeros 1000)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Conversión / waitlist
**Severidad:** ALTO (entrada principal al producto futuro)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-006 (onboarding canónico → `users/{uid}.waitlist`), SPEC-029 (email de bienvenida que ya promete "primeros 1000")

---

## Contexto

El navbar tiene un botón **"ABRIR APP"** que linkea directo a `https://elena-app.vercel.app/`. Dos problemas:

1. **No comunica nada**: el visitante no sabe qué hace ese link, qué app es, ni por qué le interesaría.
2. **Saca al user del sitio**: al click, se va — pierde la oportunidad de convertirlo a la waitlist con el resto del funnel.

## Solución

Reemplazar el botón por un **CTA con modal de waitlist** que:

1. **Botón en navbar**: pill con ícono móvil + texto "ElenaApp" + badge "EARLY" (early access). Distinto a un link plano.
2. **Click → modal**: ventana emergente centrada (full-screen en mobile) que invita a estar entre los primeros 1000 con beneficios.
3. **Comportamiento según auth**:
   - **Anónimo**: CTA primario "Reservá tu lugar gratis" → linkea a `/login` (con `?next=/dashboard&fromWaitlist=1` para tracking).
   - **Logueado**: CTA "Ya estás en la lista 🎉" — confirma la posición y refuerza la promesa.
4. **Beneficios listados**: 1 anclado (descuento fundador) + 3 con teaser de sorpresa para mantener curiosidad.

## Investigación / patrones que aplico

- **Superhuman / Notion / Cron** (waitlists exitosas): logo prominente + escasez + benefit teasers.
- **Robinhood / Be My Eyes**: gamificación de la posición ("sos el #N").
- **iOS TestFlight pre-launches**: "founding member" badges + early bird discount.
- **Modal escape routes** (UX estándar): ESC, click-outside, ✕ visible. Bloqueo de scroll del body cuando abierto.

## Beneficios

- **App**: cada visita al sitio es una oportunidad de conversión a la waitlist. Hoy ese link tira al user fuera sin contexto.
- **User**: entiende qué es ElenaApp, qué gana al unirse temprano, sin tener que abandonar la página.

## Plan de ejecución

1. Spec markdown (hecho).
2. Crear `src/components/ElenaAppCTA.tsx` (botón pill + modal con animación + listener de auth).
3. Reemplazar el `<a href>` actual en `Navbar.astro` (desktop + mobile menu) por `<ElenaAppCTA client:load />`.
4. Build + commit + push.

## Criterios de aceptación

- [x] Botón del navbar es un pill con ícono + "ElenaApp" + badge "EARLY".
- [x] Click abre un modal centrado (desktop) o full-screen (mobile).
- [x] Modal tiene escape routes: ESC, click-outside, ✕.
- [x] Body scroll bloqueado mientras modal está abierto.
- [x] Anónimo: CTA "Reservá tu lugar gratis" → linkea a `/login`.
- [x] Logueado: CTA muestra "Ya estás en la lista".
- [x] Beneficios listados: 1 visible (descuento fundador) + 3 con teaser sorpresa.
- [x] Mobile responsive sin overflow.
- [x] El link a `https://elena-app.vercel.app/` se mantiene como CTA secundario para users que sí quieran ver la app actual.

## Pruebas manuales

1. Modo incógnito → click "ElenaApp" en navbar desktop → modal abre, ver beneficios + CTA "Reservá tu lugar gratis".
2. Click CTA primario → llega a `/login`.
3. Press ESC en modal abierto → cierra suavemente.
4. Click fuera del modal → cierra.
5. Click ✕ → cierra.
6. Mobile (375px): modal full-screen con scroll interno si hace falta.
7. Logueado: ver CTA confirmación + posición teaser.

## Riesgos y trade-offs

- **Sin logo dedicado de ElenaApp**: uso `elena-mockup.png` como hero en el modal y un pill construido para el navbar. Cuando Carlos suba un `elenaapp-logo.png`, cambio una sola línea.
- **Posición real "sos el #N"**: requiere `count()` de `users` con `waitlist.status='pending'` en cada apertura del modal. Costo bajo pero no implementado en v1 — muestro mensaje genérico "Estás dentro" y agrego posición en una iteración futura si Carlos quiere.
- **`fromWaitlist=1` en URL del login**: tracking simple para SPEC-019 stats si querés ver conversión específica de este CTA. No bloqueante.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/components/ElenaAppCTA.tsx` — nuevo componente React con botón pill + modal.
- `metamorfosis-web/src/components/Navbar.astro` — reemplazado el `<a>` desktop y mobile por `<ElenaAppCTA client:load />`.

**Decisiones:**
- **Pill compacto** en navbar (no banner enorme): respeta el espacio del navbar sin romper jerarquía.
- **Modal mobile-first**: full-screen en <640px, centrado con max-width en sm+.
- **Beneficios anchored + teasers**: `🎁 Precio fundador` listado claro; los otros 3 con `?` y candado para crear curiosidad.

Sin desviaciones del plan funcional.
