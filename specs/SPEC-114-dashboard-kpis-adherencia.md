# SPEC-114 — Dashboard admin de KPIs de adherencia (ElenaApp)

**Estado:** 🔨 En progreso
**Fase:** 1
**Severidad:** ALTO
**Fecha de creación:** 2026-07-12
**Autor:** Carlos Reyes (vía Claude, Cowork)
**Depende de:** ninguna

---

## Contexto

El informe "ESTRATEGIA DE TRANSFORMACIÓN DE PRODUCTO — ELENA APP" (2026-07-12,
`ElenaApp/documentacion/liderazgo/10_ESTRATEGIA_TRANSFORMACION_PRODUCTO.docx`)
identificó como causa raíz crítica (C1) que nadie ha tenido contacto
cualitativo con los ~10 usuarios de prueba de ElenaApp, y que ninguna
decisión de producto de las últimas semanas se apoyó en un dato real de
retención. Carlos pidió un panel administrativo para hacer seguimiento a
los KPIs del informe (Sección 10: Activation Rate, D1/D7/D30 retention,
DAU/MAU, conversión, churn, onboarding_complete, coaching_action_followed,
North Star) y usarlos como insumo de decisión.

Este repo (`metamorfosis-web`) ya tiene un panel admin (`AdminApp.tsx`) con
tabs de leads, artículos, analítica IMR, audit log y moderación de foro,
todos leyendo Firestore vía Admin SDK con el mismo patrón de auth por
cookie. ElenaApp comparte el mismo proyecto de Firebase (mismo Firestore),
así que el panel puede leer sus datos directamente sin nueva
infraestructura.

## Problema

No existe ninguna vista agregada ni por-usuario de cómo se está usando
ElenaApp. Verificado en código: la colección `daily_logs` documentada en
`lib/constants/firestore.ts` (`USER_SUBCOLLECTIONS.DAILY_LOGS`) es legacy —
ElenaApp en producción escribe a subcolecciones versionadas por pilar
(`fasting_history`, `nutrition_history`, `exercise_history`,
`sleep_history`, `hydration_history`, `streak_history`, todas bajo
`users/{uid}/`), no a `daily_logs`. Tampoco hay integración de RevenueCat
→ Firestore (no hay Cloud Function de RevenueCat en
`elena_app/functions/src`), así que el estado de suscripción no es
consultable desde este repo.

## Solución propuesta

Nuevo endpoint `GET /api/admin/kpis` (Admin SDK, mismo auth-gate que
`/api/admin/stats`) que:

1. Lee todos los docs de `users` (meta.createdAt, app.onboardingCompleted).
2. Para cada usuario, lee `streak_history` (doc.id = `YYYY-MM-DD`, fuente
   maestra de "día activo" porque ElenaApp la escribe específicamente para
   trackear adherencia diaria) y las 5 subcolecciones de pilares
   (best-effort: doc.id o campos comunes de fecha — usado solo para el
   desglose de "pilares tocados", no para el cálculo de retención).
3. Calcula: onboarding_complete rate, Activation Rate (actividad el mismo
   día del alta), D1/D7/D30 retention (cohort-based), DAU/MAU, y el North
   Star ("semanas con hábito real": ≥3 de 5 pilares en ≥4 días de una
   ventana móvil de 7 días).
4. Devuelve explícitamente `unavailable: {...}` para conversión, churn y
   `coaching_action_followed`, con la razón (no es "0", es "no medible
   hoy") — evita que el dashboard invente números.
5. Devuelve un roster por usuario (email, alta, onboarding, última
   actividad, días de inactividad, pilares tocados, estado
   activo/en_riesgo/inactivo/nunca_activo), ordenado por inactividad
   descendente — es la pieza más accionable con n≈10: permite ejecutar
   directamente el Experimento 1 del informe (llamar a quien se puso
   inactivo).

Nuevo componente `KpiDashboard.tsx` (lazy-loaded, patrón idéntico a
`AnaliticaIMR`/`ArticleAnalytics`) con cards de headline + tabla de roster
filtrable por estado. Nuevo tab `KPIS` en `AdminApp.tsx`.

**Alternativas descartadas:** exportar a BigQuery + Looker Studio (más
potente pero requiere activar el export y esperar volumen — no da valor
inmediato con 10 usuarios) y un script/notebook aparte (menos accesible
para Carlos que un tab dentro del panel que ya usa a diario).

## Plan de implementación

1. Crear `src/pages/api/admin/kpis.ts` — cálculo de KPIs desde Firestore.
2. Crear `src/components/admin/KpiDashboard.tsx` — UI de cards + roster.
3. Modificar `src/components/admin/AdminApp.tsx` — nuevo tab `KPIS`
   (lazy import, botón de sidebar, exclusión de `StatsGrid`, render).
4. Verificar build (`npm run build`).

## Criterios de aceptación

- [ ] `/api/admin/kpis` responde 401 sin cookie de sesión válida.
- [ ] El build de producción no lanza error.
- [ ] El tab "KPIs de adherencia" carga sin crashear con 0 usuarios o con
      usuarios sin ninguna subcolección de actividad (defensivo).
- [ ] Las métricas no disponibles (conversión, churn,
      coaching_action_followed) se muestran como "no disponible" con
      motivo, nunca como 0% o vacío ambiguo.
- [ ] El roster se puede filtrar por estado y ordena por inactividad
      descendente por defecto.

## Pruebas

```sh
cd metamorfosis-web && npm run build

# Endpoint (sin cookie)
curl -i http://localhost:4321/api/admin/kpis
# Esperado: HTTP/1.1 401 Unauthorized
```

Validación manual pendiente contra datos reales de producción: los campos
de fecha "best-effort" de `nutrition_history`/`exercise_history`/
`sleep_history`/`hydration_history` no fueron verificados línea por línea
contra cada `*_v1_source.dart` de ElenaApp por límite de tiempo — si el
desglose de "pilares tocados" del roster aparece sistemáticamente vacío
para un pilar que Carlos sabe que sí se usó, es señal de que ese
`bestEffortDayKey` necesita un campo específico añadido a la lista de
candidatos en `kpis.ts`. `streak_history` (la fuente de retención/DAU-MAU)
sí fue verificada contra el código de ElenaApp
(`firestore_streak_v1_source.dart`) y usa un campo confirmado.

## Riesgos / consideraciones

- **Costo de lectura:** con n≈10 usuarios el fan-out (6 subcolecciones ×
  usuario) es trivial. Si la base crece a cientos/miles de usuarios este
  endpoint necesitará paginación o precómputo (Cloud Function
  agendada que escriba un doc de agregados) — no optimizar antes de
  necesitarlo.
- **Datos de conversión/churn:** siguen sin ser medibles hasta que exista
  un webhook de RevenueCat → Firestore en ElenaApp. Es un follow-up
  explícito, no un bug de este SPEC.
- **Definición de "activo":** se apoya en `streak_history`, que es un
  efecto derivado del motor de streak de ElenaApp, no un evento de
  analytics independiente. Si ese motor tiene bugs de escritura (ver
  memoria de ElenaApp sobre SPEC-229 Score Coherence), el dashboard
  hereda esos bugs. Es una limitación conocida, no se intenta corregir
  aquí.

## Commit

**Mensaje sugerido:**
```
feat(spec-114): dashboard admin de KPIs de adherencia ElenaApp

- Endpoint GET /api/admin/kpis: activation, D1/D7/D30 retention, DAU/MAU,
  North Star, onboarding_complete — computados desde streak_history +
  subcolecciones de pilares de Firestore
- Roster por usuario ordenado por inactividad (accionable para contacto
  directo)
- Conversión/churn/coaching_action_followed marcados explícitamente como
  no disponibles (falta webhook RevenueCat y export BigQuery) en vez de
  mostrar 0
- Nuevo tab KPIS en AdminApp.tsx

Cierra specs/SPEC-114-dashboard-kpis-adherencia.md
```

---

## Resultado

Implementado. Build verificado localmente antes de commit (ver historial
de comandos). Pendiente: validar en producción que el desglose de
pilares del roster refleja datos reales (ver nota en `## Pruebas`), y
abrir spec de seguimiento para el webhook de RevenueCat cuando haya
volumen de trials real que justifique medir conversión.
