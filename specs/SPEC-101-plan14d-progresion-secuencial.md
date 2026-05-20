# SPEC-101 — Progresión secuencial del Plan IMR 14 días

**Estado:** 🔨 En progreso (código listo, pendiente: `npm test` + `npm run build` + commit + push)
**Fase:** Bloque B del plan estratégico 2026-05-19 (engagement del plan)
**Severidad:** ALTA (define si el usuario termina o abandona el plan)
**Fecha de creación:** 2026-05-19
**Autor:** Carlos Reyes
**Depende de:** SPEC-100 (datos del plan), SPEC-099 (pilar débil), SPEC-005 (schema)

---

## Contexto

SPEC-100 entregó el Plan IMR de 14 días al usuario tras el registro. Hoy el plan se renderiza **completo**: las 14 cards visibles al cargar `/dashboard/plan`. Carlos observó que esta exhibición simultánea de los 14 días reduce la probabilidad de completarlo.

> *"Si le mostramos todo el plan de una vez muy posiblemente no lo complete."*

La hipótesis tiene respaldo en literatura de behavior change:

- **Lally et al. (2010)** "How are habits formed: Modelling habit formation in the real world." *Eur J Soc Psychol* 40(6):998-1009. → La formación de hábitos toma en promedio 66 días (rango 18-254). Implica que 14 días son apenas el inicio: el plan necesita maximizar adherencia diaria, no entregarlo todo de un golpe.
- **Locke & Latham (2002)** "Building a practically useful theory of goal setting." *Am Psychol* 57(9):705-717. → Metas específicas con feedback inmediato mejoran performance ~16% vs metas vagas o sin feedback.
- **Efecto Zeigarnik** (Zeigarnik, 1927; revisado por Burmester et al. 2017) → Las tareas incompletas crean tensión cognitiva que motiva a completarlas. Mostrar solo el día actual mantiene la tensión productiva; mostrar los 14 la disuelve en parálisis.
- **Couch to 5K, Duolingo, Headspace** son ejemplos comerciales de progresión secuencial obligatoria que han probado escalabilidad en millones de usuarios — el patrón no es teórico, es estándar de mercado.

## Problema

Tres efectos compuestos en la versión actual de SPEC-100:

1. **Sobrecarga inicial**: el usuario llega al plan, ve 14 cards, lee 3-4, cierra la pestaña con el plan "para después". Después no vuelve.
2. **Sin sensación de progreso**: completar el día 3 no produce un cambio visible en la UI. No hay reward. Engagement decae.
3. **No persiste estado**: si el usuario sí ejecuta el día 1 fuera del sitio, no hay forma de marcarlo. Sin marca, sin sentido de progreso, sin razón para volver.

## Solución propuesta

Convertir el plan en una **ruta secuencial con persistencia**. El usuario ve:

- **Día actual** (current): card completa, prominente, con CTA "Marcar día como completado".
- **Días pasados completados**: cards compactas con check verde, acción visible.
- **Días futuros bloqueados**: cards con ícono de candado, solo título + fase visibles. La acción específica queda oculta hasta desbloquearse.

Al completar el día actual:
1. Se persiste el día en `users/{uid}.plan14d.completedDays` (Firestore).
2. La UI animación-transiciona: el día completado se cierra, el siguiente día se abre.
3. Tracking Umami `plan14d_dia_completado` con day + pillar + daysToComplete (días reales calendario desde inicio).

Al completar el día 14:
1. Card de cierre exclusiva con CTA al modal ElenaApp / Cohorte 1000.
2. `users/{uid}.plan14d.finishedAt` se persiste.
3. Tracking `plan14d_finalizado`.

### Decisiones documentadas (sin esperar confirmación de Carlos; revertible)

1. **Secuencial estricto**: no se puede completar día N+1 antes que día N. Coherente con el lenguaje de Carlos ("a medida que lo vaya marcando como cumplido puede ir avanzando").
2. **Undo del último**: el botón "Desmarcar último" permite revertir el último día marcado por error. NO permite desmarcar cualquier día anterior (eso confunde el orden).
3. **Sin penalización por gap temporal**: si el usuario no entra por 7 días, el plan no se reinicia ni "rompe racha". El día actual sigue siendo el que estaba. SPEC-101 v1 NO implementa streak/freeze — overkill para un plan de 14 días.
4. **Re-medición a mitad de plan**: si el usuario re-hace el quiz y cambia el pilar débil mientras está en día 5, **el progreso se conserva** pero las acciones de los días futuros (5+) reflejan el nuevo pilar. Coherente con SPEC-088 (BD fuente única) — el plan se computa al render con el pilar actual.
5. **Sin notificaciones push ni emails diarios**: out of scope (requiere SDK push o cron). Si los datos lo justifican, SPEC-102.

### Schema canónico

Nuevo bloque opcional en `UserDoc`:

```ts
export interface UserPlan14d {
    /** ISO. null si el usuario aún no marcó ningún día. */
    startedAt: string | null;
    /** Días completados en orden cronológico de completion. */
    completedDays: number[];
    /** Pilar al momento de iniciar (preserva intención original). */
    initialPillar: 'E' | 'M' | 'C' | null;
    /** Map día → ISO. Útil para analytics de adherencia. */
    completedAt: Record<string, string>;
    /** ISO. null hasta que día 14 se complete. */
    finishedAt: string | null;
}

export interface UserDoc {
    // …existentes…
    /** SPEC-101: progreso del Plan IMR 14d. Opcional para back-compat. */
    plan14d?: UserPlan14d;
}
```

**No requiere bump de `meta.schemaVersion`** porque agrega un campo opcional. ElenaApp puede ignorarlo. Si Elena App quiere reflejar progreso en el futuro, lee este bloque tal cual.

### Reglas de Firestore

**No se modifican.** Las rules actuales ya permiten al dueño hacer `update` de su doc salvo en `app`/`crm`/`founder`. El campo nuevo `plan14d` es escribible por el dueño desde el cliente Web SDK. Coherente con el patrón de `bio`/`habits`/`imr` que el dueño también escribe directamente.

**Hay un detalle de seguridad menor**: un usuario malicioso podría escribir `completedDays: [1..14]` desde la consola sin haber hecho nada. Aceptable porque:
- El plan es educativo, no hay beneficios externos por completarlo.
- No hay datos sensibles que dependan del progreso.
- El daño máximo es que el propio usuario se mienta a sí mismo.

### Arquitectura

```
src/lib/types/user.ts                  ← agregar UserPlan14d + campo opcional en UserDoc
src/lib/imr/plan14dProgress.ts         ← lógica: currentDay, isLocked, canComplete, canUndo
src/lib/imr/plan14dProgress.test.ts    ← tests
src/components/Plan14d.tsx             ← refactor para mostrar solo día actual + completados + locks
src/components/BioDashboard.tsx        ← card de acceso actualiza copy: "Día X de 14"
```

## Plan de implementación

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1 | Agregar `UserPlan14d` y campo `plan14d?` en `UserDoc` | `src/lib/types/user.ts` | 10 min |
| 2 | Crear `lib/imr/plan14dProgress.ts`: helpers puros (`getCurrentDay`, `isDayCompleted`, `isDayLocked`, `canCompleteDay`, `canUndoLastDay`, `markDayComplete`, `undoLastDay`) | nuevo | 1 h |
| 3 | Tests del módulo (estados iniciales, secuencia normal, undo válido/inválido, casos límite día 1 y día 14) | nuevo | 30 min |
| 4 | Refactor `Plan14d.tsx`: estado de progreso desde Firestore, render diferenciado (completado/actual/locked), botón "Marcar como completado", botón "Desmarcar último", animación de transición | mod | 2 h |
| 5 | Persistencia: función helper `persistProgress(uid, plan14d)` que escribe con `updateDoc` desde el cliente | dentro de Plan14d.tsx | 20 min |
| 6 | Card del dashboard: copy "Día X de 14" cuando hay progreso; "Tu plan IMR · 14 días" cuando no inició | `BioDashboard.tsx` | 20 min |
| 7 | Tracking Umami: `plan14d_dia_completado`, `plan14d_undo`, `plan14d_finalizado` | `Plan14d.tsx` | 15 min |
| 8 | Verificación final (grep, sintaxis, sin voseo) | sandbox | 15 min |
| 9 | Commit + push | git | 5 min |
| 10 | Smoke post-deploy | producción | 20 min |

**Esfuerzo total estimado:** ~5 horas.

## Criterios de aceptación

- [ ] Usuario nuevo que llega a `/dashboard/plan` por primera vez ve:
  - Día 1 abierto y prominente con su acción específica + botón "Marcar día como completado".
  - Días 2-14 con ícono de candado, solo título + fase visibles (sin acción).
- [ ] Al hacer clic en "Marcar día como completado":
  - El doc Firestore se actualiza con el día en `completedDays` y timestamp en `completedAt`.
  - La UI muestra el día 1 colapsado con check verde + el día 2 abierto y disponible.
  - Si era el día 1, `startedAt` se setea con la fecha actual.
- [ ] Botón "Desmarcar último" visible solo cuando `completedDays.length > 0`. Al hacer clic, el último día vuelve a estar abierto.
- [ ] Al completar día 14: `finishedAt` se setea y se muestra card de cierre con CTA a ElenaApp.
- [ ] Si el usuario refresca la página, el estado se mantiene (lee de Firestore).
- [ ] Re-medición que cambie el pilar débil mientras hay progreso: progreso se conserva; las acciones de los días futuros muestran el nuevo pilar.
- [ ] Card del dashboard muestra "Día X de 14" cuando hay progreso, "Listo para empezar" cuando no.
- [ ] Tests del módulo de progresión pasan (estados iniciales, secuencia, undo, día 14).
- [ ] Build limpio (`npm run build`).
- [ ] Copy en tuteo neutro.

## Pruebas manuales

```sh
cd metamorfosis-web && npm test -- plan14dProgress
cd metamorfosis-web && npm run build
```

**Smoke post-deploy:**

1. Usuario con M débil entra por primera vez a `/dashboard/plan` → ve día 1 abierto con acción de M; días 2-14 con candado. Marca día 1 → día 2 se abre, día 1 se cierra con check. Refresca → estado persiste.
2. Marca día 1, 2, 3 → 11 candados restantes. Click "Desmarcar último" → día 3 vuelve a estar disponible.
3. Marca día 14 (después de los anteriores) → finishedAt se setea. UI muestra card "Has completado tu plan". CTA a ElenaApp visible.
4. En consola de browser: `await import('firebase/firestore').then(m => m.updateDoc(...))` → intentar setear `completedDays: [1..14]` desde el cliente. Rules deben permitirlo (es el dueño), pero validar que la UI refleja el estado correcto al recargar.
5. Verificar en Firestore que el doc tiene la estructura `plan14d: { startedAt, completedDays, initialPillar, completedAt, finishedAt }`.

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Usuario no entiende que los días están bloqueados y se frustra | Media | Ícono de candado claro + tooltip/copy ("Completa el día anterior para desbloquear este"). Visualmente diferenciado |
| Usuario completa día 1, no entra en 30 días, vuelve confundido sobre qué pasó | Media | El día actual sigue siendo el siguiente. No hay penalización ni reset. Carlos puede agregar copy "Última actividad hace X días" si los datos lo justifican (SPEC-102) |
| Write a Firestore falla (red caída, regla bloqueada) | Baja | Toast/alert si `updateDoc` lanza. UI hace rollback del estado local. Sin estado local "optimista" que confunda |
| Usuario hace varias acciones rápidas (doble click) y se completa día 2 antes que día 1 termine de escribir | Baja | Disable el botón mientras la promesa está pendiente. Si llegan dos writes simultáneos a Firestore, el último gana — pero las acciones de UI se previenen vía disabled state |
| El modelo asume Cohorte 1 todo el tiempo activa; si Carlos cierra la cohorte, el CTA día 14 muestra promesa rota | Media | El CTA día 14 enlaza a `/dashboard` (que tiene la card de ElenaApp con estado real de waitlist). No hardcodea texto de "primeros 1000" — eso lo gestiona el dashboard |

## Fuera de scope (intencional)

- **Notificaciones push o emails diarios recordatorios**: requiere infra de push o cron. Si Cohorte 1 muestra que sí movería la aguja, SPEC-102.
- **Streak/rachas con días consecutivos**: agrega complejidad y la penalización por gap puede desmoralizar más que motivar. Out of scope v1.
- **"Freezes" estilo Duolingo**: lo mismo.
- **Editar/personalizar acciones desde la UI**: Carlos itera vía commits a `plan14d.ts`. Editor inline no aporta a usuarios.
- **Compartir progreso a redes sociales**: out of scope.
- **Análisis admin del progreso agregado de todos los usuarios**: SPEC-103 si vale.

## Commit sugerido

```
feat(spec-101): progresión secuencial del Plan IMR 14d con persistencia

- Schema: nuevo campo opcional users/{uid}.plan14d
- lib/imr/plan14dProgress.ts: helpers puros + tests
- Plan14d.tsx: UI secuencial (actual / completados / bloqueados)
- BioDashboard: card refleja progreso "Día X de 14"
- Persistencia Firestore desde cliente (sin endpoint)
- Tracking Umami: plan14d_dia_completado, plan14d_undo, plan14d_finalizado

Sustento behavior change: Lally 2010, Locke & Latham 2002, efecto Zeigarnik.
Patrón mainstream: Duolingo, Couch to 5K, Headspace.

Cierra specs/SPEC-101-plan14d-progresion-secuencial.md
```

## Resultado

**Implementación 2026-05-19 — código aplicado en una pasada:**

### Archivos nuevos (2)

- **`src/lib/imr/plan14dProgress.ts`** (~130 líneas)
  - Constante `INITIAL_PROGRESS` (estado de un user sin avance).
  - Helpers puros: `getCurrentDay`, `isDayCompleted`, `isDayLocked`,
    `canCompleteDay`, `canUndoLastDay`, `isPlanFinished`.
  - Reducers puros: `markDayComplete(progress, day, initialPillar, nowIso)`
    y `undoLastDay(progress)`. Ambos retornan nuevo `UserPlan14d` sin
    mutar el original. `markDayComplete` setea `startedAt` y
    `initialPillar` solo en la primera marca; setea `finishedAt` solo
    al completar día 14. `undoLastDay` limpia esos campos cuando aplica.
  - Defensa contra race conditions: si `canCompleteDay` retorna false,
    `markDayComplete` retorna el mismo objeto referencial.

- **`src/lib/imr/plan14dProgress.test.ts`** (~150 líneas, ~25 tests vitest)
  - Estado inicial: día 1 disponible, 2-14 locked, undo deshabilitado.
  - Secuencial estricto: no salta días, no re-marca completados.
  - Preserva `initialPillar` y `startedAt` en marcas subsiguientes.
  - Día 14: `finishedAt` se setea, `isPlanFinished` retorna true.
  - Undo: limpia el último día, preserva timestamps de anteriores,
    limpia `startedAt`/`initialPillar` si queda vacío, limpia
    `finishedAt` si se descomplete día 14.
  - Inmutabilidad: las funciones no mutan el input.

### Archivos modificados (3)

- **`src/lib/types/user.ts`**
  - Nueva interfaz `UserPlan14d` con 5 campos (startedAt, completedDays,
    initialPillar, completedAt, finishedAt) + JSDoc extenso explicando
    reglas de mutación, propiedad del bloque (web es dueño), y
    comportamiento de re-medición.
  - Campo opcional `plan14d?: UserPlan14d` agregado a `UserDoc`. No
    requiere bump de `schemaVersion` (es additive).

- **`src/components/Plan14d.tsx`** (refactor completo, ~410 líneas)
  - Lee `data.plan14d ?? INITIAL_PROGRESS` al cargar el doc.
  - Render condicional por día: completado (compact con check),
    actual (full con CTA), locked (compact con candado).
  - Botón "Marcar día como completado" en el día actual con disabled
    state durante la escritura a Firestore.
  - Botón "Desmarcar último día" visible solo si hay completados.
  - Barra de progreso en el header (`completedDays.length / 14`).
  - Persistencia con `updateDoc` directamente desde el cliente.
    Optimistic UI con rollback si la escritura falla + alert al user.
  - Card de cierre solo aparece cuando `isPlanFinished` retorna true.
  - Tracking Umami: `plan14d_visto` (al cargar), `plan14d_dia_completado`
    (con day, pillar, daysSinceStart), `plan14d_finalizado` (día 14),
    `plan14d_undo`.

- **`src/components/BioDashboard.tsx`**
  - Imports nuevos: `UserPlan14d`, `PLAN_TOTAL_DAYS`, `INITIAL_PROGRESS`,
    `getCurrentDay`, `isPlanFinished`.
  - Campo `plan14d: UserPlan14d` agregado a `DashboardStats` con default
    `INITIAL_PROGRESS`.
  - `fetchUserData` ahora lee `data.plan14d ?? INITIAL_PROGRESS`.
  - Card del plan reescrita con copy diferenciado según progreso:
    - Sin iniciar: "Tu plan IMR · 14 días" + descripción del pilar.
    - En curso: "Tu plan IMR · Día X de 14" + "Te quedan N días por
      desbloquear" + barra de progreso mini.
    - Completado: "Tu plan IMR · Completado" + CTA a ElenaApp.
  - `data-umami-event-progress` agregado al tracking de la card.

### Verificaciones pasadas en sandbox

- Braces y parens balanceados en los 5 archivos (user.ts 21/21,
  plan14dProgress.ts 16/16 + 37/37, test 40/40 + 209/209, Plan14d.tsx
  109/109 + 132/132, BioDashboard 135/135 + 123/123).
- Imports cruzados correctos: `plan14dProgress` consumido por Plan14d
  y BioDashboard; `UserPlan14d` re-exportado desde types.
- Schema NO requiere bump de `meta.schemaVersion` (campo additive).
- Reglas de Firestore NO requieren cambio (rules actuales ya permiten
  al dueño update sin tocar app/crm/founder; `plan14d` no está en esa
  lista).

### Pendiente para Carlos antes del commit

1. Tests unitarios:
   ```bash
   cd metamorfosis-web && npm test -- plan14dProgress
   ```
   Deben pasar los ~25 tests del módulo.

2. Build local:
   ```bash
   cd metamorfosis-web && npm run build
   ```

3. Commit + push:
   ```bash
   git add metamorfosis-web/src/lib/types/user.ts \
           metamorfosis-web/src/lib/imr/plan14dProgress.ts \
           metamorfosis-web/src/lib/imr/plan14dProgress.test.ts \
           metamorfosis-web/src/components/Plan14d.tsx \
           metamorfosis-web/src/components/BioDashboard.tsx \
           specs/SPEC-101-plan14d-progresion-secuencial.md
   git commit -m "feat(spec-101): progresión secuencial del Plan IMR 14d con persistencia"
   git push
   ```

4. Smoke post-deploy (90-120s):
   - User logueado con IMR válido → entra a `/dashboard/plan` → ve día 1
     abierto y prominente; días 2-14 con candado.
   - Click "Marcar día como completado" → día 1 se colapsa con check,
     día 2 se abre. Barra de progreso pasa a 1/14. Refrescar la página
     mantiene el estado.
   - Verificar en Firebase Console: `users/{uid}.plan14d` tiene
     `startedAt`, `completedDays: [1]`, `initialPillar`, `completedAt: { "1": ... }`,
     `finishedAt: null`.
   - Click "Desmarcar último día" → vuelve a estado inicial. Refrescar
     mantiene. Firestore vuelve a no tener `startedAt` (null).
   - Completar 14 días seguidos → card de cierre aparece. `finishedAt`
     se setea en Firestore. Card del dashboard dice "Tu plan IMR · Completado".
   - Volver a `/dashboard` → card del plan muestra "Día X de 14" + barra
     de progreso correcta.

**Cierre de spec:** al pasar las 5 verificaciones, cambiar Estado a
✅ Cerrada y agregar fecha de cierre.

**Sobre persistencia desde el cliente vs server:** se evaluó hacer un
endpoint `/api/users/me/plan14d` server-side, pero se descartó porque
(a) no hay validación que requiera privilegios elevados (es el propio
user actualizando sus datos), (b) consistente con el patrón ya usado
en `bio`/`habits`/`imr` que el cliente escribe directamente, (c)
agrega latencia sin beneficio. Si en el futuro se quisiera anti-cheating
(e.g. "completaste demasiado rápido"), se puede mover a server.

**Decisiones revertibles documentadas** (Carlos puede ajustar si
las quiere distintas, todas en `plan14dProgress.ts` o tests):

- Secuencial estricto (no saltar) → si quiere "permitir saltos",
  cambiar `canCompleteDay`.
- Undo solo del último → si quiere "undo de cualquier día completado",
  modificar `undoLastDay`.
- Sin penalización temporal → si quiere "streak/reset por inactividad",
  SPEC-102.
