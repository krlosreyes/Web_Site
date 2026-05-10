# SPEC-045 — Footer del artículo: espaciado y peso visual coherentes

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — UX visual
**Severidad:** MEDIO (estética del footer del artículo)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-032, SPEC-040

---

## Contexto

Carlos reporta con screenshot que los 3 bloques del footer del artículo (PostReactions, "La Tribu" CTA, Quiz) se ven amontonados y desproporcionados. Análisis:

- **PostReactions** usa `p-8 md:p-10` (padding generoso) — peso visual alto.
- **"La Tribu" CTA** usa `mt-6 px-6 py-5` con flex-row sin breakpoint — padding chico, peso visual bajo, en mobile el "Abrir tema →" se pega al texto.
- **Quiz** hereda padding propio del componente — peso visual alto, sin margin-top con respecto al CTA anterior.

Resultado: rítmica visual rota. Bloque del medio "se hunde".

## Solución

1. **`mt-8 md:mt-10`** entre PostReactions y CTA La Tribu (era `mt-6`).
2. **`mt-12 md:mt-16`** entre CTA La Tribu y Quiz (no había nada, estaban pegados).
3. **CTA La Tribu** con `p-6 md:p-8` (alineado con el peso de PostReactions).
4. **Layout responsive del CTA**: `flex-col gap-4` en mobile, `sm:flex-row sm:items-center sm:justify-between` desde 640px. El "Abrir tema →" pasa a una pill secundaria abajo en mobile.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/posts/[slug].astro` — espaciado entre bloques + rediseño del CTA "La Tribu" con padding equivalente a PostReactions y layout responsive.

**Decisiones:**
- **No tocar PostReactions ni Quiz**: ya tenían padding correcto. El cambio se concentra en el bloque del medio + márgenes entre los 3.
- **Mobile-first**: el CTA en flex-col deja el texto principal arriba y el call-to-action como botón pill abajo. En desktop vuelve al layout horizontal compacto.

Sin desviaciones del plan.
