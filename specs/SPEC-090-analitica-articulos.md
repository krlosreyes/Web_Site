# SPEC-090 — Tablero de analítica de artículos en el admin

**Estado:** ✅ Cerrada (pendiente de `npm test` + `npm run build` + commit local)
**Fase:** Pre-lanzamiento — herramientas operativas editoriales
**Severidad:** MEDIO (la pantalla actual no aporta valor; bloquea decisiones editoriales)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-086 (counters reales en posts), SPEC-024 (completedQuizzes en users)

---

## Contexto

El admin tiene la pantalla "Analítica IMR" que muestra distribución
poblacional de IMR a partir de la colección `pruebas` (users
sintéticos). Hoy está vacía porque no hay registros de prueba, y de
todos modos esos números no responden la pregunta editorial real de
Carlos:

> "¿Qué artículo está funcionando? ¿Qué quiz tiene más completions?
> ¿Quién es mi power-reader?"

Necesitamos un tablero distinto, dedicado a la performance de los
artículos, alimentado con la data que YA estamos persistiendo gracias
a SPEC-086 y al schema canónico.

## Problema

No hay forma desde el admin de ver qué artículo está performando.
Carlos toma decisiones editoriales a ciegas o tiene que mirar Umami
(que no tiene los counters de quiz completions ni el detalle por
artículo).

## Solución propuesta

Agregar un nuevo tab "Analítica de artículos" en el sidebar del admin,
separado del actual "Analítica IMR" (que se mantiene para calibración
del motor). El nuevo tablero presenta:

### Data ya disponible (no requiere tracking nuevo)

1. **KPIs globales** (4 cards arriba):
   - Total de vistas acumuladas (suma de `analytics.views`).
   - Total de clicks (suma de `analytics.clicks`).
   - Engagement rate global (clicks / views como %).
   - Total de quiz completions (suma de entries en
     `users/*/completedQuizzes`).

2. **Top artículos** (tabla principal):
   - Columnas: Título, Pilar, Vistas, Clicks, Engagement %,
     Quiz completions, Score promedio del quiz, Estado.
   - Sorteable por cada columna numérica.
   - Click en una fila → drilldown al editor del artículo
     (re-aprovecha `ArticleEditor` ya existente).

3. **Top usuarios lectores** (tabla):
   - Top 10 users por cantidad de quizzes completados.
   - Columnas: Email, Artículos completados, Score promedio.

4. **Distribución por pilar** (barchart):
   - Vistas y clicks agregados por pilar (Estructura / Metabolismo /
     Conducta / Sin pilar).

5. **Listas accionables**:
   - "Artículos zombie": publicados con 0 vistas (oportunidad de
     promoción).
   - "Artículos sin quiz": publicados sin preguntas embebidas
     (oportunidad de retener mejor).

6. **Filtros** (controles arriba de la tabla principal):
   - Pilar (todos / Estructura / Metabolismo / Conducta / sin pilar).
   - Estado (todos / publicado / draft).

### Out of scope (SPECs futuras)

- Tiempo de lectura por artículo (requiere tracking nuevo: sumar
  segundos en el cliente, persistir via sendBeacon al desmontar).
- Scroll depth promedio (persistir el flag `imr_article_read` ya
  existente como counter en Firestore).
- Time-series de vistas (cambiar schema de `analytics.views` a
  `analytics.viewsByDay: {YYYY-MM-DD: number}`).
- Funnel de conversión view → quiz iniciado → quiz completado por
  artículo (requiere agregar prop `slug` a los Umami events de
  SPEC-084, o tracking propio).

## Plan de implementación

1. **Crear** `src/pages/api/admin/article-analytics.ts` — endpoint
   GET protegido por cookie admin que retorna:
   - `kpis: { totalViews, totalClicks, totalQuizzes, articlesPublished }`
   - `topArticles: ArticleMetric[]` con todos los campos para la
     tabla principal.
   - `topReaders: ReaderMetric[]` (top 10 por completedQuizzes).
   - `byPillar: PillarMetric[]` (aggregate por pilar).
   - `zombies: { id, title, slug, publishedAt }[]` (publicados con
     `analytics.views === 0`).
   - `withoutQuiz: { id, title, slug }[]` (publicados sin
     `quiz` o con `quiz: []`).
2. **Crear** `src/components/admin/ArticleAnalytics.tsx` — componente
   React con todas las secciones de arriba. Reutiliza estilos del
   admin existente (`bg-bg-surface`, accent teal, etc).
3. **Modificar** `src/components/admin/AdminApp.tsx`:
   - Agregar `'ARTICLE_ANALYTICS'` al type `AdminTab`.
   - Botón nuevo en el sidebar "Analítica artículos".
   - Lazy import + Suspense fallback.
   - Agregar `ARTICLE_ANALYTICS` a la lista de tabs que ocultan
     `StatsGrid`.
   - Handler de "Editar artículo" reutilizando `handleEdit`
     existente para el drilldown.
4. **Test** `src/pages/api/admin/article-analytics.test.ts` — tests
   unitarios de las funciones puras de agregación (no requieren
   Firebase). Validar conteos, ordenamiento, promedios, edge cases
   (sin posts, sin users, posts sin analytics).

## Criterios de aceptación

- [ ] `npm test` pasa.
- [ ] `npm run build` no lanza errores.
- [ ] Tab nuevo "Analítica artículos" aparece en el sidebar del admin
      entre "Gestión de artículos" y "Analítica IMR".
- [ ] Click en el tab dispara fetch al endpoint y muestra spinner
      mientras carga.
- [ ] KPI cards muestran números reales agregados desde Firestore.
- [ ] Tabla "Top artículos" tiene sort funcional en columnas numéricas.
- [ ] Click en una fila lleva al editor de ese artículo (drilldown).
- [ ] Filtros de pilar y estado funcionan client-side sin re-fetch.
- [ ] Listas "Zombie" y "Sin quiz" aparecen solo si hay artículos en
      esa categoría (no mostrar secciones vacías).
- [ ] El endpoint responde 401 si la cookie admin no es válida.

## Pruebas

```sh
cd metamorfosis-web && npm test
cd metamorfosis-web && npm run build

# Smoke post-deploy:
#   1. Logueate al admin → sidebar tiene "Analítica artículos".
#   2. Click → ver KPIs, tabla top, top readers, listas accionables.
#   3. Probar sort por cada columna numérica.
#   4. Filtrar por pilar → solo ese pilar aparece.
#   5. Click en un artículo → abre el editor de ese artículo.
#   6. Cerrar editor → volver al tab sin perder estado.
```

## Riesgos / consideraciones

- **Performance del endpoint:** agregar `completedQuizzes` requiere
  leer TODOS los docs de `users`. Hoy son pocos, escala bien hasta
  ~1000 users. Si crecemos, mover a Cloud Function con índice
  invertido o cache.
- **Datos cero al principio:** muchos artículos van a tener
  `analytics.views: 0` porque solo desde SPEC-086 estamos contando.
  El tablero los muestra como "—" (igual que PostList).
- **Drilldown al editor:** reaprovechamos `handleEdit` de AdminApp
  pasando el post completo. Eso requiere que el endpoint devuelva
  los campos que `ArticleEditor` espera (`title, slug, content,
  references, quiz, images, status`). Lo incluimos.
- **Sort client-side:** todo el sort se hace en memoria. La tabla
  no pagina (limita a top 50 artículos en el endpoint).

## Commit

**Mensaje sugerido:**
```
feat(spec-090): tablero de analítica de artículos en el admin

- Endpoint GET /api/admin/article-analytics que agrega:
  - KPIs (totales: vistas, clicks, quizzes, publicados)
  - Top artículos (con engagement %, quiz score promedio)
  - Top usuarios lectores (por completedQuizzes)
  - Distribución por pilar
  - Listas accionables: zombies y sin-quiz
- Componente ArticleAnalytics.tsx con sort + filtros + drilldown.
- Tab nuevo "Analítica artículos" en el sidebar del admin.
- Tests unitarios de las funciones de agregación.

Cierra specs/SPEC-090-analitica-articulos.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**Archivos tocados (5):**
- `src/lib/admin/articleAnalytics.ts` (nuevo) — agregador pure-TS:
  `indexQuizzesByArticle`, `buildArticleMetric`, `buildTopReaders`,
  `buildPillarBreakdown`, `findZombies`, `findWithoutQuiz`,
  `buildAnalyticsResponse`. Sin dependencias de Firebase.
- `src/lib/admin/articleAnalytics.test.ts` (nuevo) — 22 tests con
  vitest cubriendo cada función pura + el pipeline completo.
- `src/pages/api/admin/article-analytics.ts` (nuevo) — endpoint GET
  protegido por cookie admin. Lee posts y users de Firestore, delega
  el aggregate al módulo puro.
- `src/components/admin/ArticleAnalytics.tsx` (nuevo) — UI:
  - 4 KPI cards (vistas, clicks, engagement global, quizzes).
  - Distribución por pilar con barchart inline.
  - Tabla "Top artículos" con sort por 5 columnas y filtros
    (pilar / estado). Drilldown al editor via `onEditArticle` prop.
  - Tabla "Top lectores" (10 users con más quizzes).
  - Listas accionables: zombies + sin-quiz (se ocultan si están
    vacías).
- `src/components/admin/AdminApp.tsx` — nuevo tab
  `ARTICLE_ANALYTICS` en sidebar entre "Gestión de artículos" y
  "Analítica IMR". Lazy import + Suspense. Reutiliza `handleEdit`
  para el drilldown desde la tabla.

**Decisiones clave:**
- **Funciones puras separadas del endpoint:** permite testear
  agregaciones sin Firebase y reaprovecharlas si en el futuro pasan
  a Cloud Function.
- **engagementPct/avgQuizScore = -1 cuando no se puede calcular:**
  evita división por cero. La UI muestra "—" para ese caso.
- **Posts sin pilar agrupados en `sin-pilar`:** ningún post se pierde
  del breakdown.
- **Top readers limitado a 10:** suficiente para una vista
  ejecutiva sin paginación.
- **Drilldown reutiliza `handleEdit`:** el componente padre AdminApp
  ya maneja la vista de editor; pasamos el doc raw como prop.
- TS transpile validation OK en los 5 archivos. `npm test` debe
  validar los 22 tests del agregador localmente.

**Indicadores entregados (8/8 del plan):**
1. ✅ Total vistas
2. ✅ Total clicks
3. ✅ Engagement rate global
4. ✅ Total quiz completions
5. ✅ Top artículos (tabla sorteable)
6. ✅ Top users lectores
7. ✅ Distribución por pilar
8. ✅ Listas accionables (zombies + sin quiz)

**Indicadores pendientes para SPECs futuras:**
- Tiempo de lectura promedio por artículo (requiere tracking nuevo
  via sendBeacon al desmontar la página).
- Scroll depth promedio (persistir `imr_article_read` como counter
  en Firestore).
- Time-series de vistas (cambiar schema a `viewsByDay`).
- Funnel view → quiz → registro por artículo (agregar prop `slug`
  a los Umami events de SPEC-084).

**Smoke plan post-deploy:**
1. Logueate al admin → sidebar tiene "Analítica artículos" entre
   "Gestión de artículos" y "Analítica IMR".
2. Click → ver loader, después KPIs y tablas.
3. Probar sort por cada columna numérica (vistas/clicks/engagement/
   quizzes/score).
4. Filtrar por pilar → solo ese pilar en la tabla.
5. Filtrar por estado → solo publicados (o drafts, según selección).
6. Click "Editar" en una fila → abre el editor de ese artículo.
7. Cancelar editor → volver al tablero.
8. Verificar que listas "Zombie" y "Sin quiz" muestran solo cuando
   hay artículos en esa categoría.
