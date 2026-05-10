# SPEC-019 — Stats con filtros temporales + tendencias

**Estado:** ✅ Cerrada
**Fase:** 4
**Severidad:** ALTO (operación: medir el funnel para tomar decisiones de contenido)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-016b (CRM lee `users`, no `waitlist_leads`)

---

## Contexto

El componente `StatsGrid.tsx` muestra tres KPIs en el dashboard admin:

1. **Total artículos publicados** (lee `count()` de `metamorfosis_posts`).
2. **Conversión Test IMR** — número simulado entre 10-25% que **fluctúa cada 5s** con `Math.random()`. **Es mentira al admin.**
3. **Leads capturados** — lee `count()` de `waitlist_leads`, que está vacía post-SPEC-016b. Hoy muestra `0`.

Sin temporalidad, sin tendencias, sin filtros. El admin no puede responder preguntas básicas operativas:

- ¿Cuántos leads nuevos esta semana vs la pasada?
- ¿Qué semanas publico más artículos?
- ¿El IMR promedio de los nuevos users está subiendo o bajando?
- ¿La home convierte mejor en lunes o en domingo?

## Problema

1. **Métricas inertes** — números globales sin rango temporal son ciegos al ritmo del funnel.
2. **`conversionRate` simulado** — la card de "Conversión Test IMR" es UI demo, no datos reales. Hace daño porque el admin podría tomar decisiones basadas en la animación.
3. **`totalLeads` apunta a la collection equivocada** — post-SPEC-016b los users viven en `users/{uid}`, pero `stats.ts` sigue leyendo `waitlist_leads`. Resultado: el card siempre dice 0.
4. **Sin tendencias** — para entender si una decisión funciona necesitás ver evolución, no totales.

## Solución propuesta

### 1. Endpoint `GET /api/admin/stats?range=7d|30d|90d|all`

Reescritura completa. Devuelve totales + series temporales según el rango.

```ts
{
  success: true,
  range: "7d" | "30d" | "90d" | "all",
  rangeLabel: "Últimos 7 días" | ...,
  totals: {
    posts: number,           // total artículos publicados (status='published')
    drafts: number,          // borradores actuales
    users: number,           // total users en la collection
    newUsersInRange: number, // creados en el rango
    imrAvg: number | null,   // promedio IMR en el rango (null si no hay)
    imrCount: number,        // cantidad de IMR scores en el rango
  },
  series: {
    newUsersByDay: [{ date: "2026-05-04", count: 1 }, ...],
    postsByDay: [{ date, count }, ...],   // por publishedAt
    imrByDay: [{ date, avg, count }, ...] // promedio IMR diario
  }
}
```

**Reglas de agrupación:**
- `range=7d|30d|90d` → bucket diario (`YYYY-MM-DD`).
- `range=all` → bucket mensual (`YYYY-MM`) para no devolver series gigantes.
- Buckets sin datos se incluyen con `count: 0` para que las sparklines no tengan huecos.

**Defensa:** si Firestore se queja por falta de índice compuesto sobre `meta.createdAt`, fetch sin filter + filtrado in-memory (los datasets actuales son < 1k docs, asumible).

### 2. Frontend `StatsGrid.tsx` reescrito

**Estructura:**

- **Chips de rango** arriba (Hoy / 7d / 30d / 90d / Todo). Persistir el seleccionado en `localStorage` para que sobreviva refrescos.
- **3 cards principales** con KPI + sub-line + sparkline (Recharts):
  1. **Artículos publicados** — total + "(N en borrador)" + sparkline `postsByDay`.
  2. **Users captados (en rango)** — newUsersInRange + "(total: X)" + sparkline `newUsersByDay`.
  3. **IMR promedio (en rango)** — imrAvg + "(N quizzes)" + sparkline `imrByDay`.
- **Eliminar `conversionRate` simulado.** Sin reemplazo: el ratio "captura email / abrió el quiz" requeriría tracking de eventos que no tenemos. Mejor sin métrica que con métrica falsa.

**Recharts:** usar `LineChart` + `Line` con `dot=false` y `strokeWidth=2`. Gradiente sutil debajo (`Area`) para impacto visual sin saturar. Tooltip simple con fecha + valor.

### 3. Cambio incompatible (`waitlist_leads` → `users`)

`stats.ts` ahora lee la collection `users` para totales de leads. Esto cierra el loop de SPEC-016b y elimina el último consumidor de `waitlist_leads` para métricas.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Reescribir `metamorfosis-web/src/pages/api/admin/stats.ts`:
   - Auth gate (sin cambios).
   - Calcular `startISO` según `range`.
   - Fetch concurrente: `posts` con count + `posts` published-in-range + `users` in-range.
   - Agrupar por bucket (día o mes según range).
   - Devolver shape canónico.
3. Reescribir `metamorfosis-web/src/components/admin/StatsGrid.tsx`:
   - Rango controlado con `useState` + persistencia en localStorage.
   - Refetch al cambiar de rango.
   - 3 cards con KPI + sparkline.
4. Build local (`npm run build` desde `metamorfosis-web/`).
5. Commit + push directo a `main`.
6. Verificación visual del dashboard en producción.

## Criterios de aceptación

- [ ] Cambiar el chip de rango refetcha y actualiza KPIs + sparklines.
- [ ] El rango seleccionado persiste tras refresh.
- [ ] `Total Artículos Publicados` muestra número real (filtra `status='published'`).
- [ ] `Drafts` aparece en sub-line del card de artículos.
- [ ] `Users captados` muestra delta del rango + total absoluto.
- [ ] `IMR promedio` muestra valor real con `imr.current.imrScore`.
- [ ] Sin barras hardcoded ni `conversionRate` random.
- [ ] Sparklines renderizan al menos 7 puntos en `range=7d`, 30 en `30d`, etc.
- [ ] Si la sesión admin caducó, el endpoint devuelve 401 y el frontend redirige a login.
- [ ] `range=all` agrupa por mes, no por día.

## Pruebas manuales

1. Login admin → `/admin` → ver el grid con range default (30d).
2. Cambiar a "7d" → refetch + KPIs cambian + sparklines se acortan.
3. Refrescar la página → el chip "7d" sigue activo (localStorage).
4. Crear un draft de artículo nuevo → al refrescar, el contador de "Drafts" sube en el sub-line.
5. Crear/editar publicar un artículo → el contador de "publicados" sube en `range=7d`.
6. Hacer un quiz IMR como user nuevo → en el siguiente refresh aparece en el sparkline `newUsersByDay`.
7. Cambiar a `range=all` → sparklines pasan a buckets mensuales.
8. Cerrar sesión admin → reload → redirige a `/admin/login`.

## Riesgos y trade-offs

- **Sin paginación en posts/users:** asumimos < 1000 docs hoy. Si crece, query con `where('meta.createdAt', '>=', start)` + `limit(2000)` previene sobrecargar. Para `range=all`, sin filter + cap a 2000 docs (suficiente para los próximos 18 meses al ritmo actual).
- **Índice de Firestore:** la primera ejecución de `where('meta.createdAt', '>=', X)` puede pedir crear índice. Documentar en el Resultado si Firebase emite un mensaje y crearlo desde la Console.
- **Eliminar `conversionRate` puede sentirse como pérdida visual.** Mitigado con la sparkline que ocupa el mismo espacio y aporta info real.
- **Bucket vacío como `count: 0`:** decisión consciente. Sparkline con huecos confunde más que un cero.

## Compatibilidad con ElenaApp

100% del lado admin web. ElenaApp ignora `/api/admin/*`. Sin acoplamiento.

## Commit

```
feat(spec-019): stats con filtros temporales y sparklines reales

- Endpoint /api/admin/stats acepta ?range=7d|30d|90d|all
- Devuelve totals (posts/drafts/users/newUsersInRange/imrAvg/imrCount)
  + series (newUsersByDay/postsByDay/imrByDay) bucketeadas por día o mes
- StatsGrid con chips de rango (persistidos en localStorage),
  3 cards KPI + sparkline (Recharts), elimina conversionRate simulado
- Lee `users` (no waitlist_leads legacy) — cierra loop de SPEC-016b

Cierra SPEC-019.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/api/admin/stats.ts` — reescritura completa. Acepta `?range=7d|30d|90d|all`. Devuelve `totals` (posts/drafts/users/newUsersInRange/imrAvg/imrCount) + `series` (newUsersByDay, postsByDay, imrByDay) bucketeadas por día (rangos finitos) o mes (`all`). Cuenta drafts con su propia query separada. Defensa con fallback in-memory si el índice de `meta.createdAt` no existe.
- `metamorfosis-web/src/components/admin/StatsGrid.tsx` — reescritura completa. Chips de rango persistidos en localStorage (`admin_stats_range`). 3 cards KPI con sparkline (Recharts AreaChart con gradient). Tooltip custom en paleta del dashboard. Eliminado el `conversionRate` simulado y la mini-bar hardcoded.

**Decisiones tomadas en la marcha:**
- **Buckets vacíos como `count: 0`** en el endpoint, no como huecos. Las sparklines se ven más prolijas y el admin reconoce inmediatamente "este día no tuve nada" sin ambigüedad.
- **`range=all` agrupa por mes** y se cappea a 24 buckets (2 años). Si el proyecto crece más allá, agregar `?cap=N` query param.
- **Cap de 2000 docs por query** para no romper performance en el peor caso. Hoy tenemos < 200 docs en cualquier collection; queda margen amplio.
- **`Sparkline` componente reutilizable** con prop `gradientId` distinto por instancia (Recharts comparte el SVG defs en el DOM y los gradients colisionan si comparten id).
- **Eliminé `conversionRate` sin reemplazo.** Calcular tasa real de conversión necesita tracking de "abrió el quiz" vs "completó + dejó email", lo cual no tenemos. Mejor sin métrica que con métrica falsa. Si en el futuro Carlos suma analytics (Plausible/Umami), agregamos la métrica real.
- **Connect nulls en el sparkline IMR** porque los días sin quiz dejan `avg: null` y la línea queda continua.

**Compatibilidad:**
- El endpoint acepta `range` desconocido (default a `30d`) y recupera el rango si llega vacío.
- Si Firestore se queja por índice ausente (ej. `meta.createdAt`), el fallback in-memory cubre el caso. El admin tendrá que crear el índice desde la Console solo si el dataset crece y la query nativa se vuelve preferible. Hoy la diferencia es invisible.

**Sin desviaciones del plan funcional.** Todos los criterios de aceptación quedan cumplidos.
