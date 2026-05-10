# SPEC-017 — Analítica IMR integrada al dashboard

**Estado:** ✅ Cerrada
**Fase:** 4
**Severidad:** MEDIO (UX operacional)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** ninguna

---

## Contexto

`AnaliticaIMR.tsx` es el componente más rico del admin: pie/bar/scatter charts sobre la collection `pruebas` (datos analíticos sintéticos del motor IMR). Hoy vive en una página propia `/admin/analitica-imr.astro` con su header y layout duplicados del dashboard.

El sidebar del dashboard linkea a esa página con un `<a href="/admin/analitica-imr">` que rompe la SPA-feel: cada vez que Carlos quiere ver la analítica, sale del dashboard y vuelve, perdiendo el estado de los demás tabs.

## Problema

1. **Fricción de navegación.** Tres pasos para ver analítica: volver al dashboard → cargar analítica → cargar de vuelta el dashboard al volver. Cada uno paga reload + refetch.
2. **UI duplicada.** El header `Mission Control` se repite en dos `.astro` distintos. Si cambia, hay que actualizar ambos.
3. **Pérdida de contexto al cambiar de vista.** Si Carlos está editando un artículo y quiere chequear un dato de analítica, pierde el draft (a menos que esté guardado).

## Solución propuesta

### 1. Tab nuevo `ANALYTICS` dentro de `AdminApp`

Extender el union de `activeTab` a `'ARCHIVE' | 'LEADS' | 'ANALYTICS'`. Agregar un botón en el sidebar idéntico estructuralmente a los otros dos tabs, con paleta púrpura para diferenciarlo (matching con la pill `Analítica IMR` del header original).

### 2. Lazy loading del componente

`AnaliticaIMR` importa Recharts (varios chart types) y hace fetch + cálculo del motor IMR sobre cada doc. Cargarlo eager penaliza el load del dashboard incluso para usuarios que solo quieren ver leads.

Solución: `React.lazy(() => import('./AnaliticaIMR'))` + `<Suspense fallback={<spinner/>}>`. Como el dashboard ya monta con `client:only="react"`, el lazy split funciona out-of-the-box.

### 3. Deeplink preservado

`/admin/analitica-imr.astro` queda como ruta secundaria sin cambios. Útil para:
- Compartir URL específica con un colaborador futuro.
- Abrir analítica en pestaña aparte mientras el dashboard sigue abierto.
- Bookmark.

No la borro — el costo de mantenerla es nulo (es un wrapper liviano sobre el componente) y aporta opcionalidad.

### 4. Visibilidad del StatsGrid

Cuando el tab activo es `ANALYTICS`, ocultamos el `StatsGrid` superior. Razón: la analítica IMR ya tiene su propio set de métricas (más profundas) y el StatsGrid arriba se siente redundante. Con LEADS y ARCHIVE sí lo dejamos visible.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Editar `metamorfosis-web/src/components/admin/AdminApp.tsx`:
   - Extender el union de `activeTab`.
   - Convertir el `<a>` externo del sidebar en `<button>` interno.
   - `React.lazy` import de `AnaliticaIMR` + Suspense en el render.
   - Ocultar `StatsGrid` cuando `activeTab === 'ANALYTICS'`.
3. Build local (`npm run build` desde `metamorfosis-web/`).
4. Commit + push.
5. Verificación visual.

## Criterios de aceptación

- [x] Click en "Analítica IMR" del sidebar cambia el tab sin cambiar de URL.
- [x] El componente se monta on-demand (lazy split visible en la network tab del browser).
- [x] El header "Mission Control" no parpadea ni se duplica al cambiar de tab.
- [x] El sidebar muestra el tab activo con el styling púrpura cuando ANALYTICS está activo.
- [x] El deeplink `/admin/analitica-imr` sigue funcionando como antes.
- [x] StatsGrid se oculta cuando el tab es ANALYTICS y reaparece al volver a otro tab.

## Pruebas manuales

1. Login admin → `/admin/dashboard` → ver sidebar con 3 tabs (Leads, Artículos, Analítica IMR).
2. Click en "Analítica IMR" → carga el componente (puede haber un breve spinner la primera vez por el lazy import).
3. Click en "Gestión de Artículos" → vuelve sin recargar.
4. Click de vuelta en "Analítica IMR" → instant (ya está cacheado por React).
5. Refrescar mientras estás en ANALYTICS → vuelve al tab default (ARCHIVE). El estado del tab no se persiste — out of scope.
6. Abrir manualmente `/admin/analitica-imr` → sigue funcionando como ruta directa.
7. Abrir Network tab → confirmar que `AnaliticaIMR` chunk solo se descarga al activar el tab.

## Riesgos y trade-offs

- **Lazy loading puede confundir si el spinner aparece muy poco tiempo.** Mitigado con un fallback minimal y consistente con el resto del admin.
- **El estado del tab no persiste tras refresh.** Decisión consciente: persistirlo en localStorage es trivial pero no aporta valor inmediato. Si Carlos lo pide, una iteración futura.
- **Recharts queda en el bundle del dashboard.** Antes vivía solo en la página de analítica. Pero el tradeoff es mínimo: Recharts ya estaba en el bundle del StatsGrid (sparklines de SPEC-019), así que el chunk principal no crece de forma significativa.

## Compatibilidad con ElenaApp

100% del lado web admin. Sin acoplamiento.

## Commit

```
feat(spec-017): integra analitica imr al dashboard como tab

- AdminApp con 3 tabs: Leads, Artículos, Analítica IMR
- AnaliticaIMR cargado con React.lazy + Suspense (chunk on-demand)
- Sidebar convierte el deeplink en tab interno (sin reload)
- StatsGrid se oculta cuando el tab es ANALYTICS (datos redundantes)
- /admin/analitica-imr preservada como deeplink secundario

Cierra SPEC-017.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/components/admin/AdminApp.tsx` — agregado tab `ANALYTICS` con import lazy de `AnaliticaIMR`, `<Suspense>` con fallback de spinner consistente, sidebar con botón interno (no `<a>`) y styling púrpura para el tab activo. Hide del `StatsGrid` cuando es ANALYTICS.

**Decisiones tomadas en la marcha:**
- **No persistir el tab en localStorage.** Refrescar vuelve al default. Si en el futuro Carlos quiere "abrir donde lo dejé", una línea con localStorage lo cubre.
- **Mantener `/admin/analitica-imr.astro` viva.** Borrarla es out-of-scope; su costo es cero y aporta deeplink + bookmark.
- **Spinner del Suspense** usa la misma paleta que los loaders existentes del admin (verde `#00C49A`, monospace).

**Sin desviaciones del plan.** Todos los criterios de aceptación quedan cumplidos.
