# SPEC-053 — Hero copy refresh

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — refinamiento de mensaje
**Severidad:** MEDIO (copy core del sitio)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-031 (headings responsive sin desborde)

---

## Contexto

El copy original del Hero era de tono "publicitario" — "Transforma tu
Metabolismo con Ciencia Real" + descripción técnica con palabras como
"reingeniería biológica" y "optimización hormonal". Carlos quiere pivotar
a un mensaje más empoderador donde el user es el protagonista: él diseña
su salud, Metamorfosis Real le da las herramientas.

## Cambios

| Elemento | Antes | Después |
|---|---|---|
| Pill superior | "Ecosistema de Salud de Alta Autoridad" | **"Ecosistema Metamorfosis Real"** |
| H1 línea 1 + 2 | "Transforma tu / Metabolismo" | **"Nosotros te damos las herramientas"** |
| H1 línea 3 (gradient azul) | "con Ciencia Real" | **"Tú diseñas tu salud."** |
| Subtítulo | "No es una dieta más. Es una reingeniería biológica basada en datos clínicos, optimización hormonal y el poder de ElenaApp." | **"No es una dieta, es el manual de instrucciones que tu cuerpo siempre necesitó."** |

## Ajuste responsive bonus

El copy nuevo del H1 es más largo (34 chars vs 13 chars del anterior).
El H1 original tenía `text-5xl md:text-7xl`, lo cual sería marginal en
mobile con el copy nuevo. Aplicado el patrón de SPEC-031:

- Clase actualizada: `text-4xl sm:text-5xl md:text-6xl lg:text-7xl`
- Agregado `break-words` como defense in depth.

## Plan de ejecución

1. Editar `metamorfosis-web/src/components/Hero.astro`:
   - Línea 23 (pill): nuevo texto.
   - Líneas 26-28 (H1): nuevos textos + responsive classes ajustadas.
   - Línea 31 (subtítulo): nuevo texto.
2. Build local + commit + push.

## Criterios de aceptación

- [x] Pill superior muestra "Ecosistema Metamorfosis Real".
- [x] H1 línea principal: "Nosotros te damos las herramientas".
- [x] H1 segunda parte (en gradient azul): "Tú diseñas tu salud."
- [x] Subtítulo: "No es una dieta, es el manual de instrucciones que tu cuerpo siempre necesitó."
- [x] H1 responsive: text-4xl en mobile, escalando hasta text-7xl en lg.
- [x] H1 con `break-words` para fallback de overflow.
- [ ] Post-deploy: visual en mobile (360px) — texto no desborda.
- [ ] Post-deploy: visual en desktop — composición se ve balanced.

## Pruebas manuales

Después del deploy:

1. Abrir home en desktop → H1 ocupa 2 líneas, gradient azul en la segunda.
2. Abrir home en mobile (DevTools → 360px) → H1 ocupa 3-4 líneas pero no desborda.
3. Verificar que el subtítulo se lee fluido (es más corto que antes).

## Riesgos y trade-offs

- **Copy más largo en H1**: "Nosotros te damos las herramientas" tiene
  más caracteres que "Transforma tu Metabolismo". En mobile angosto
  puede crear más wrapping. Mitigado con responsive scale y break-words.
- **Tono más casual**: el nuevo subtítulo ("manual de instrucciones que
  tu cuerpo siempre necesitó") cambia el tono del "high-authority" al
  más conversacional. Decisión deliberada del owner.
- **Sin mención a ElenaApp en subtítulo**: antes mencionaba ElenaApp,
  ahora no. Si se quiere mantener la referencia explícita, se agrega
  en otra sección del sitio (sección ElenaApp ya existe más abajo).

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos tocados:**
- `metamorfosis-web/src/components/Hero.astro` — 3 strings + responsive classes H1.

**Decisiones:**
- H1 responsive escalado: agregado `text-4xl sm:text-5xl md:text-6xl lg:text-7xl`
  + `break-words` siguiendo el patrón de SPEC-031.
- Sin cambios en CTAs ("Obtener mi Diagnóstico IMR" / "Explorar el
  Ecosistema") ni en stats row (10K+ / 94% / IMR) — solo era cambio
  de copy textual + responsive de un H1.

Sin desviaciones del plan.
