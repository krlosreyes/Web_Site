# SPEC-103 — Breadcrumb "Volver al dashboard" en Plan IMR 14d

**Estado:** 🔨 En progreso (código listo, pendiente: `npm run build` + commit + push)
**Fase:** Bloque B del plan estratégico (UX polish del plan)
**Severidad:** MEDIO (UX gap detectado por Carlos en validación post-SPEC-101)
**Fecha de creación:** 2026-05-19
**Autor:** Carlos Reyes
**Depende de:** SPEC-100 (página del plan), SPEC-101 (progresión)

---

## Contexto

Tras implementar SPEC-100 + SPEC-101, Carlos observó que el usuario que está en `/dashboard/plan` con un plan en curso (ej. día 5 de 14) **no tiene un affordance claro para volver al dashboard**. El único botón "Volver a tu dashboard →" existe pero vive dentro de la card de cierre, que solo aparece cuando el usuario completa los 14 días. Hasta entonces, está atrapado en el plan sin breadcrumb evidente.

Verificado: `grep "/dashboard"` en `Plan14d.tsx` retorna solo el botón de cierre (línea 485-488).

## Problema

El usuario que abre `/dashboard/plan` y luego quiere volver a su dashboard principal depende del navbar global (que tiene link genérico a la home) o del browser back. No hay un breadcrumb en la página que indique "estás en una sub-vista del dashboard". Pequeño gap UX que puede generar fricción y abandono.

## Solución propuesta

Agregar un breadcrumb sutil **al inicio del render principal del plan** (antes del header con título y barra de progreso), con copy y diseño consistentes con el resto del sitio:

```
← Volver al dashboard
```

- Visible solo en el estado "plan con progreso" (en curso o finalizado).
- NO se agrega en estados `needsAuth` (CTA a /login es prioridad) ni `needsImr` (CTA a /quiz es prioridad).
- NO se agrega en `loading` (skeleton).
- Tracking declarativo `data-umami-event="cta_volver_dashboard_desde_plan"`.
- Mantiene el botón existente en la card de cierre (no se duplica visualmente porque vive en sección distinta del scroll).

## Plan de implementación

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1 | Agregar bloque `<a href="/dashboard">` con flecha SVG, copy "Volver al dashboard", tracking Umami, antes del header del plan | `src/components/Plan14d.tsx` | 10 min |
| 2 | Verificar mobile + desktop | sandbox | 5 min |
| 3 | Commit + push | git | 5 min |

**Esfuerzo total:** ~20 min.

## Criterios de aceptación

- [ ] El breadcrumb aparece en `/dashboard/plan` cuando el usuario tiene IMR válido (estado de progreso o finalizado).
- [ ] Click navega a `/dashboard` sin perder estado (Firestore preserva progreso).
- [ ] No aparece en estados `loading`, `needsAuth`, `needsImr`.
- [ ] Estilo sutil (no compite visualmente con el título del plan ni con el día actual).
- [ ] Mobile 375px: legible, no se desborda.
- [ ] Tracking Umami `cta_volver_dashboard_desde_plan` se dispara al click.
- [ ] Build limpio.
- [ ] Copy en tuteo neutro.

## Pruebas manuales

1. Logueado con IMR → entrar a `/dashboard/plan` → breadcrumb visible arriba.
2. Click breadcrumb → llega a `/dashboard`.
3. Volver al plan → estado de progreso preservado.
4. Logout → `/dashboard/plan` → muestra CTA login (sin breadcrumb).
5. Verificar mobile: breadcrumb no se desborda.

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Duplicación visual con el botón "Volver a tu dashboard →" del estado finalizado | Baja | El breadcrumb vive arriba (header); el botón de cierre vive abajo (final del scroll, post día 14). No compiten visualmente |
| Usuario confundido entre el navbar global y el breadcrumb | Baja | Estándar de la industria — todo sitio con sub-vistas usa breadcrumbs |

## Commit sugerido

```
feat(spec-103): breadcrumb "Volver al dashboard" en /dashboard/plan

- Agregar link arriba del header del plan, visible cuando el usuario
  tiene IMR y plan accesible (en curso o finalizado).
- Tracking Umami: cta_volver_dashboard_desde_plan.

Cierra specs/SPEC-103-plan14d-breadcrumb-dashboard.md
```

## Resultado

**Implementación 2026-05-19 — código aplicado:**

- `src/components/Plan14d.tsx`: agregado bloque `<a href="/dashboard">`
  con flecha SVG (arrow-left de Lucide-style), copy "Volver al
  dashboard", tracking `data-umami-event="cta_volver_dashboard_desde_plan"`,
  como primer elemento del render principal (línea 282).
- Estilo: `text-sm font-medium text-text-secondary hover:text-accent
  transition-colors`. Sutil, no compite visualmente con el título
  del plan ni el día actual.
- Se preserva el botón existente de la card de cierre (línea 501,
  estado `finished`). Coexisten en distintas secciones del scroll
  sin duplicación visual.

**Verificaciones pasadas en sandbox:**

- Braces 110/110 y parens 133/133 balanceados.
- 2 referencias a `/dashboard` confirmadas: breadcrumb (línea 284) +
  botón de cierre (línea 501).
- Tracking nuevo `cta_volver_dashboard_desde_plan` presente.

**Pendiente para Carlos antes del commit:**

1. Build local:
   ```bash
   cd metamorfosis-web && npm run build
   ```

2. Commit + push:
   ```bash
   git add metamorfosis-web/src/components/Plan14d.tsx \
           specs/SPEC-103-plan14d-breadcrumb-dashboard.md
   git commit -m "feat(spec-103): breadcrumb Volver al dashboard en /dashboard/plan"
   git push
   ```

3. Smoke post-deploy:
   - Logueado con IMR en curso → `/dashboard/plan` → breadcrumb visible arriba.
   - Click → llega a `/dashboard`, vuelve al plan → progreso preservado.
   - Mobile 375px: breadcrumb no se desborda.
