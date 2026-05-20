# SPEC-100 — Plan IMR de 14 días personalizado por pilar débil

**Estado:** 🔨 En progreso (código listo, pendiente: `npm test` + `npm run build` + commit + push)
**Fase:** Bloque B del plan estratégico 2026-05-19 (cierre del funnel del quiz)
**Severidad:** ALTA (cierra la promesa explícita hecha al usuario en SPEC-099)
**Fecha de creación:** 2026-05-19
**Autor:** Carlos Reyes
**Depende de:** SPEC-099 (pilar débil + acción semanal), SPEC-088 (BD fuente única), SPEC-006 (onboarding)

---

## Contexto

SPEC-099 cerró el paso 2 del quiz prometiéndole al usuario, al momento del registro:

> *"Acceso a tu dashboard de seguimiento + plan IMR de 14 días"*

Hoy, tras registrarse, el usuario llega al dashboard pero NO hay plan de 14 días en ninguna parte. La promesa queda abierta. Esto erosiona credibilidad la misma semana en que SPEC-098 limpió las métricas inventadas. Necesitamos cerrar el ciclo.

Adicionalmente, `src/data/metabolicProtocol.ts` ya tiene un `DAILY_PROTOCOL` de 7 días (no 14), con narrativa coherente día 1 → día 7 ("depleción de glucógeno" → "switch metabólico" → "baseline"). El día 7 dice *"este es tu nuevo baseline, para automatizar el mantenimiento necesitas conectar tu sistema a una plataforma de monitoreo continuo"* — apunta a ElenaApp. Material reutilizable, pero con dos problemas: (a) son 7 días, no 14; (b) el tono es militar (*"Hard Reset"*, *"Corte de Suministro"*) y el protocolo es agresivo (ayuno 16-18h estricto, fuerza en ayunas) — no es adecuado para un usuario con pilar de Conducta débil.

## Problema

Tres capas:

1. **Promesa abierta**: el quiz vende un plan que el dashboard no entrega.
2. **Contenido existente desalineado**: DAILY_PROTOCOL es un protocolo de ayuno agresivo único, no se adapta al pilar débil de SPEC-099. Tono militar que riñe con SPEC-054 (copy en español neutro) y con la versión post-rediseño de marca.
3. **Sin coherencia con SPEC-099**: si el usuario tuvo C débil ("pantallas + hidratación"), el plan debería profundizar en eso, no obligarle a un ayuno estricto.

## Solución propuesta

Plan IMR de 14 días estructurado en **2 fases** (Reset día 1-7, Consolidación día 8-14), con **acciones específicas por pilar débil** en cada día. La columna vertebral del plan es común para todos los usuarios (mismas fases, mismo tema diario, misma narrativa); lo que cambia día a día es la **acción foco** según el pilar débil identificado por SPEC-099.

### Decisiones de Carlos (2026-05-19)

1. **Formato de entrega**: tab/sección del dashboard (`/dashboard/plan`). Sin PDF, sin email. Más liviano e iterable.
2. **Personalización**: 3 versiones del plan según pilar débil (E / M / C). Si el usuario es optimal (`isOptimal=true` de SPEC-099), recibe una versión de mantenimiento con acciones balanceadas.
3. **Reutilización**: usar `DAILY_PROTOCOL` como referencia estructural de la semana 1, suavizando el copy (eliminar "Hard Reset", "Corte de Suministro", lenguaje militar). Semana 2 se escribe nueva con foco en consolidación e integración a la rutina sostenible.

### Arquitectura

```
src/data/plan14d.ts          ← contenido editorial: 14 días × 3 acciones por día
src/lib/imr/plan14d.ts       ← lógica: getPlanForPillar(pillar) + tipos
src/lib/imr/plan14d.test.ts  ← tests: estructura, balance de pilares, tuteo neutro
src/components/Plan14d.tsx   ← componente React que renderiza el plan filtrado
src/pages/dashboard/plan.astro ← página Astro que monta Plan14d
src/components/BioDashboard.tsx ← card nueva que linkea a /dashboard/plan
```

### Estructura de datos

```ts
// src/data/plan14d.ts
export interface DayPlan {
    day: number;                  // 1-14
    phase: 'Reset' | 'Consolidación';
    title: string;                // título común para todos
    description: string;          // 2-3 oraciones explicativas, común
    actions: {
        E: DayAction;             // acción si pilar débil es Estructura
        M: DayAction;             // acción si pilar débil es Metabolismo
        C: DayAction;             // acción si pilar débil es Conducta
    };
}

export interface DayAction {
    title: string;                // 1 oración accionable
    detail?: string;              // 1 oración opcional de contexto
    references?: string[];        // refs opcionales si aplica
}
```

### Función de selección

```ts
// src/lib/imr/plan14d.ts
export function getPlanForPillar(
    pillar: PillarKey | null  // null = optimal, retorna versión de mantenimiento
): DayPlanForUser[];
```

Cuando `pillar=null` (usuario optimal), retorna 14 días con acciones **mezcladas** (la del pilar más bajo de cada día — distinta cada día para no aburrir).

### Acceso desde el dashboard

Agregar una card en `BioDashboard.tsx` debajo del IMR Main Card (en el espacio del `lg:col-span-7`, antes o después de las cards de ElenaApp/Comunidad existentes):

```
┌─────────────────────────────────────┐
│ 📅 Tu plan IMR de 14 días           │
│ Plan personalizado según tu pilar   │
│ de mayor oportunidad: [Pilar]       │
│                                     │
│ [ Ver mi plan →     ]               │
└─────────────────────────────────────┘
```

### Engagement (FUERA DE SCOPE de esta spec)

Marcar días como "completado" con persistencia en Firestore es **fuera de scope**. Esta spec solo entrega el contenido. Si los datos de Cohorte 1 muestran que un tracker de progreso aumenta retención, se abre SPEC-101.

## Plan de implementación

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1 | Crear `src/data/plan14d.ts` con 14 días × 3 acciones + descripciones comunes | nuevo | 2.5 h |
| 2 | Crear `src/lib/imr/plan14d.ts` con `getPlanForPillar()` + tipos | nuevo | 30 min |
| 3 | Tests del módulo: estructura (14 días, todas las claves), balance (cada pilar tiene 14 acciones), tuteo neutro, casos óptimo/no-óptimo | `src/lib/imr/plan14d.test.ts` | 30 min |
| 4 | Componente `Plan14d.tsx`: header con pilar + 14 cards renderizadas + cierre con CTA a ElenaApp | nuevo | 1.5 h |
| 5 | Página `src/pages/dashboard/plan.astro`: gate de auth + monta Plan14d | nuevo | 30 min |
| 6 | Card de acceso al plan en `BioDashboard.tsx` (debajo del IMR card o como columna derecha) | mod | 20 min |
| 7 | Tracking Umami: `plan14d_visto`, `plan14d_dia_expanded` (si los días son colapsables) | `Plan14d.tsx` | 15 min |
| 8 | Build + verificación local | terminal | 15 min |
| 9 | Commit + push | git | 5 min |
| 10 | Verificación post-deploy (90-120s) | producción | 20 min |

**Esfuerzo total estimado:** ~7 horas.

### Si rebalsa, partir en:

- **SPEC-100a** — datos + lógica + tests (`plan14d.ts` × 2 + test). Sin UI. Sale en 3.5 h.
- **SPEC-100b** — UI: `Plan14d.tsx` + página + card en dashboard + tracking. Sale en 3.5 h.

Recomendación: **mantener monolítica**. La división aporta poco porque la UI sin datos no se puede probar (y al revés). Pero queda documentado por si Carlos prefiere shippear en 2 commits.

## Estructura editorial del plan

### Semana 1 — Reset (días 1-7)

Basada en `DAILY_PROTOCOL` existente, con copy suavizado y acciones por pilar:

| Día | Tema (común) | Foco editorial |
|---|---|---|
| 1 | Activa tu cambio metabólico | Baseline + primera intervención por pilar |
| 2 | Acceso a reservas (switch metabólico) | Insulina baja + acción reforzada |
| 3 | Limpieza interna (autofagia) | Renovación celular + extensión del estímulo |
| 4 | Sincroniza tu reloj interno | Ritmo circadiano + hábito ancla |
| 5 | Activa el músculo | Estímulo mecánico + nutrición pre/post |
| 6 | Calidad por encima de cantidad | Densidad nutricional + foco en alimentos reales |
| 7 | Primer corte: dónde estás | Re-medición intermedia + identificación de wins |

### Semana 2 — Consolidación (días 8-14)

Contenido nuevo, alineado a SPEC-099 acción semanal:

| Día | Tema (común) | Foco editorial |
|---|---|---|
| 8 | Convierte lo aprendido en rutina | Integración de hábitos |
| 9 | Pulir lo que ya hace bien | Refinamiento sin aumentar intensidad |
| 10 | Sin altibajos en la energía | Estabilidad metabólica |
| 11 | El estrés mata el progreso | Recuperación + sueño |
| 12 | Segundo corte: qué cambió | Re-medición + comparación día 1/día 7 |
| 13 | Lo que sí puedes mantener | Sostenibilidad post-14d |
| 14 | Tu nuevo baseline | Cierre + CTA a ElenaApp (re-medición continua) |

Las acciones específicas E/M/C por día se redactan en `plan14d.ts` siguiendo el patrón de `weakPillar.ts` (SPEC-099): título corto accionable + detalle de 1 oración + referencias opcionales.

## Criterios de aceptación

- [ ] Tras completar quiz y registrarse, el dashboard muestra una card "Tu plan IMR de 14 días" con el pilar débil identificado y un CTA a `/dashboard/plan`.
- [ ] `/dashboard/plan` renderiza los 14 días con: número, fase, título, descripción común, y la acción correspondiente al pilar débil del usuario.
- [ ] Si el usuario es `isOptimal=true`, el plan muestra una versión de mantenimiento (acciones más livianas, balanceadas).
- [ ] La página tiene gate de auth: usuario no logueado → redirect a `/login`.
- [ ] Tests del módulo pasan (estructura de 14 días, balance de pilares, tuteo neutro).
- [ ] Build limpio (`npm run build` sin errores).
- [ ] Copy en tuteo neutro (regla SPEC-054). Sin "Hard Reset", "Corte de Suministro", etc.
- [ ] El día 14 cierra con CTA explícito a la Cohorte 1000 / ElenaApp para re-medición continua (cierra el ciclo del ecosistema).
- [ ] Sin métricas inventadas en el plan ni en la card de acceso.
- [ ] Lighthouse mobile Performance de `/dashboard/plan` ≥ baseline del dashboard.

## Pruebas manuales

```sh
cd metamorfosis-web && npm test -- plan14d
cd metamorfosis-web && npm run build
```

**Smoke post-deploy:**

1. Anónimo completa quiz con C débil → registra → dashboard muestra card "Tu plan IMR de 14 días · Conducta" → click → `/dashboard/plan` muestra 14 días con acciones de Conducta.
2. Repetir con E débil → acciones de Estructura.
3. Repetir con M débil → acciones de Metabolismo.
4. Editar manualmente blocks en Firestore a (0.80, 0.80, 0.80) → recargar dashboard → plan muestra versión de mantenimiento.
5. Logout → `/dashboard/plan` → redirige a `/login`.
6. Día 14 muestra CTA explícito a ElenaApp/Cohorte.

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Contenido editorial mediocre o genérico (copy sin alma) | Media | Carlos refina copy en `plan14d.ts` después del primer ship. La spec entrega la arquitectura + el primer pase honesto |
| Usuario abre el plan, no ejecuta, no vuelve (engagement bajo) | Media-Alta | Aceptable en v1. Si Cohorte 1 muestra que vale, SPEC-101 agrega tracker de progreso con persistencia |
| El día 14 cierra con CTA a ElenaApp pero ElenaApp no está lista en stores | Alta | El CTA enlaza a `/login?fromWaitlist=1` o al modal de waitlist (SPEC-097), no a un store inexistente. Consistente con SPEC-055/SPEC-097 |
| Pilar débil cambia con re-medición y el plan ya estaba a la mitad | Baja | El plan es stateless: `getPlanForPillar(pillar)` siempre se evalúa con el pilar actual. Si el usuario re-mide en día 7, los días 8-14 reflejan el nuevo pilar. Aceptable |
| Acciones genéricas chocan con condiciones médicas (embarazo, diabetes, lesión) | Media | Disclaimer compact en el header del plan (`<MedicalDisclaimer variant="compact" />`) + nota al pie en cada día con condiciones que requieran |

## Fuera de scope (intencional)

- **Tracker de progreso** (marcar días como completados): SPEC-101 si la data lo justifica.
- **Email transaccional con plan**: SPEC-029 ya envía bienvenida; agregar email diario es overkill v1.
- **PDF descargable**: Carlos descartó por simplicidad operativa.
- **Adaptación dinámica del plan según re-medición intermedia (día 7)**: el usuario ve el plan que corresponde a su pilar débil ACTUAL. Si re-mide y cambia, el plan se actualiza automáticamente. Sin lógica de "este es el plan original, mantenlo".
- **Notificaciones push o recordatorios diarios**: requiere SDK de notificaciones; out of scope.

## Commit sugerido

```
feat(spec-100): plan IMR de 14 días personalizado por pilar débil

- data/plan14d.ts: 14 días × 3 acciones por pilar + 1 acción mantenimiento
- lib/imr/plan14d.ts: getPlanForPillar() + tipos + tests
- components/Plan14d.tsx: render del plan filtrado
- pages/dashboard/plan.astro: ruta con gate de auth
- BioDashboard: card de acceso al plan con pilar identificado

Cierra la promesa de SPEC-099 ("desbloquea tu plan IMR de 14 días").
El día 14 cierra con CTA a ElenaApp para re-medición continua.

Cierra specs/SPEC-100-plan-imr-14-dias.md
```

## Resultado

**Implementación 2026-05-19 — código aplicado en una pasada:**

### Archivos nuevos (5)

- **`src/data/plan14d.ts`** (~340 líneas)
  - 14 días estructurados con título + descripción comunes + 3 acciones específicas (E/M/C).
  - Fase Reset (días 1-7) basada en `DAILY_PROTOCOL` suavizado: copy sin "Hard Reset" ni lenguaje militar.
  - Fase Consolidación (días 8-14) escrita nueva: integración, refinamiento, re-medición intermedia día 7+12, cierre día 14 con CTA a ElenaApp.
  - 8 referencias científicas reutilizables (Schoenfeld, ACSM, Sutton, Wilkinson, Jakubowicz, Chang, Hale & Guan, Boschmann) embebidas como constantes para que las acciones puedan citarlas individualmente.

- **`src/lib/imr/plan14d.ts`** (~90 líneas)
  - Tipo `DayPlanForUser` (plan aplanado con UNA acción por día).
  - Función pura `getPlanForPillar(pillar: PillarKey | null): DayPlanForUser[]`.
  - Rotación E→M→C para usuarios óptimos (`pillar=null`).
  - Helper `pillarLabel()` y constante `PLAN_TOTAL_DAYS` exportados para evitar hardcoding en UI/tests.

- **`src/lib/imr/plan14d.test.ts`** (~130 líneas, ~16 tests con vitest)
  - Estructura (14 días, fases correctas, claves completas).
  - `getPlanForPillar` para E/M/C correctivo + óptimo rotativo.
  - Día 14 menciona ElenaApp y re-medición del IMR.
  - Helper `pillarLabel`.
  - Tuteo neutro en títulos, descripciones y acciones (sin voseo).

- **`src/components/Plan14d.tsx`** (~245 líneas)
  - 4 estados: loading (skeleton), needsAuth (CTA login), needsImr (CTA quiz), with-plan (render completo).
  - Header con pilar identificado + descripción diferenciada según `isOptimal`.
  - 14 cards con día badge + fase + título + descripción + acción del pilar + referencias colapsables.
  - Cierre con CTA a `/dashboard` (preserva el funnel a ElenaApp via dashboard).
  - Tracking Umami declarativo: `plan14d_visto` con pilar.

- **`src/pages/dashboard/plan.astro`** (~25 líneas)
  - Patrón consistente con `dashboard.astro` (BaseLayout + pt-28 + MedicalDisclaimer compact).
  - Container `max-w-3xl` (más angosto que dashboard `max-w-7xl` — el plan se lee mejor en columna estrecha).
  - Monta `Plan14d` con `client:only="react"`.

### Archivos modificados (1)

- **`src/components/BioDashboard.tsx`**
  - Card nueva "Tu plan IMR · 14 días" insertada como primera card de `lg:col-span-7` (antes de ElenaApp waitlist).
  - Solo se renderiza si `weakPillar !== null` (mismo gate que la card de pilar débil de SPEC-099).
  - Copy varía según `isOptimal`: "Plan de exploración con acciones rotativas" vs "Plan enfocado en tu pilar de mayor oportunidad: [Pilar]".
  - Tracking declarativo `data-umami-event="cta_plan14d_dashboard"` + pillar + optimal.

### Verificaciones pasadas en sandbox

- Braces balanceados en los 6 archivos (data 73/73, lib 9/9, test 41/41, componente 67/67, astro 0/0, BioDashboard 121/121).
- Imports cruzados correctos: data → lib → component → page (cadena lineal, sin ciclos).
- Cero voseo en los archivos nuevos.
- Sin métricas inventadas en el plan ni en la card.

### Pendiente para Carlos antes del commit

1. Tests unitarios:
   ```bash
   cd metamorfosis-web && npm test -- plan14d
   ```
   Deben pasar los 16 tests del módulo.

2. Build local:
   ```bash
   cd metamorfosis-web && npm run build
   ```

3. Commit + push:
   ```bash
   git add metamorfosis-web/src/data/plan14d.ts \
           metamorfosis-web/src/lib/imr/plan14d.ts \
           metamorfosis-web/src/lib/imr/plan14d.test.ts \
           metamorfosis-web/src/components/Plan14d.tsx \
           metamorfosis-web/src/pages/dashboard/plan.astro \
           metamorfosis-web/src/components/BioDashboard.tsx \
           specs/SPEC-100-plan-imr-14-dias.md
   git commit -m "feat(spec-100): plan IMR de 14 días personalizado por pilar débil"
   git push
   ```

4. Smoke post-deploy (90-120s):
   - User con C débil → dashboard muestra card "Tu plan IMR · 14 días" con pilar "Conducta" → click → `/dashboard/plan` renderiza 14 días con acciones de Conducta. Día 14 menciona ElenaApp + re-medición.
   - Repetir con E débil y M débil.
   - Editar manualmente blocks a (0.80, 0.80, 0.80) en Firestore → recargar dashboard → card dice "Plan de exploración con acciones rotativas" → `/dashboard/plan` muestra plan con rotación E→M→C→E→M→C…
   - Logout → `/dashboard/plan` → muestra "Inicia sesión para ver tu plan" + CTA `/login` (sin redirect automático).
   - User logueado sin IMR aún (`needsOnboarding`) → `/dashboard/plan` → muestra "Aún no tienes diagnóstico IMR" + CTA `/quiz`.
   - Mobile 375px: cards del plan no se desbordan; el día badge + título de fase + título del día se apilan bien.

**Cierre de spec:** al pasar las 5 verificaciones, cambiar Estado a ✅ Cerrada y agregar fecha de cierre.

**Sobre el copy editorial:** las acciones específicas E/M/C de cada día son un primer pase basado en literatura científica + DAILY_PROTOCOL suavizado + acciones de SPEC-099. Carlos puede iterar el copy directamente en `src/data/plan14d.ts` con commits subsiguientes sin tocar lógica ni UI — el archivo está estructurado para edición editorial fluida.
