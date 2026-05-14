# SPEC-095 — Cleanup de voseo residual en copy

**Estado:** ✅ Cerrada (pendiente de `npm run build` + commit local)
**Fase:** Pre-lanzamiento — higiene de copy
**Severidad:** ALTO (regla inquebrantable del CLAUDE.md, ya cerrada en SPEC-054 pero con residuos)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-054 (cierre original del neutralizado)

---

## Contexto

Carlos detectó voseo en `/imr` después del deploy de SPEC-081. La
regla del proyecto (CLAUDE.md sección 4) prohíbe voseo en cualquier
copy del sitio. SPEC-054 cerró el primer barrido pero quedaron
residuos en archivos creados después.

## Problema

El copy de `/imr`, `AdminLogin` y otros archivos posteriores a
SPEC-054 introdujo nuevas instancias de voseo verbal que se
escaparon del barrido original.

## Solución propuesta

Barrido exhaustivo con regex sobre `/src` buscando:

1. **Voseo verbal** (2da persona singular con terminación rioplatense):
   `sos, tenés, podés, querés, sabés, creés, necesitás, acabás,
   pensás, decís, salís, venís, entendés, aprendés, comés, dormís,
   vivís, andás, elegís, seguís, ayunás, movés`.
2. **Imperativos rioplatenses** (con tilde final): `Mirá, Hacé,
   Decí, Reservá, Iniciá, Probá, Descubrí, Recibí, Obtené, Pegá,
   Andá, Vení, Llegá, Buscá, Cerrá, Abrí, Subí, Bajá, Comprá, Pagá,
   Activá, Desactivá, Sumate, Olvidate, Quedate, Sentate, Dejá,
   Pensá, Volvé, Tomá, Esperá, Pará, Seguí, Anotá, Cliqueá,
   Registrate, Suscribite, Inscribite, Calculá, Mejorá, Optimizá,
   Aprendé, Conocé, Entrá, Salí`.
3. **Pronombre `vos`**.

Excepción válida (mantener): **pretérito 1ra persona del verbo
`descubrir`** cuando es narrativa de Carlos en `sobre-mi.astro`.
Allí "Descubrí que..." es legítimo (forma yo-descubrí pasada, no
imperativo voseo tú-descubrí).

## Cambios aplicados

3 ocurrencias corregidas:

1. **`src/pages/imr.astro:6`** — `description` meta:
   - Antes: "lo que sí podés mejorar"
   - Después: "lo que sí puedes mejorar"
2. **`src/pages/imr.astro:49`** — párrafo descriptivo:
   - Antes: "cuánto dormís, cómo ayunás y cuánto te movés"
   - Después: "cuánto duermes, cómo ayunas y cuánto te mueves"
3. **`src/components/admin/AdminLogin.tsx:43`** — mensaje de error
   429 del rate limit:
   - Antes: "Demasiados intentos. Esperá un minuto y volvé a probar."
   - Después: "Demasiados intentos. Espera un minuto e intenta de
     nuevo."

## Criterios de aceptación

- [x] Barrido completo sobre `/src` con regex de 50+ términos no
      devuelve matches (excepto la excepción válida documentada).
- [x] `imr.astro` no contiene voseo.
- [x] `AdminLogin.tsx` no contiene voseo en mensajes de error.
- [ ] `npm run build` no lanza errores.

## Pruebas

```sh
cd metamorfosis-web && npm run build

# Búsqueda confirmatoria post-cambio:
grep -rE '\b(sos|tenés|podés|querés|dormís|ayunás|movés|Mirá|Hacé|Esperá|volvé|Registrate)\b' src/
# Esperado: solo "Descubrí" en sobre-mi.astro (excepción 1ra persona).
```

## Commit

**Mensaje sugerido:**
```
fix(spec-095): cleanup voseo residual en /imr y AdminLogin

- imr.astro: "podés"→"puedes", "dormís"→"duermes",
  "ayunás"→"ayunas", "movés"→"mueves".
- AdminLogin.tsx: "Esperá un minuto y volvé a probar"→
  "Espera un minuto e intenta de nuevo".
- Barrido global con regex de 50+ términos confirma cero
  residuos (excepción válida: "Descubrí" 1ra persona en
  sobre-mi.astro, narrativa de Carlos).

Cierra specs/SPEC-095-cleanup-voseo-residual.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**3 ocurrencias detectadas y corregidas** en 2 archivos. Barrido
final con regex extendida sobre todo `/src` confirma cero
ocurrencias adicionales. Excepción válida confirmada: "Descubrí"
en `sobre-mi.astro:113` se mantiene porque es pretérito 1ra
persona en narrativa de Carlos (excepción explícita del CLAUDE.md
sección 4).
