# SPEC-088 — La BD es fuente única del IMR

**Estado:** ✅ Cerrada (pendiente de `npm test` + `npm run build` + commit local + cleanup manual del doc de prueba1)
**Fase:** Pre-lanzamiento — corrección arquitectónica
**Severidad:** ALTO (datos inconsistentes entre app y sitio)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-087 (adapter), SPEC-005 (schema canónico)
**Reemplaza parcialmente a:** SPEC-087 (la rama de cálculo baseline)

---

## Contexto

SPEC-087 introdujo el adapter para mapear el shape legacy de ElenaApp
al canónico. Incluía dos funciones:

1. **Mapping de campos** (`adaptElenaAppToCanonical`) — correcto y se
   mantiene.
2. **Cálculo de IMR baseline** (`computeBaselineImrFromLegacy`) —
   INCORRECTO y se elimina.

El cálculo baseline calcula al vuelo usando defaults razonables
(`fastingHours=12, sleepQuality=0.7, exerciseMinutes=20`) cuando el
doc no tiene `imr.current`. El problema: ElenaApp ya calculó su propio
IMR comportamental (43) usando inputs reales del usuario, y el sitio
genera otro IMR diferente (51) usando inputs sintéticos. El usuario
ve **dos números distintos para sí mismo según donde mire**, lo cual
es peor que no ver nada.

## Problema

El sitio web está actuando como fuente de cálculo cuando debería
actuar solo como fuente de lectura. La base de datos es la fuente
única de verdad; cualquier número que el sitio invente al vuelo
desincroniza la experiencia entre web y app.

## Solución propuesta

**Regla arquitectónica:** quien onboardea primero, calcula y persiste
el IMR. Los demás leen del doc. El sitio NUNCA calcula a menos que
sea para persistir (vía el quiz web → `/api/users/onboard`).

Cambios concretos:

1. **`elenaAppAdapter.ts`** — `buildCanonicalPatch` ya no calcula
   `imrCurrent`. La función `computeBaselineImrFromLegacy` se elimina
   o se marca como deprecada. El patch que se persiste solo contiene
   los campos canónicos derivados del mapping (`displayName`, `bio`,
   `habits`, `meta`).
2. **`BioDashboard.tsx`** — cuando `imr.current` es null pero el user
   tiene perfil completo, mostrar un mensaje claro y diferenciado:
   "Tu IMR aún no está disponible. Completa tu primera medición en
   ElenaApp y aparecerá aquí." En lugar de "Sin diagnóstico" (que
   sugiere que algo falló).
3. **Limpieza manual del doc de prueba1:** borrar el campo
   `imr.current` que el adapter dejó en el doc de
   `prueba1@gmail.com`, para que el nuevo flujo entre en efecto y
   ElenaApp pueda escribir su número real cuando deploye
   canonical-mirror.

### Lo que NO cambia

- El quiz web (`IMRQuiz.tsx`) sigue calculando y persistiendo a
  través de `/api/users/onboard`. Eso es legítimo: el sitio es la
  primera puerta del ecosistema para users que llegan vía SEO o
  YouTube; ahí SÍ es fuente de onboarding.
- El adapter sigue mapeando el shape legacy a canónico (rename de
  campos, coerción de tipos, agrupación en `bio.*`/`habits.*`).
  Eso no tiene divergencia con la app porque son los MISMOS datos
  con otro nombre.

## Plan de implementación

1. **Modificar** `src/lib/legacy/elenaAppAdapter.ts`:
   - Quitar import de `computeImr` (ya no se usa acá).
   - Eliminar export de `computeBaselineImrFromLegacy`.
   - En `buildCanonicalPatch`: ya no calcular `imrCurrent`, retornar
     `{ patch, imrCurrent: null }` siempre. Limpiar la firma si
     conviene.
2. **Modificar** `src/lib/legacy/elenaAppAdapter.test.ts`:
   - Quitar el `describe('computeBaselineImrFromLegacy', ...)`.
   - Ajustar el test "patch incluye imr.current" para que valide lo
     opuesto: el patch NO incluye `imr` (la BD es fuente única).
3. **Modificar** `src/components/BioDashboard.tsx`:
   - Diferenciar 3 estados: (a) user sin perfil (necesita
     onboarding), (b) user con perfil pero sin IMR aún (mostrar copy
     "Completa tu primera medición en ElenaApp"), (c) user con IMR
     (mostrar normal).
4. **Modificar** `src/pages/api/users/me.ts`:
   - Sigue mergeando el patch al doc Firestore (sin cambios). Solo
     que ahora el patch nunca trae `imr`.
5. **Cleanup manual** (no es código): Carlos debe borrar el campo
   `imr.current` del doc de `prueba1@gmail.com` en Firebase Console
   para limpiar el 51 fantasma. La SPEC documenta el paso.

## Criterios de aceptación

- [ ] `npm test` pasa sin regresiones. Los tests del adapter ahora
      validan que `imr` NO está en el patch.
- [ ] `npm run build` no lanza errores.
- [ ] Un user con shape legacy entrando al sitio recibe los campos
      canónicos persistidos (`displayName`, `bio.*`, `habits.*`,
      `meta.*`) pero `imr.current` queda como estaba (null o
      ausente).
- [ ] El dashboard distingue visualmente "user sin perfil" de "user
      con perfil sin IMR aún".
- [ ] Tras la limpieza manual del doc de `prueba1`, refrescar el
      dashboard muestra el mensaje "Tu IMR aún no está disponible"
      en lugar de un score numérico.
- [ ] Cuando ElenaApp deploye canonical-mirror y escriba su
      `imr.current` real (ej. 43), el sitio lo lee y muestra ese 43
      sin recalcular.

## Pruebas

```sh
cd metamorfosis-web && npm test
cd metamorfosis-web && npm run build

# Smoke post-deploy:
#   1. Limpiá manualmente el campo imr.current del doc de prueba1
#      en Firebase Console (Database → users/{uid} → eliminar
#      "imr.current").
#   2. Logueate con prueba1@gmail.com.
#   3. Dashboard muestra "Tu IMR aún no está disponible" (no un
#      número).
#   4. El doc en Firestore: bio.*, habits.*, meta.* siguen ahí;
#      imr.current sigue ausente (no se vuelve a calcular).
#   5. Cuando ElenaApp deploye canonical-mirror y escriba
#      imr.current, refrescar el sitio muestra ese número real.
```

## Riesgos / consideraciones

- **UX degradada hasta que ElenaApp persista:** un user de la app
  que entra al sitio HOY (antes del deploy de canonical-mirror) va
  a ver "Tu IMR aún no está disponible". Eso es honesto pero menos
  amigable que ver un número, aunque sea estimado. Decisión: prefiero
  honestidad a confusión. Si ElenaApp persiste el IMR cuando deploye
  su canonical-mirror, el problema se resuelve.
- **El user de prueba `prueba1` ya tiene un `imr.current: 51` viejo
  escrito por SPEC-087.** Sin la limpieza manual, va a seguir
  viéndolo en el sitio. La spec documenta el paso pero requiere
  acción manual de Carlos.
- **Quiz web sigue siendo fuente legítima:** users que se registran
  desde la web (no desde la app) van a tener su IMR calculado por el
  sitio en `IMRQuiz.tsx → /api/users/onboard`. Eso es correcto y se
  mantiene. La diferencia con SPEC-087 es que ahí el sitio calcula
  **una vez al onboardear**, no en cada lectura del adapter.

## Commit

**Mensaje sugerido:**
```
feat(spec-088): la BD es fuente única del IMR

- Adapter SPEC-087 ya no calcula IMR baseline; solo mapea campos
  canónicos (displayName, bio, habits, meta).
- BioDashboard distingue "user sin perfil" de "user con perfil
  sin IMR aún" con copy diferenciado.
- Elimina la divergencia 43 vs 51 entre app y sitio: el sitio lee
  imr.current del doc o muestra mensaje honesto si no existe.
- Tests del adapter actualizados para validar que no se calcula
  baseline.

Cierra specs/SPEC-088-bd-fuente-unica-imr.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**Archivos tocados (4):**
- `src/lib/legacy/elenaAppAdapter.ts` — eliminado export
  `computeBaselineImrFromLegacy`. Quitado import de `computeImr` (ya
  no se usa acá). `buildCanonicalPatch` ahora retorna solo
  `{ patch }` con los campos canónicos derivables; sin `imrCurrent`.
  Comentario de cabecera actualizado documentando la regla
  arquitectónica de "BD es fuente única".
- `src/lib/legacy/elenaAppAdapter.test.ts` — eliminado el bloque
  `describe('computeBaselineImrFromLegacy', ...)`. Ajustado el bloque
  `buildCanonicalPatch` para validar que el patch NO incluye `imr`.
  Total: 17 tests (de 21 antes).
- `src/pages/api/users/me.ts` — comentario actualizado para reflejar
  que el endpoint NO calcula IMR; solo persiste campos canónicos
  derivables. La firma del destructuring queda `{ patch }`.
- `src/components/BioDashboard.tsx` — agregado flag
  `hasProfileNoImr` al state. Diferencia 3 casos: (1) sin perfil →
  banner "Inicia diagnóstico"; (2) con perfil sin IMR → banner
  "Completa tu primera medición en ElenaApp"; (3) con IMR → display
  normal.

**Decisiones clave:**
- **Regla arquitectónica:** quien onboardea primero escribe; los
  demás leen. El sitio escribe `imr.current` solo cuando es origen
  del onboarding (quiz web → `/api/users/onboard`). El adapter NUNCA
  inventa.
- **El doc de `prueba1@gmail.com` aún tiene `imr.current: 51`
  fantasma escrito por SPEC-087.** Para que SPEC-088 entre en efecto
  para ese user, Carlos debe borrar manualmente el campo
  `imr.current` desde Firebase Console.
- TS transpile validation OK en los 4 archivos.

**Smoke plan post-deploy:**
1. **Acción manual:** abrir Firebase Console → Firestore →
   `users/{uid de prueba1}` → eliminar el campo `imr.current` (el
   objeto entero, no solo el subcampo `imrScore`). Esto borra el 51
   fantasma de SPEC-087.
2. Logueate con `prueba1@gmail.com`.
3. Dashboard muestra el banner "Tu IMR aún no está disponible" en
   lugar de un score numérico.
4. Confirmá en Firebase Console que `imr.current` sigue ausente tras
   refrescar el dashboard 3 veces (el sitio no recalcula).
5. Cuando ElenaApp deploye `canonical-mirror` y escriba su
   `imr.current` real (ej. 43), refrescar el sitio muestra ese 43
   sin recalcular. Convergencia.

**Estados convergentes esperados:**
- User registrado en web → quiz calcula → `/api/users/onboard`
  persiste IMR → ElenaApp lo lee al login → ambos muestran lo mismo.
- User registrado en app → `canonical-mirror` persiste IMR → sitio
  lo lee → ambos muestran lo mismo.
- User en transición (registrado en app antes de canonical-mirror) →
  sitio muestra "IMR no disponible" honestamente. Cuando la app
  deploye, el flujo se completa.
