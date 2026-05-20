# SPEC-106 — Fix overflow del stats row Hero en mobile (menú + Performance)

**Estado:** 🔨 En progreso (código listo, pendiente: `npm run build` + commit + push + verificar mobile)
**Fase:** Hotfix post-deploy
**Severidad:** ALTA (menú hamburguesa invisible para usuarios mobile + regresión Performance ~6 puntos)
**Fecha de creación:** 2026-05-20
**Autor:** Carlos Reyes
**Depende de:** SPEC-098 (introdujo el stats row con 3 tiles)

---

## Contexto

Tras el deploy de SPEC-098 a SPEC-105, Carlos detectó dos problemas simultáneos:

1. **Menú hamburguesa no aparece en mobile.**
2. **Performance del home en mobile bajó de >90 a 84** (medido con PageSpeed Insights, herramienta consistente).

## Diagnóstico

El stats row del Hero (`Hero.astro` líneas 88-127, SPEC-098) usa `flex items-center gap-6 md:gap-8` **sin `flex-wrap`**. En mobile 375px los 3 tiles totalizan:

| Elemento | Ancho aprox |
|---|---|
| Tile YouTube (logo + "4.5K" + "Suscriptores en YouTube ↗") | ~150 px |
| Separator + gap | 25 px |
| Tile BETA ("Cohorte 2026 activa") | ~130 px |
| Separator + gap | 25 px |
| Tile IMR ("Índice propio →") | ~90 px |
| **Total** | **~420 px** |

420 px > 375 px de viewport → **desborde horizontal**. Consecuencias:

- El body adquiere `overflow-x` y se hace más ancho que el viewport.
- El navbar con `w-full` calcula su ancho sobre el body desbordado → el botón hamburguesa (al lado derecho con `-mr-2`) queda **fuera del viewport visible**.
- Lighthouse / PageSpeed detecta el overflow y penaliza CLS (Cumulative Layout Shift) + Performance.

## Solución propuesta

Tres cambios mínimos al `Hero.astro`:

1. **`flex` → `flex flex-wrap`** en el stats row para que los tiles se apilen en mobile cuando no caben.
2. **Separators con `hidden md:block`** para que NO aparezcan en mobile (no tendrían sentido entre tiles wrappeados).
3. **`gap-6` → `gap-x-6 gap-y-4`** para que el wrapping tenga separación vertical adecuada.

Defensa adicional en `BaseLayout.astro` o `global.css`: `overflow-x: hidden` en `body` como red de seguridad. Esto NO arregla el problema raíz (lo arregla el wrap) pero protege contra desbordes futuros que pasemos por alto.

## Plan de implementación

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1 | `Hero.astro:88` cambiar `gap-6 md:gap-8` por `flex-wrap gap-x-6 gap-y-4 md:gap-x-8 md:gap-y-0` | `src/components/Hero.astro` | 5 min |
| 2 | Separators (líneas 114 y 119) agregar `hidden md:block` | `src/components/Hero.astro` | 3 min |
| 3 | `body { overflow-x: hidden }` en global.css como red de seguridad | `src/styles/global.css` | 3 min |
| 4 | Verificación sintaxis | sandbox | 3 min |
| 5 | Commit + push | git | 5 min |
| 6 | Smoke mobile + medir Performance post-deploy | producción | 15 min |

**Esfuerzo total:** ~35 min.

## Criterios de aceptación

- [ ] Mobile 375px: botón hamburguesa visible en navbar.
- [ ] Mobile 375px: stats row se ve en 2 o 3 líneas apiladas, sin separators verticales rotos.
- [ ] Desktop ≥768px: el row se ve igual que antes (1 línea con 3 tiles + 2 separators).
- [ ] PageSpeed Insights mobile: Performance ≥ 88 (recuperación esperada de ~4 puntos por eliminar overflow horizontal).
- [ ] Sin scroll horizontal en mobile (verificar con devtools).
- [ ] Build limpio.

## Pruebas manuales

```bash
cd metamorfosis-web && npm run build
```

**Smoke post-deploy:**

1. Abrir el home en mobile real o devtools responsive 375px.
2. Confirmar botón hamburguesa visible en esquina superior derecha.
3. Click → menú abre y cierra.
4. Stats row del Hero se ve en múltiples líneas, sin overflow.
5. Scroll horizontal: NO debe existir (ningún elemento del body excede el viewport).
6. PageSpeed Insights mobile en el home → 3 mediciones consecutivas, promedio ≥88.

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `overflow-x: hidden` en body rompe sticky positioning de algún elemento | Baja | Astro 6 sticky funciona con `overflow-x: hidden` en body (es `overflow: hidden` el problemático). Confirmado en docs MDN |
| Wrapping del stats row se ve feo en mobile | Media | Con `gap-y-4` queda razonablemente espaciado. Si se ve mal, mover a versión mobile-only (stack vertical) — pero v1 con wrap natural debería ser suficiente |
| Performance sigue debajo de 90 post-fix | Media | Si recupera 88-90 con este fix, declarar OK. Si queda en 84-85, abrir SPEC-107 para auditar otros candidates (Plan14d.tsx imports, fuentes, JS bundle del dashboard que se haya colado al home) |

## Commit sugerido

```
fix(spec-106): stats row Hero — flex-wrap + overflow-x defense

- Hero.astro: flex-wrap en stats row + separators hidden en mobile.
  Fix: el botón hamburguesa volvió a ser visible (desborde horizontal
  empujaba el navbar fuera del viewport en 375px).
- global.css: overflow-x:hidden en body como red de seguridad.

Fix dos síntomas correlacionados: menú mobile invisible + regresión
Performance ~6 puntos (CLS por overflow).

Cierra specs/SPEC-106-fix-stats-row-mobile.md
```

## Resultado

**Implementación 2026-05-20 — código aplicado:**

- **`src/components/Hero.astro:93`** — clase del stats row: `flex items-center gap-6 md:gap-8` → `flex flex-wrap items-center gap-x-6 gap-y-4 md:gap-x-8 md:gap-y-0`. Los 3 tiles se apilan en mobile sin desbordarse.
- **`src/components/Hero.astro:119 y 124`** — ambos separators verticales con `hidden md:block` agregado. En mobile no se renderizan; en desktop ≥768px aparecen como antes.
- **`src/styles/global.css:78`** — `body { overflow-x: hidden }` como red de seguridad anti-desborde futuro. Comentario indica que NO usar `overflow: hidden` (rompe sticky).

**Verificación sintáctica pasada:**

- Braces Hero.astro 21/21 balanceados.
- Grep confirma los 3 cambios aplicados.

**Pendiente para Carlos:**

```bash
cd metamorfosis-web && npm run build

cd .. && git add metamorfosis-web/src/components/Hero.astro \
                metamorfosis-web/src/styles/global.css \
                specs/SPEC-106-fix-stats-row-mobile.md
git commit -m "fix(spec-106): stats row Hero flex-wrap mobile + overflow-x defense"
git push
```

**Smoke post-deploy (90-120s):**

1. Mobile 375px en DevTools (Chrome → device toolbar → iPhone SE):
   - Botón hamburguesa visible en navbar.
   - Click → menú abre.
   - Stats row del Hero apilado en múltiples líneas sin overflow.
   - No scroll horizontal del body.
2. Desktop ≥768px:
   - Stats row en 1 línea con 3 tiles + 2 separators (como antes).
3. PageSpeed Insights mobile en `/`:
   - 3 mediciones consecutivas.
   - Performance esperado: ≥88. Si recupera a >90, fix confirmado.
   - Si queda en 84-87 igual, hay otra causa que abordamos en spec separada.
