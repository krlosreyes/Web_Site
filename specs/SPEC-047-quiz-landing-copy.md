# SPEC-047 — Landing del quiz: copy que invita

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — UX / conversión
**Severidad:** ALTO (puerta de entrada del funnel)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes

---

## Contexto

`/quiz` step 0 muestra hoy:

- Eyebrow: **"PROTOCOLO SPEC-70.5"** (jerga interna).
- Línea decorativa.
- Botón "INICIAR ESCANEO IMR".
- Subtítulo: "Basado en Composición Visceral y Ritmos Circadianos".

No hay headline, no hay beneficio claro, no hay invitación. El user llega y tiene que decidir clickear sin contexto. Bug de conversión.

## Solución

Reemplazar el contenido del step 0 con copy invitacional siguiendo el patrón estándar de landings de diagnóstico (Noom, Headspace, etc.):

1. **Chip eyebrow** amigable: "🧬 Diagnóstico gratuito · 2 minutos".
2. **Pregunta hook** grande (responsive `text-3xl sm:text-4xl md:text-6xl`): _"¿Qué edad tiene tu metabolismo?"_
3. **Sub-copy** con beneficio claro: explica qué obtiene tras los 2 minutos (su IMR + reporte por pilar).
4. **CTA primario** (mantenido): "INICIAR ESCANEO →".
5. **Trust signals** abajo (3 chips): "✓ Sin registro previo · ✓ Resultado al instante · ✓ Basado en evidencia".

Manteniendo: animación fade-in, gradiente del botón, paleta blue/teal.

## Beneficios

- **App**: más conversión inicio-quiz, menos abandono ante el botón seco.
- **User**: entiende qué se va a llevar antes de invertir 2 min. Reduce fricción.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivo tocado:**
- `metamorfosis-web/src/components/IMRQuiz.tsx` — step 0 reescrito con headline + sub-copy + trust signals + chip eyebrow renovado.

**Decisiones:**
- **"¿Qué edad tiene tu metabolismo?"**: hook clásico de health quiz, despierta curiosidad personal sin ser clickbait.
- **Mantengo el botón** ("INICIAR ESCANEO →") porque ya funciona visualmente.
- **Sin tocar steps 1-9**: el cambio es solo en la pantalla de bienvenida.

Sin desviaciones del plan.
