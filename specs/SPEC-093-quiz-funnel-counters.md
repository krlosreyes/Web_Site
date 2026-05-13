# SPEC-093 — Funnel del quiz IMR (start → complete → register)

**Estado:** ✅ Cerrada (pendiente de `npm test` + `npm run build` + commit local)
**Fase:** Pre-lanzamiento — diagnóstico de abandono
**Severidad:** ALTO (Carlos pidió identificar quiénes abandonan antes del registro)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-084 (Umami events similares), SPEC-090 (tablero), SPEC-091 (exclusión admin)

---

## Contexto

Carlos pidió un indicador que ayude a identificar usuarios que
"visitan el sitio, intentan el test IMR pero desisten de registrarse".
Hoy SPEC-084 trackea esos eventos en Umami (`quiz_iniciado`,
`quiz_completado`, `registro_completado`), pero esos números solo
están visibles en el dashboard de Umami, no en el tablero del admin
del sitio.

Necesitamos:
1. **Contar el funnel completo** del quiz dentro de Firestore.
2. **Visualizar la tasa de abandono** en cada paso del funnel en el
   tablero `ArticleAnalytics` del admin.

Limitación honesta: los usuarios que abandonan ANTES de registrarse
son anónimos por definición (no tienen cuenta). NO podemos
"identificarlos" nominalmente para retargeting; solo podemos contar
la magnitud del abandono. Si en el futuro quisiéramos retargear,
habría que pedir email PRE-resultado del quiz (decisión de producto,
fuera del scope de esta SPEC).

## Problema

No hay forma desde el admin de ver cuántos usuarios empiezan el quiz
pero abandonan antes de completarlo, ni cuántos lo completan pero no
se registran.

## Solución propuesta

Contadores atómicos en Firestore (`system/counters.quizFunnel.*`)
incrementados desde el cliente vía endpoint público con `sendBeacon`
(fire-and-forget, igual que SPEC-086 clicks).

**Schema:**
```
system/counters:
  founderCount: number     // existente, SPEC-056
  quizFunnel:               // NUEVO, SPEC-093
    started: number          // clicks en "Iniciar mi diagnóstico"
    completed: number        // quiz llegado al final (handleFinish)
    registered: number       // cuenta creada desde el flujo del quiz
```

**Métricas derivadas (en el endpoint admin):**
- `dropOffAtQuiz = started - completed` — empezaron pero abandonaron
  durante las preguntas.
- `dropOffAtRegister = completed - registered` — terminaron quiz pero
  NO se registraron. **Este es el KPI clave** que Carlos pidió.
- `conversionRate = registered / started` — funnel completo end-to-end.

**Endpoint público:** `POST /api/quiz/funnel`, body `{ event:
'started' | 'completed' | 'registered' }`. Acepta sendBeacon. Excluye
admin (`admin_session`) y self-exclusion (`mr_admin_self`).

**Endpoint admin:** se extiende `/api/admin/article-analytics` para
incluir el funnel en su payload. Sin endpoint nuevo: una sola fetch
del admin trae todo lo que el tablero necesita.

**UI:** sección nueva "Funnel del quiz" en `ArticleAnalytics.tsx`
arriba del top de artículos, con 3 KPI cards (started/completed/
registered) + 2 cards de abandono (drop-off at quiz / at register) +
una barra de conversión visual.

### Alternativas descartadas

- **Pull desde Umami API:** ya tenemos los eventos en Umami por
  SPEC-084. Razones para NO usarlo: (a) requiere API key + setup;
  (b) latencia adicional en el admin; (c) si Umami queda offline o
  cambiamos de analytics, el admin queda ciego. Counters propios son
  self-contained.
- **Trackear con Umami events nuevos:** mismo problema. Adicional:
  no podemos correlacionar fácilmente con la data del propio sitio.
- **Persistir docs por sesión anónima:** sería útil para
  "identificar" individualmente al abandonador y eventualmente
  contactarlo, pero requiere pedir email pre-resultado. Decisión de
  producto. Diferido a SPEC futura si Carlos lo decide.

## Plan de implementación

1. **Crear** `src/lib/quizFunnel.ts` — helpers `incrementFunnel(event)`
   con `FieldValue.increment(1)` sobre `system/counters.quizFunnel.<event>`.
   Best-effort: try/catch + log, nunca propaga.
2. **Crear** `src/pages/api/quiz/funnel.ts` — endpoint POST público.
   Acepta `{ event }` en body. Excluye via `admin_session` y
   `mr_admin_self`. Responde 204 siempre.
3. **Modificar** `src/components/IMRQuiz.tsx`:
   - Step 0 click "Iniciar mi diagnóstico" → `sendBeacon` con
     `event: 'started'`.
   - `handleFinish` → `sendBeacon` con `event: 'completed'`.
   - `handleFinalRegister` éxito → `sendBeacon` con `event:
     'registered'`.
4. **Modificar** `src/lib/admin/articleAnalytics.ts`:
   - Tipo `QuizFunnelMetrics` con todos los counts + derivados.
   - Función `buildQuizFunnelFromCounter(rawCounter)` pura.
   - `AnalyticsResponse` extendido con `quizFunnel`.
5. **Modificar** `src/pages/api/admin/article-analytics.ts` — leer
   `system/counters` y pasar al builder.
6. **Modificar** `src/components/admin/ArticleAnalytics.tsx`:
   - Sección "Funnel del quiz" arriba del Top artículos, antes de
     "Distribución por pilar".
   - 3 KPI cards (started/completed/registered) en una fila.
   - Card destacado de "Abandono pre-registro" (lo que Carlos pidió).
   - Barra visual mostrando los 3 escalones del funnel.
7. **Tests** para las funciones puras del builder.

## Criterios de aceptación

- [ ] `npm test` pasa.
- [ ] `npm run build` no lanza errores.
- [ ] Click en "Iniciar mi diagnóstico" del quiz incrementa
      `quizFunnel.started`.
- [ ] Llegar al final del quiz incrementa `quizFunnel.completed`.
- [ ] Crear cuenta desde el quiz incrementa `quizFunnel.registered`.
- [ ] Si el dispositivo tiene `mr_admin_self=1` o `admin_session`
      válido, NINGÚN evento se cuenta (todos los pasos del funnel
      respetan la exclusión).
- [ ] El tablero muestra los 3 KPIs + abandono pre-registro
      destacado.
- [ ] Tasa de conversión global visible (registered/started).

## Pruebas

```sh
cd metamorfosis-web && npm test
cd metamorfosis-web && npm run build

# Smoke post-deploy (desde browser SIN ?mr-admin=1):
#   1. Abrir /quiz, anotar los counters actuales en Firestore Console.
#   2. Click "Iniciar mi diagnóstico" → started +1.
#   3. Completar los 8 substeps → completed +1.
#   4. Registrarse → registered +1.
#   5. Refrescar admin → ver counts y abandono actualizados.

# Smoke de exclusión:
#   1. Abrir /posts/algo?mr-admin=1 (activa cookie).
#   2. Repetir el flujo del quiz → counters NO suben.
```

## Riesgos / consideraciones

- **Race con concurrent escritures:** `FieldValue.increment` es
  atómico en Firestore, así que un pico de tráfico no rompe los
  counters. Vale aclarar que NO son time-series; si Carlos quiere
  "abandono esta semana vs el mes pasado" eso es otra SPEC.
- **Eventos perdidos por sendBeacon:** ad-blockers y privacy modes
  pueden bloquear la beacon. Aceptable: el funnel será directional,
  no ground truth perfecto. Umami sigue activo como segunda fuente.
- **Off-by-one entre Umami y counters propios:** los Umami events
  de SPEC-084 y los counters de SPEC-093 medirán cosas similares
  pero con dedupe distinto. Es esperable; usar uno u otro según el
  caso de uso (Umami para análisis profundo, counters para tablero
  del admin).
- **Sin reset:** una vez que started=100, no se puede "borrar el
  contador para empezar a medir limpio desde hoy". Si Carlos lo
  necesita en algún momento, podemos agregar `POST /api/admin/reset-
  quiz-funnel` con confirmación.

## Commit

**Mensaje sugerido:**
```
feat(spec-093): funnel del quiz IMR (start → complete → register)

- Counters atómicos en system/counters.quizFunnel.* via
  FieldValue.increment.
- Endpoint público POST /api/quiz/funnel acepta sendBeacon,
  excluye admin_session y mr_admin_self.
- IMRQuiz dispara los 3 eventos en los puntos correspondientes.
- ArticleAnalytics muestra el funnel arriba del top de artículos:
  3 KPIs + abandono pre-registro destacado + barra visual.
- Tests del builder puro.

Cierra specs/SPEC-093-quiz-funnel-counters.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**Archivos tocados (7):**
- `src/lib/quizFunnel.ts` (nuevo) — `incrementFunnel(event)` con
  `FieldValue.increment(1)` sobre `system/counters.quizFunnel.<event>`.
  Best-effort, nunca propaga.
- `src/pages/api/quiz/funnel.ts` (nuevo) — endpoint público POST,
  acepta sendBeacon, excluye admin_session y mr_admin_self.
- `src/components/IMRQuiz.tsx` — helper `fireFunnelEvent` que usa
  sendBeacon. Dispara `started` en step 0 click, `completed` en
  `handleFinish`, `registered` en `handleFinalRegister` exitoso.
- `src/lib/admin/articleAnalytics.ts` — tipo `QuizFunnelMetrics` con
  los 8 campos del funnel (counts + drop-offs + percentages).
  Función pura `buildQuizFunnel(rawCounter)`. `buildAnalyticsResponse`
  ahora acepta opcional `rawCounter` y lo pasa al builder.
- `src/lib/admin/articleAnalytics.test.ts` — 7 tests nuevos del
  builder del funnel + extensión de tests de `buildAnalyticsResponse`.
- `src/pages/api/admin/article-analytics.ts` — lee
  `system/counters` en paralelo a posts y users.
- `src/components/admin/ArticleAnalytics.tsx`:
  - Sección "Funnel del quiz IMR" antes de "Distribución por pilar".
  - `FunnelBar` con 3 barras horizontales proporcionales
    (started=100%, completed=%, registered=%).
  - 3 KPI cards de los pasos del funnel.
  - 2 cards de abandono: durante quiz (warning) y pre-registro
    (status-bad) — el segundo es el indicador clave que pidió Carlos.
  - Mensaje placeholder cuando started === 0.

**Decisiones clave:**
- **Counters propios en Firestore, no API de Umami:** evita
  dependencia externa, latencia menor en el admin, self-contained.
  Si en el futuro queremos correlacionar con Umami events (por
  ejemplo "abandono por fuente de tráfico"), agregamos endpoint
  específico.
- **Same path `system/counters` que founders:** reutiliza el doc
  ya existente; namespace `quizFunnel.*` evita colisión con
  `founderCount`.
- **sendBeacon en lugar de fetch:** sobrevive a la navegación
  (especialmente importante en `started`, que pasa del step 0
  al 1 inmediatamente).
- **dropOffAtQuiz y dropOffAtRegister con Math.max(0, ...):**
  defensa contra counters que queden raros (concurrencia o
  reset manual mal hecho).
- TS transpile validation OK en los 7 archivos.

**Lo que el indicador NO hace (decisión explícita):**
- No identifica usuarios nominalmente. Los que abandonan son
  anónimos y no podemos contactarlos sin pedir email
  pre-resultado (cambio de producto, fuera de scope).
- No es time-series. Si Carlos quiere "abandono esta semana vs
  el mes pasado", eso es otra SPEC con cambio de schema a
  `quizFunnel.byDay.{YYYY-MM-DD}.{event}`.
- No filtra bots: si un bot dispara sendBeacon, se cuenta. En
  pre-lanzamiento aceptable; revisar si crece el ruido.

**Smoke plan post-deploy:**
1. Tu mismo desde un browser SIN `?mr-admin=1`:
   - Abrir /quiz → click "Iniciar mi diagnóstico" → en Firestore
     Console, `system/counters.quizFunnel.started` debe haber
     subido +1.
   - Completar las 8 preguntas → `completed` sube +1.
   - Registrarse → `registered` sube +1.
2. En el admin → tab "Analítica artículos" → ver la sección
   "Funnel del quiz IMR" con los counts actualizados.
3. Repetir desde un browser CON `?mr-admin=1` previo activado
   → ningún contador sube (exclusión funciona).
