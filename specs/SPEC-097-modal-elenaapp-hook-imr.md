# SPEC-097 — Simplificar modal ElenaApp: hook del IMR en lugar de precio

**Estado:** ✅ Cerrada (pendiente de `npm run build` + commit local)
**Fase:** Pre-lanzamiento — optimización de conversión
**Severidad:** ALTO (el modal anterior comunicaba mucho "precio" y eso podía generar fricción)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-096 (renombrado a "acceso anticipado")

---

## Contexto

Después de SPEC-096 el modal de ElenaApp quedó alineado al lenguaje
"Acceso anticipado" pero seguía comunicando 4 mensajes superpuestos:
"reserva tu acceso", "gratis", "precio preferencial", "sin
obligación". Carlos observó que **estábamos comunicando demasiado
sobre precio** — eso es ruido cuando el usuario todavía no entiende
el valor del producto.

## Problema

El modal vende "reservar acceso a algo futuro" antes de demostrar
valor inmediato. El visitante hispano puede pensar "¿por qué
reservaría algo si todavía no sé qué me ofrecen?".

## Solución propuesta

Reescribir el modal con un cambio de enfoque:

**Antes (SPEC-096):** "Reserva tu acceso + Precio preferencial + Sin
obligación + Gratis · Sin tarjeta · 2 minutos".

**Después (SPEC-097):** "Conoce ahora tu % de grasa corporal" + una
sola card explicativa + CTA al quiz.

El hook ahora es **valor inmediato** (calcular IMR / % grasa
corporal) y el beneficio futuro (acceso anticipado a ElenaApp) se
menciona en la card explicativa, no como protagonista.

## Plan de implementación

1. **Modificar** `src/components/ElenaAppCTA.tsx`:
   - Badge: queda "🚀 Acceso anticipado".
   - Título: "Reserva tu acceso / Gratis · Sin tarjeta" →
     "Conoce ahora tu % de grasa corporal".
   - Eliminar subtítulo "Sé de los primeros en usar ElenaApp...".
   - Reducir 2 cards a 1 sola: "Al calcular tu IMR quedas
     registrado(a) para estar entre las primeras 1000 personas en
     tener ElenaApp con beneficios adicionales."
   - CTA: "Reservar mi lugar gratis →" → "Calcular mi IMR ahora →".
   - **CTA target:** `/login?fromWaitlist=1` → `/quiz` (lleva al
     embudo directo).
   - Eliminar footer "Gratis · Sin tarjeta · 2 minutos".

## Corrección gramatical

Carlos escribió "una de los primeras 1000" (mezcla "una" femenino +
"los" masculino + "primeras" femenino). La forma correcta y neutral
es **"entre las primeras 1000 personas"** (persona es femenino, las
primeras concuerda). Mantiene el sentido inclusivo del "registrado(a)"
previo sin sacrificar gramática.

## Criterios de aceptación

- [ ] `npm run build` no lanza errores.
- [ ] El modal muestra un solo bloque de copy: badge + título +
      card + CTA.
- [ ] Click en CTA "Calcular mi IMR ahora →" navega a `/quiz`.
- [ ] El estado "Ya estás en la lista" para usuarios logueados se
      mantiene (sigue sirviendo).

## Pruebas

```sh
cd metamorfosis-web && npm run build

# Smoke post-deploy:
#   1. Anónimo en home, esperar 3s → modal aparece con:
#      - Badge "🚀 ACCESO ANTICIPADO"
#      - Título "Conoce ahora tu / % de grasa corporal"
#      - Card "Al calcular tu IMR quedas registrado(a)..."
#      - CTA "Calcular mi IMR ahora →"
#      - NO hay footer abajo del CTA.
#   2. Click CTA → /quiz, no /login.
#   3. Usuario logueado: modal sigue mostrando "Ya estás en la lista".
```

## Riesgos / consideraciones

- **El flujo de waitlist directa (sin quiz) desaparece desde este
  modal.** El usuario que solo quiere "reservar lugar sin hacer
  quiz" ya no tiene path desde acá. Aceptable: el quiz es de 2
  minutos y aporta value real (saca su IMR), no es una fricción
  injustificada. Además, el flujo `/login?fromWaitlist=1` sigue
  funcionando para usuarios que vienen directo de SPEC-055.
- **Tracking event `cta_elenaapp_reservar` se mantiene** aunque el
  CTA cambió de texto/destino. Razón: el evento mide intención de
  entrar al embudo, que sigue siendo lo mismo.

## Commit

**Mensaje sugerido:**
```
feat(spec-097): simplificar modal ElenaApp — hook IMR en lugar de precio

- Título: "Conoce ahora tu % de grasa corporal".
- Una sola card explicativa (en vez de 2).
- CTA "Calcular mi IMR ahora →" navega a /quiz.
- Eliminado subtítulo y footer redundantes.
- Corrección gramatical: "entre las primeras 1000 personas".

Cierra specs/SPEC-097-modal-elenaapp-hook-imr.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**Archivo tocado (1):** `src/components/ElenaAppCTA.tsx`.

**Cambio neto del modal:**

Antes (SPEC-096) — 4 líneas de copy + 2 cards + 1 CTA + 1 footer:
- "Reserva tu acceso" / "Gratis · Sin tarjeta"
- "Sé de los primeros en usar ElenaApp..."
- Card 💎 "Precio preferencial"
- Card ✅ "Sin obligación"
- CTA "Reservar mi lugar gratis →" → `/login?fromWaitlist=1`
- Footer "Gratis · Sin tarjeta · 2 minutos"

Después (SPEC-097) — 1 título + 1 card + 1 CTA:
- "Conoce ahora tu" / "% de grasa corporal"
- Card 🎁 explicativa: "Al calcular tu IMR quedas registrado(a)
  para estar entre las primeras 1000 personas en tener ElenaApp
  con beneficios adicionales."
- CTA "Calcular mi IMR ahora →" → `/quiz`

**Diferencia clave:** el modal ahora vende **valor inmediato** (saber tu
% grasa corporal en 2 minutos) y menciona el beneficio futuro
(acceso anticipado a ElenaApp) como un bonus implícito, no como
protagonista. El usuario decide ir al quiz porque quiere su número,
no porque le prometen un "precio especial" para algo que aún no
existe.

TS transpile validation OK.
