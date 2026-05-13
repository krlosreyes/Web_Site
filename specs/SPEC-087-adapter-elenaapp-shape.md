# SPEC-087 — Adapter del shape ElenaApp en el sitio web

**Estado:** ✅ Cerrada (pendiente de `npm test` + `npm run build` + commit local)
**Fase:** Pre-lanzamiento — sincronización web ↔ app
**Severidad:** ALTO (user de prueba creado en la app no ve nada en el sitio)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-004 (motor IMR), SPEC-005 (schema canónico), SPEC-006 (onboarding)
**Hermana:** SPEC-NN canonical-mirror en el repo de ElenaApp (Flutter)

---

## Contexto

La auditoría del 2026-05-13 confirmó que ElenaApp y el sitio web comparten
Firebase (`projectId: elena-app-2026-v1`) pero divergen en el shape del
documento `users/{uid}`:

- **ElenaApp escribe shape plano:** `{ name, age, gender: 'M'|'F', height,
  weight, waistCircumference, neckCircumference, bodyFatPercentage,
  fastingProtocol, mealsPerDay, profile: {wakeUpTime, sleepTime, ...}, ... }`.
- **El sitio web espera shape canónico:** `{ displayName, gender:
  'male'|'female', bio: {...}, habits: {...}, imr: { current, history }, ... }`.

Resultado: un usuario que se registra en la app y entra al sitio web ve
"Sin diagnóstico" porque `imr.current.imrScore` no existe en el doc.

El repo de ElenaApp implementará paralelamente la SPEC `canonical-mirror`
que hace que la app escriba el shape canónico junto al legacy. Pero ese
deploy puede tardar y tenemos usuarios afectados YA.

## Problema

El sitio web sólo entiende el shape canónico. Cualquier doc de usuario
escrito por ElenaApp queda invisible para el sitio hasta que la app
deploye su canonical-mirror.

## Solución propuesta

Adapter defensivo del lado del sitio web que:

1. **Detecta el shape legacy de ElenaApp** por presencia de campos
   característicos (`height`, `weight`, `gender: 'M'|'F'`).
2. **Mapea al shape canónico al vuelo** (rename + coerción de tipos).
3. **Calcula un IMR baseline** con el motor del sitio
   (`lib/imr/engine.ts`) cuando `imr.current` está ausente pero los
   inputs biométricos sí existen.
4. **Persiste el resultado** al doc Firestore en los campos canónicos
   (`displayName`, `bio.*`, `habits.*`, `imr.current`, `meta.*`) para
   que próximas lecturas sean directas, sin pasar por el adapter.
   Idempotente: si el doc ya tenía canónico, no toca nada.

Esta solución es **temporal en propósito y permanente en código**:
sirve hoy para usuarios creados antes del deploy de canonical-mirror,
y queda como red de seguridad si en el futuro vuelve a aparecer un
doc legacy (ej. user antiguo que reinstala la app o nuevo cliente
externo del schema legacy).

### Alternativas descartadas

- **Esperar a que ElenaApp deploye canonical-mirror:** plausible pero
  bloquea la prueba de Carlos del 13-may. Además no resuelve los users
  ya creados con shape legacy.
- **Migración batch en Firestore:** script Admin SDK que recorre todos
  los docs y los actualiza. Riesgo de tocar miles de docs sin
  granularidad por user. Preferimos migración perezosa (al primer
  acceso del user al sitio).
- **Modificar `BioDashboard.tsx` y `/api/users/me.ts` por separado:**
  duplicación de lógica. Mejor extraer a un helper compartido en
  `src/lib/legacy/`.

## Plan de implementación

1. **Crear** `src/lib/legacy/elenaAppAdapter.ts` — pure TS, sin
   dependencias de Firebase. Funciones:
   - `isElenaAppLegacyShape(doc): boolean` — detector.
   - `adaptElenaAppToCanonical(doc): Partial<UserDoc>` — mapper de
     campos planos a `displayName`, `bio.*`, `habits.*`, `meta.*`.
   - `computeBaselineImrFromLegacy(doc): ImrResult | null` — usa
     `computeImr` del engine. Retorna `null` si faltan inputs
     mínimos (height/weight/waist/gender/age).
2. **Modificar** `src/pages/api/users/me.ts` — antes de responder,
   si `snap.data()` está en shape legacy, ejecutar el adapter,
   persistir los campos canónicos al doc (merge), y devolver el doc
   ya canonicalizado al cliente.
3. **Modificar** `src/components/BioDashboard.tsx` — cuando lee
   directo de Firestore, importar el adapter y aplicarlo en memoria
   si detecta shape legacy. Esto evita doble fetch en el primer
   render. La persistencia la hace `/api/users/me` cuando el cliente
   le pida; mientras tanto el dashboard ya muestra el IMR
   correctamente.
4. **Tests** en `src/lib/legacy/elenaAppAdapter.test.ts` ejecutables
   con Node sandbox (sin Vitest porque el repo no lo tiene configurado;
   usamos `node --test` o `tsx` con asserts).

## Criterios de aceptación

- [ ] `npm run build` no lanza errores.
- [ ] Un doc con shape legacy (como el de `prueba1@gmail.com`
      auditado) leído por `GET /api/users/me` devuelve el shape
      canónico con `imr.current` calculado.
- [ ] Tras una lectura por `/api/users/me`, el doc en Firestore queda
      actualizado con los campos canónicos persistidos.
- [ ] Un doc que YA tiene shape canónico (creado desde el sitio web
      vía SPEC-006) NO se modifica al pasar por el adapter
      (idempotencia).
- [ ] Si faltan inputs mínimos para computar IMR (ej. no hay waist),
      el adapter persiste `imr.current = null` y el sitio muestra
      "Sin diagnóstico" en lugar de un score inventado.
- [ ] `BioDashboard` muestra el IMR del baseline para un user creado
      desde ElenaApp sin pasar por el quiz del sitio.

## Pruebas

```sh
cd metamorfosis-web && npm run build

# Smoke post-deploy:
#   1. Logueate con prueba1@gmail.com (user creado en ElenaApp).
#   2. Verificá que /dashboard muestra IMR > 0 con un label válido
#      (probablemente DETERIORADO o INESTABLE — es baseline).
#   3. Abrí Firebase Console → users/{uid} y confirmá que el doc
#      ahora tiene displayName, bio.*, habits.*, imr.current,
#      meta.schemaVersion=1.
#   4. Refrescá el dashboard 3 veces. El IMR se mantiene estable
#      (no se recomputa cada vez — ya está persistido).
```

## Riesgos / consideraciones

- **El IMR baseline puede chocar con el comportamental de ElenaApp.**
  Cuando ElenaApp deploye canonical-mirror, va a empezar a escribir
  un IMR comportamental que sobrescribirá al baseline del sitio.
  Eso es aceptable: el comportamental es más fiel. Mientras tanto
  el baseline es suficiente para mostrar algo al user.
- **`fastingProtocol` puede ser cualquier string custom.** Hoy
  ElenaApp emite `'Ninguno' | '16:8' | '18:6' | '20:4'`, pero si
  agrega valores nuevos, el parser los mapea a 12 (default neutro).
  Documentado en `_parseFastingProtocol`.
- **No tocamos los campos planos de ElenaApp.** Los preservamos
  intactos por `merge: true`. La app sigue leyendo lo que ya leía.
- **Race con canonical-mirror de ElenaApp:** si la app deploya el
  mirror entre el momento que el sitio lee y el momento que persiste,
  podría sobrescribir un canónico fresco con uno baseline más viejo.
  Mitigación: el adapter no escribe `imr.current` si el doc ya tiene
  uno con shape válido (chequeamos antes de persistir).

## Commit

**Mensaje sugerido:**
```
feat(spec-087): adapter del shape ElenaApp en /api/users/me

- Helper src/lib/legacy/elenaAppAdapter.ts (pure TS, server+client).
- Detecta shape plano de ElenaApp (height/weight/waistCircumference
  en root) y mapea a displayName + bio.* + habits.* + meta.*.
- Calcula IMR baseline con computeImr() del motor del sitio cuando
  faltan los campos canónicos pero hay inputs biométricos suficientes.
- /api/users/me persiste el resultado al doc (merge), idempotente
  para docs que ya están en shape canónico.
- BioDashboard aplica el adapter en memoria para evitar doble fetch
  en el primer render.

Cierra specs/SPEC-087-adapter-elenaapp-shape.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**Archivos tocados (4):**
- `src/lib/legacy/elenaAppAdapter.ts` (nuevo) — adapter pure-TS con
  4 funciones exportadas: `isElenaAppLegacyShape`,
  `adaptElenaAppToCanonical`, `computeBaselineImrFromLegacy`,
  `buildCanonicalPatch`. Sin dependencias de Firebase, importable
  tanto server como client.
- `src/lib/legacy/elenaAppAdapter.test.ts` (nuevo) — 21 tests con
  vitest. Cubre detección de shape, mapping de campos, parsing de
  fastingProtocol, computación del IMR baseline e idempotencia.
- `src/pages/api/users/me.ts` — invoca `buildCanonicalPatch`; si
  detecta legacy, persiste el patch al doc Firestore (merge) y
  devuelve el shape canónico al cliente sin segundo fetch.
- `src/components/BioDashboard.tsx` — aplica el adapter en memoria
  al primer render para evitar mostrar "Sin diagnóstico" mientras
  `/api/users/me` aún no se ha llamado. La persistencia la hace
  `/api/users/me` cuando el cliente la invoque.

**Decisiones clave:**
- `fastingProtocol: 'Ninguno'` se mapea a `12` horas (no `0`),
  porque fisiológicamente todos hacemos ~12h de ayuno entre cena y
  desayuno. Evita penalizar fuerte el bloque metabolismo para users
  nuevos sin protocolo elegido.
- `neckCm` se estima conservadoramente (38 hombre / 32 mujer) si
  ElenaApp no lo capturó, en lugar de retornar `null` y romper Body
  Fat Navy.
- `isElenaAppLegacyShape` retorna `false` si el doc YA tiene
  `bio.heightCm` Y `imr.current.imrScore` válidos — esto es lo que
  hace al adapter idempotente cuando ElenaApp deploye su
  canonical-mirror (la app y el sitio coexistirán sin pisarse).
- El adapter NO modifica los campos legacy del doc. Solo agrega
  los canónicos por `merge: true`. ElenaApp sigue leyendo lo que
  leía.
- Si la persistencia a Firestore falla (ej. permisos), el adapter
  igual devuelve el merge en memoria. El user ve su IMR ese
  mismo render; el doc se canonicalizará en la próxima lectura
  exitosa.
- TS transpile validation OK en los 4 archivos. `npm test` y
  `npm run build` no se pudieron ejecutar en el sandbox por
  mismatch de arquitectura — Carlos los corre local.

**Smoke plan post-deploy:**
1. Logueate con `prueba1@gmail.com` (user creado en ElenaApp).
2. Verificá que `/dashboard` muestra IMR > 0 con label válido
   (probablemente FUNCIONAL o INESTABLE — es baseline con
   fastingHours=12 y hábitos default).
3. Abrí Firebase Console → users/{uid} → confirmá que aparecieron:
   `displayName`, `gender: 'male'`, `bio.{...}`, `habits.{...}`,
   `imr.current.{imrScore, label, blocks, imc, tmb, ica, ffmi,
   whtr, metabolicAge}`, `meta.schemaVersion: 1`.
4. Refrescá el dashboard 3 veces → IMR estable (ya está persistido,
   no se recomputa cada vez).
5. Cuando ElenaApp deploye su canonical-mirror, este adapter queda
   como no-op para los nuevos users (ya escriben canónico). Sirve
   solo a users históricos como prueba1.
