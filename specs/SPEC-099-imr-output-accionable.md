# SPEC-099 — Output del IMR accionable (pilar débil + acción semanal)

**Estado:** 🔨 En progreso (código listo, pendiente: `npm test` + `npm run build` + commit + push)
**Fase:** Bloque B del plan estratégico 2026-05-19 (IMR accionable)
**Severidad:** ALTA (cuello de botella del funnel — sin esto el quiz "termina en limbo")
**Fecha de creación:** 2026-05-19
**Autor:** Carlos Reyes
**Depende de:** SPEC-004 (motor IMR), SPEC-005 (schema), SPEC-085 (link pedagógico), SPEC-088 (BD fuente única), SPEC-097 (modal hook IMR), SPEC-098 (home limpio)

---

## Contexto

Auditoría 2026-05-19 del flujo actual:

1. **Modal ElenaApp** (SPEC-097) promete: *"Conoce ahora tu % de grasa corporal"* → CTA al `/quiz`.
2. **Quiz IMR** (`IMRQuiz.tsx`) tiene 8 substeps de captura biométrica + hábitos.
3. **Step 2 final** (`IMRQuiz.tsx:585+`): muestra *"Análisis completado"* + form de registro (nombre, email, password) con botón *"Ver mis resultados →"*. **El anónimo NO ve su score IMR.** Se calcula y se guarda en `sessionStorage`, pero la UI lo oculta hasta tras el registro.
4. **Tras registro**: redirect a `/dashboard` (`BioDashboard.tsx`).
5. **Dashboard**: círculo con `imrScore` numérico + zona + 3 pilares `E/M/C` en % + composición corporal + link *"¿Qué significa este puntaje?"* (SPEC-085). **Los 3 pilares se muestran con el mismo peso visual** — el usuario no sabe cuál es su cuello de botella.

## Problema (dos capas)

### Capa 1 — El quiz termina en limbo

El anónimo invierte ~3 minutos completando 8 substeps y al final no recibe NADA visible. Solo se le pide registro con una promesa abstracta ("Ver mis resultados"). Esto rompe la promesa del modal ElenaApp y predice abandono masivo en step 2. El registro se siente como un muro de paywall, no como un compromiso justificado.

### Capa 2 — El score post-registro no es accionable

Tras registrarse, el usuario ve un número (ej. 47) y 3 pilares E/M/C en porcentaje (ej. E=45%, M=52%, C=38%). El usuario no sabe:

- ¿Cuál de los 3 es el cuello de botella real?
- ¿Qué hago concretamente esta semana para mejorar?

Sin esa respuesta, el dashboard es un termómetro sin brújula. El usuario lo cierra y no vuelve.

## Solución propuesta

Tres cambios coordinados en una sola spec:

### 1. Módulo nuevo: `lib/imr/weakPillar.ts`

Función pura que toma `blocks { E, M, C }` y retorna el pilar con score mínimo + una acción semanal hardcoded por pilar (basada en evidencia, sin prescripción médica). La acción es genérica y segura — vive en el código, se puede iterar después con datos reales de la Cohorte 1.

```ts
export type PillarKey = 'E' | 'M' | 'C';

export interface WeakPillarResult {
  key: PillarKey;
  label: string;          // "Estructura" | "Metabolismo" | "Conducta"
  scorePct: number;       // 0-100 (redondeado)
  weeklyAction: {
    title: string;        // título corto, accionable
    detail: string;       // 1-2 oraciones de contexto
  };
}

export function identifyWeakPillar(
  blocks: { E: number; M: number; C: number }
): WeakPillarResult;
```

Acciones hardcoded propuestas (Carlos refina si quiere):

| Pilar | Acción semanal (título) | Detalle |
|---|---|---|
| E — Estructura | Suma 2 sesiones de fuerza de 20 min esta semana | La masa magra es el motor de tu metabolismo basal. Dos sesiones cortas de pesos o calistenia (sentadillas, flexiones, dominadas) son suficientes para activarlo. |
| M — Metabolismo | Extiende tu ayuno a 14 horas cerrando la última comida a las 8 pm | El intervalo nocturno sin comida es cuando tu insulina baja y el cuerpo accede a grasa de reserva. Empieza con 14 h y mantén durante 7 días. |
| C — Conducta | Cierra pantallas 1 hora antes de dormir + 0.5 L de agua al despertar | La luz azul fragmenta el sueño profundo (cuando se libera hormona de crecimiento). Y la hidratación matutina activa la termogénesis. Estos dos hábitos compuestos elevan tu pilar de Conducta más rápido que cualquier otro. |

Empate: si dos pilares empatan en el mínimo, gana el orden `C > M > E` (prioridad de hábito conductual sobre metabólico sobre estructural, porque la conducta es el habilitador de los otros dos).

### 2. Quiz step 2 — preview accionable antes del registro

`IMRQuiz.tsx` step 2 se reescribe para que el anónimo vea:

- **Score IMR numérico** (mismo gauge del dashboard, tamaño compacto)
- **Zona/label** (óptima / transición / deteriorada, con color)
- **Pilar débil identificado** (badge: "Tu cuello de botella: Conducta — 38%")
- **Acción semanal concreta** (card con título + detalle)
- **Propuesta del registro reescrita** — antes: *"Vincula tu identidad para recibir tu reporte IMR"* + botón *"Ver mis resultados →"*. Después: *"Guarda tu reporte y desbloquea tu plan IMR de 14 días"* + botón *"Guardar mi reporte →"*.

El form de registro (nombre, email, password) se mantiene tal cual. Solo cambia la propuesta y el contexto del registro.

### 3. Dashboard — pilar débil destacado + acción persistente

`BioDashboard.tsx` agrega una sección nueva entre el círculo IMR y el grid de los 3 pilares:

- **Card destacada** con `bg-accent/10 border-accent/30` que dice: *"Tu pilar de mayor oportunidad esta semana: [Pilar] — [score%]"* + la acción semanal (mismo copy que vio en el quiz step 2).
- El grid de los 3 pilares existente se mantiene, pero el pilar débil tiene `ring-2 ring-accent/40` para destacar visualmente cuál es.

La acción se lee en cliente desde `blocks` (que ya viene del backend SPEC-088). No requiere campo nuevo en Firestore — pure compute.

## Plan de implementación

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1 | Crear módulo `weakPillar.ts` con función `identifyWeakPillar` + 3 acciones hardcoded | `src/lib/imr/weakPillar.ts` (nuevo) | 30 min |
| 2 | Test unitario del módulo (3 casos: E débil, M débil, C débil + 1 caso empate) | `src/lib/imr/weakPillar.test.ts` (nuevo) | 25 min |
| 3 | Refactorizar Quiz step 2: agregar bloque preview (score + zona + pilar débil + acción) ANTES del form | `src/components/IMRQuiz.tsx` (línea ~585) | 60 min |
| 4 | Cambiar copy del eyebrow + botón del form | `src/components/IMRQuiz.tsx` | 10 min |
| 5 | Dashboard: card de pilar débil + acción semanal | `src/components/BioDashboard.tsx` (entre línea ~312 y ~315) | 40 min |
| 6 | Dashboard: ring visual en el pilar débil del grid existente | `src/components/BioDashboard.tsx` (línea ~316-322) | 15 min |
| 7 | Tracking Umami: evento `quiz_preview_visto` (anónimo vio el preview) y `weak_pillar_action_visto` (en dashboard) | `IMRQuiz.tsx` + `BioDashboard.tsx` | 15 min |
| 8 | Build + verificación local | terminal | 10 min |
| 9 | Commit + push | git | 5 min |
| 10 | Verificación post-deploy (90-120s) en mobile + desktop | producción | 15 min |

**Esfuerzo total estimado:** ~3.5 horas.

## Criterios de aceptación

- [ ] Anónimo completa quiz → step 2 muestra:
  - [ ] Score IMR numérico en gauge compacto
  - [ ] Zona/label con color correspondiente
  - [ ] Badge del pilar débil con score en %
  - [ ] Card con acción semanal (título + detalle)
  - [ ] Form de registro intacto (nombre/email/password) con copy actualizado
- [ ] Click en *"Guardar mi reporte →"* registra y redirige al dashboard.
- [ ] Dashboard muestra:
  - [ ] Card destacada con el pilar débil + acción semanal entre el círculo y el grid de pilares
  - [ ] El pilar débil en el grid tiene `ring-2 ring-accent/40`
  - [ ] Si los 3 pilares están en zona óptima (todos ≥70%), la card no aparece o muestra copy distinto ("Tu balance es sólido — mantén esta semana")
- [ ] Test unitario del módulo pasa (4 casos).
- [ ] Build limpio (`npm run build` sin errores).
- [ ] Lighthouse mobile Performance no baja vs baseline (SPEC-030).
- [ ] Copy en tuteo neutro (sin voseo) — regla del proyecto.

## Pruebas manuales

```sh
cd metamorfosis-web && npm test         # Validar weakPillar.test.ts
cd metamorfosis-web && npm run build    # Build limpio
```

**Smoke post-deploy:**

1. **Anónimo** completa quiz con valores que produzcan pilar débil en C (ej. sueño 5h, ejercicio 0, hidratación 1L). Verificar en step 2 que:
   - Score y zona aparecen
   - Pilar débil = Conducta
   - Acción = "Cierra pantallas 1h antes de dormir + 0.5L de agua al despertar"
2. Repetir con valores que produzcan E débil (composición corporal baja). Acción = sesiones de fuerza.
3. Repetir con valores que produzcan M débil (ayuno corto, cena tarde). Acción = extender ayuno.
4. Caso empate: 2 pilares con mismo mínimo. Debe ganar `C > M > E`.
5. Registro desde step 2 → dashboard muestra la MISMA acción del pilar débil.
6. Caso óptimo: usuario con IMR ≥80 y los 3 pilares ≥70%. La card del dashboard muestra copy de mantenimiento, no de corrección.
7. Mobile 375px: el preview del step 2 no se desborda. La card del dashboard se apila bien con el círculo y los pilares.

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Mostrar el score al anónimo baja la tasa de registro (el usuario se va con el número sin registrarse) | Media-Alta | El registro ahora vende "guardar reporte + plan 14 días", no "ver número". Si después de 4 semanas Umami muestra caída de conversión, iteramos la propuesta del form (ej. blur parcial del detalle de la acción). Decidir basados en datos, no en hipótesis |
| Acciones genéricas no aplican a todos los usuarios (ej. mujer embarazada, lesión, dieta médica especial) | Media | Card incluye disclaimer pequeño: *"Recomendación general. Si tienes condiciones médicas particulares, consulta a tu profesional de salud."* Vive en la card, no en un modal |
| Carlos quiere refinar las 3 acciones | Alta (esperable) | Las acciones viven en una constante exportada del módulo — un cambio = un PR de 5 min. Spec separada (SPEC-099-followup) si quiere taxonomía más rica |
| Acción semanal no se persiste en Firestore (es compute pure en cliente) | Baja | Aceptable: el dashboard recalcula cada vez. Si en el futuro queremos tracking de cumplimiento, se agrega entonces. YAGNI ahora |
| El refactor del step 2 rompe el flujo de registro existente (Firebase Auth, sessionStorage, redirect) | Alta si no se cuida | NO tocar `handleFinalRegister`. Solo agregar preview ANTES del form. El form mismo queda intacto. Tests de regresión: registro anónimo → user válido en Firestore con campos correctos |

## Fuera de scope (intencional)

- **Plan de 14 días en PDF**. La promesa del registro se actualiza a "Guarda tu reporte y desbloquea tu plan IMR de 14 días", pero el plan en sí queda para SPEC-100. Esta spec solo redirige al dashboard tras registro como hoy. El plan IMR 14d se puede entregar primero como sección/tab del dashboard (lighter) o como PDF generado. Decisión de scope queda para SPEC-100.
- **Re-medición del IMR semanal.** Una vez al mes basta para detectar cambios reales en composición corporal. Re-medición está cubierta por flujos existentes en ElenaApp y por el quiz IMR ejecutable repetido.
- **Tracking de cumplimiento de la acción.** El usuario lee la acción y la ejecuta o no. Sin telemetría de "lo hice / no lo hice" en este sprint. Si la Cohorte 1 muestra que vale la pena, se agrega.
- **Acciones personalizadas por género/edad/contexto.** Las 3 acciones son genéricas y seguras. Refinamiento por contexto es trabajo de SPEC-099-followup con datos reales de cohorte.

## Commit sugerido

```
feat(spec-099): output del IMR accionable — pilar débil + acción semanal

- Nuevo módulo lib/imr/weakPillar.ts con identifyWeakPillar() + 3 acciones
- Tests unitarios del módulo (4 casos)
- Quiz step 2: preview del score + zona + pilar débil + acción semanal
  ANTES del form de registro. Cambio de copy: "Ver mis resultados" →
  "Guardar mi reporte y desbloquear plan IMR 14 días"
- BioDashboard: card destacada del pilar débil + acción, ring visual en
  el pilar débil del grid existente
- Umami: eventos quiz_preview_visto + weak_pillar_action_visto

Resuelve el cuello de botella diagnosticado en plan estratégico 2026-05-19:
el quiz dejaba al anónimo sin valor visible y el dashboard sin acción.

Cierra specs/SPEC-099-imr-output-accionable.md
```

## Resultado

**Implementación 2026-05-19 — código aplicado en una pasada:**

### Archivos nuevos (2)

- **`src/lib/imr/weakPillar.ts`** (187 líneas)
  - Tipos `PillarKey`, `WeeklyAction`, `WeakPillarResult` exportados.
  - Función pura `identifyWeakPillar(blocks) → WeakPillarResult`.
  - 3 acciones hardcoded `ACTIONS[E|M|C]` con título + detalle + array
    de referencias revisadas por pares. Comentario JSDoc por pilar con
    la cita completa de cada referencia.
  - `OPTIMAL_THRESHOLD = 0.70` configurable; cuando los 3 blocks
    están ≥ umbral, retorna `isOptimal=true` + `MAINTENANCE_ACTION`
    (copy de mantenimiento, sin referencias).
  - Regla de empate `C > M > E` implementada vía orden de iteración
    `[C, M, E]` con `<` (no `≤`), garantizando que el primer mínimo
    encontrado en ese orden gana.

- **`src/lib/imr/weakPillar.test.ts`** (105 líneas, 12 tests con vitest)
  - 3 casos canónicos: E débil, M débil, C débil.
  - 4 casos de empate (C+M, C+E, M+E, triple).
  - 3 casos de zona óptima (todos ≥0.70, exactamente 0.70, apenas
    debajo 0.69).
  - 2 tests de integridad del export: refs presentes en las 3
    acciones, copy en tuteo neutro (sin voseo).

### Archivos modificados (2)

- **`src/components/IMRQuiz.tsx`**
  - Import nuevo: `identifyWeakPillar, type WeakPillarResult`.
  - State nuevo `previewData` (imrResult + weakPillar) que se popula
    en `useEffect([step])` cuando step pasa a 2, leyendo de
    `sessionStorage[QUIZ_STORAGE_KEY]`. Si falla el parse se loguea
    y el preview queda oculto (degradación graceful).
  - Tracking nuevo `track('quiz_preview_visto', { score, label, weakPillar, isOptimal })`.
  - Step 2 rewrite del JSX:
    - Bloque preview ANTES del form: gauge 140px + label de zona +
      card de pilar débil con título + detalle + disclaimer médico.
    - Eyebrow del form: *"Vincula tu identidad para recibir tu reporte IMR"*
      → *"Acceso a tu dashboard de seguimiento + plan IMR de 14 días"*.
    - H2 del form: *"Análisis completado"* → *"Guarda tu reporte y
      desbloquea tu plan IMR"*.
    - Botón submit: *"Ver mis resultados →"* → *"Guardar mi reporte →"*.
    - Texto saving: *"Generando reporte…"* → *"Guardando reporte…"*.
  - `handleFinalRegister` NO se tocó — el contrato de registro con
    Firebase Auth y `/api/users/onboard` queda intacto.

- **`src/components/BioDashboard.tsx`**
  - Import nuevo: `identifyWeakPillar`.
  - Constante derivada `hasValidImr` + `weakPillar` calculada inline
    en el render. Se calcula solo si `!isLoading && !needsOnboarding
    && !hasProfileNoImr && imr > 0` para evitar mostrar acción "optimal"
    fantasma cuando los blocks vienen en cero.
  - Card destacada del pilar débil entre el link "¿Qué significa este
    puntaje?" y el grid de pilares. Incluye `<details>` colapsable
    con las referencias (auditable para el usuario, oculto por default).
  - Tracking declarativo `data-umami-event="weak_pillar_action_visto"` +
    `data-umami-event-pillar` + `data-umami-event-optimal` en la card.
  - Grid de 3 pilares: el pilar débil (sólo si NO está optimal) recibe
    `ring-2 ring-accent/40` para destacarse visualmente.

### Verificaciones pasadas en sandbox

- Braces balanceados en los 4 archivos (IMRQuiz 194/194, BioDashboard
  115/115, weakPillar 18/18, test 30/30).
- Imports correctos: `identifyWeakPillar` importado en IMRQuiz e
  BioDashboard desde `'../lib/imr/weakPillar'`.
- Copy viejo eliminado: cero matches de "Ver mis resultados",
  "Vincula tu identidad", "Análisis completado".
- Tuteo neutro: cero patrones de voseo en los archivos modificados.

### Pendiente para Carlos antes del commit

1. Tests unitarios:
   ```bash
   cd metamorfosis-web && npm test -- weakPillar
   ```
   Deben pasar 12 tests del módulo.

2. Build local:
   ```bash
   cd metamorfosis-web && npm run build
   ```

3. Commit + push:
   ```bash
   git add metamorfosis-web/src/lib/imr/weakPillar.ts \
           metamorfosis-web/src/lib/imr/weakPillar.test.ts \
           metamorfosis-web/src/components/IMRQuiz.tsx \
           metamorfosis-web/src/components/BioDashboard.tsx \
           specs/SPEC-099-imr-output-accionable.md
   git commit -m "feat(spec-099): output del IMR accionable — pilar débil + acción semanal"
   git push
   ```

4. Smoke post-deploy (90-120s):
   - Anónimo en /quiz con valores que produzcan C débil (sueño 5h,
     ejercicio 0, hidratación 1L) → step 2 muestra preview con pilar
     "Conducta" + acción "Cierra pantallas + 0.5L agua".
   - Repetir con valores que produzcan E débil (composición corporal
     baja, BMI > 27) → acción de fuerza.
   - Repetir con valores que produzcan M débil (ayuno corto, cena
     tarde 22h) → acción de ayuno 14h.
   - Click "Guardar mi reporte" → registro → dashboard muestra la
     MISMA acción en la card destacada y el pilar débil tiene
     `ring-2 ring-accent/40` en el grid.
   - Caso óptimo: registrarse y editar manualmente los blocks en
     Firestore a (E=0.80, M=0.80, C=0.80) → dashboard muestra copy
     "Tu balance está sólido — mantén tu rutina esta semana" y
     ningún pilar tiene ring.

**Cierre de spec:** al pasar las 4 verificaciones, cambiar Estado a
✅ Cerrada y agregar fecha de cierre arriba.
