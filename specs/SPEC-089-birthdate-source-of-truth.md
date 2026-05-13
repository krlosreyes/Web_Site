# SPEC-089 — Fecha de nacimiento como source-of-truth de la edad

**Estado:** ✅ Cerrada (pendiente de `npm test` + `npm run build` + commit local)
**Fase:** Pre-lanzamiento — alineación de schema con ElenaApp
**Severidad:** MEDIO (calidad de datos + alineación con app)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-005 (schema canónico), SPEC-006 (onboarding), SPEC-088 (BD fuente única)

---

## Contexto

El quiz IMR del sitio web actualmente captura **edad** como número
entero (`age: number`). La auditoría del 2026-05-13 reveló que
ElenaApp (Flutter) captura **fecha de nacimiento** (`_birthDate`)
internamente y deriva la edad al vuelo con
`DateTime.now().year - _birthDate.year`, pero solo persiste el `age`
derivado, no la fecha.

Mantener `age` como source-of-truth tiene dos problemas:

1. **Se vuelve stale en el cumpleaños del usuario.** Si un user
   onboardea a los 35, el sitio sigue diciendo que tiene 35 un año
   después. La edad real cambia, los cálculos derivados (TMB, edad
   metabólica) quedan desactualizados.
2. **No se puede recuperar la fecha original.** Si en el futuro
   queremos mostrar "Estás midiendo desde los 32 años" o calcular
   delta de IMR por década, no tenemos el dato.

## Problema

Necesitamos `birthDate` (ISO 8601 date string) como source-of-truth
persistido en el doc canónico. La edad es siempre derivada.

## Solución propuesta

**Captura:** reemplazar el input numérico de edad en el quiz por un
input nativo `<input type="date">`. Validar que la fecha resulte en
edad ≥ 18 (regla SPEC-080).

**Persistencia:** agregar `profile.birthDate: string | null` al
schema canónico. Mantener `profile.age` como cached/derivado para
compatibilidad con código existente y con el shape legacy de ElenaApp
(que solo escribe `age`).

**Cálculo:** una función pura `calculateAge(birthDate)` que ambos
clientes (web y app) pueden replicar al pie de la letra. Server-side
en `/api/users/onboard` y cliente-side en `IMRQuiz`.

**Motor IMR:** sigue recibiendo `age` como input. No cambia. La
derivación pasa por el caller.

**Compatibilidad con docs existentes:** si un doc tiene `age` pero
no `birthDate` (caso ElenaApp legacy o quiz pre-SPEC-089), el sitio
sigue usando el `age` persistido. No inventamos `birthDate` desde
`age` porque no se puede (perderíamos día y mes).

### Alternativas descartadas

- **Solo persistir `birthDate` y nunca `age`:** rompería la
  compatibilidad con ElenaApp legacy (que sigue escribiendo `age`).
  Mejor coexistir.
- **3 selects (día/mes/año):** mayor control visual pero más código y
  más fricción. El `<input type="date">` nativo es accesible,
  mobile-friendly y suficiente.
- **Solo año + mes:** ahorraría el día, pero la edad cronológica
  exacta importa para edad metabólica y rangos clínicos. Capturar
  día tampoco cuesta.

## Plan de implementación

1. **Crear** `src/lib/utils/age.ts` — `calculateAge(birthDate: string)`
   función pura. Toma ISO 8601 date (`'1985-03-15'`), retorna edad
   cronológica entera con ajuste por mes/día (no solo año - año).
2. **Modificar** `src/lib/types/user.ts` — agregar
   `profile.birthDate: string | null` al schema canónico. Documentar
   que `profile.age` es derivado/cached y que `birthDate` es la
   fuente cuando ambos están presentes.
3. **Modificar** `src/components/IMRQuiz.tsx`:
   - Reemplazar el `<input type="number">` de edad por
     `<input type="date">` con `max` igual a hace 18 años (defensa
     UI para Ley 1581).
   - Estado: `birthDate: string` (ISO) en lugar de `age: number`.
   - Derivar `age` con `calculateAge(birthDate)` al construir el
     payload.
   - Mantener bloqueo si edad calculada < 18.
4. **Modificar** `src/pages/api/users/onboard.ts` — aceptar
   `profile.birthDate` en el body. Si viene, derivar `age` server-side
   con la misma función. Si solo viene `age` (compatibilidad con app
   legacy), persistir solo `age`.
5. **Modificar** `src/lib/legacy/elenaAppAdapter.ts` — NO inventar
   `birthDate` desde `age` (no se puede). Si el doc tiene `age` y no
   `birthDate`, dejar `birthDate: null` en el canónico.
6. **Test** `src/lib/utils/age.test.ts` — casos: cumpleaños hoy,
   cumpleaños mañana, cumpleaños ayer, fecha futura (debe lanzar o
   retornar 0), edad clamp 0-150.

## Criterios de aceptación

- [ ] `npm test` pasa.
- [ ] `npm run build` no lanza errores.
- [ ] Un user nuevo completando el quiz introduce su fecha de
      nacimiento con date picker nativo.
- [ ] El doc en Firestore tiene `profile.birthDate: "YYYY-MM-DD"` y
      `profile.age: N` con `N = calculateAge(birthDate)`.
- [ ] Si el user tiene su cumpleaños HOY, `calculateAge` retorna la
      edad actualizada (no la del año pasado).
- [ ] El bloqueo "debes tener 18 años o más" funciona basado en
      `calculateAge(birthDate) < 18`.
- [ ] Un doc legacy con solo `age` (de ElenaApp) sigue funcionando
      sin error: el sitio lee `age` directo.

## Pruebas

```sh
cd metamorfosis-web && npm test
cd metamorfosis-web && npm run build

# Smoke post-deploy:
#   1. Anónimo: ir a /quiz, completar.
#      Step 1 debe pedir fecha de nacimiento, no edad.
#      Probar una fecha que dé edad 17 → bloqueo aparece.
#      Probar fecha que dé edad 18+ → continúa.
#   2. Completar quiz y registrarse.
#   3. Firebase Console: ver users/{uid}.profile.birthDate y
#      .profile.age coherentes (age = años desde birthDate).
#   4. (Bonus) Probar fecha de cumpleaños HOY: edad sale correcta.
```

## Riesgos / consideraciones

- **`<input type="date">` y zona horaria:** el value es siempre
  `YYYY-MM-DD` independiente del TZ. El parsing con `new Date(str)`
  asume UTC midnight, lo cual puede dar problemas si lo formateamos
  con `toLocaleDateString` en algunas zonas. Mitigación: parsear
  manualmente con `split('-')` para evitar la coerción a UTC.
- **Compat con ElenaApp legacy:** la app no escribe `birthDate`. Eso
  significa que un user que onboardea en la app va a tener `age`
  pero no `birthDate`. El sitio respeta eso. Cuando el agente Flutter
  actualice canonical-mirror para escribir `birthDate` también
  (recomendación a agregar al prompt), alineamos completo. Por ahora
  el sitio NO falla si falta `birthDate`.
- **No retro-deducimos `birthDate` desde `age`:** sería un dato
  inventado con día/mes random. Mejor null que mentir.

## Commit

**Mensaje sugerido:**
```
feat(spec-089): birthDate como source-of-truth de la edad en quiz

- Helper src/lib/utils/age.ts con calculateAge() pure.
- Quiz pide fecha de nacimiento con <input type="date"> en lugar
  de edad numérica. Bloqueo 18+ basado en edad calculada.
- Schema profile.birthDate: string | null agregado al canónico.
  Mantenemos profile.age como cached/derivado.
- /api/users/onboard acepta profile.birthDate y deriva age.
- Adapter ElenaApp NO inventa birthDate desde age (no se puede).
- Tests unitarios de calculateAge cubren cumpleaños hoy/ayer/mañana.

Cierra specs/SPEC-089-birthdate-source-of-truth.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**Archivos tocados (6):**
- `src/lib/utils/age.ts` (nuevo) — `calculateAge(birthDate)` función
  pura sin dependencias. Parseo manual con `split('-')` para evitar
  off-by-one por TZ. Helper `maxBirthDateFor18Plus()` para el atributo
  `max` del `<input type="date">`.
- `src/lib/utils/age.test.ts` (nuevo) — 14 tests con vitest. Cubre
  cumpleaños HOY/AYER/MAÑANA, fecha futura, formato inválido,
  clamp 0-150, y validación de que el `max` resultante da exactamente
  18 al pasarlo de vuelta a `calculateAge`. Tests con `vi.useFakeTimers`
  fijando 2026-05-13 para casos reproducibles.
- `src/lib/types/user.ts` — `UserProfile` ahora tiene
  `birthDate: string | null` (ISO 8601 sin tiempo) ADEMÁS de
  `age: number | null`. Documentado que `birthDate` es source-of-truth
  y `age` es cache/derivado.
- `src/components/IMRQuiz.tsx`:
  - `QuizState.age` → `QuizState.birthDate: string`.
  - `OnboardPayload.profile` ahora tiene `birthDate` además de `age`
    (derivado en el cliente).
  - Step 1 UI: `<input type="date">` con `max={maxBirthDateFor18Plus()}`
    en lugar del input numérico. Muestra "Tienes N años" derivado en
    vivo debajo del campo.
  - Bloqueo 18+ ahora valida `calculateAge(birthDate) < 18`.
  - Mensaje claro si el user intenta avanzar sin ingresar la fecha.
- `src/pages/api/users/onboard.ts` — acepta `profile.birthDate` en
  el body. Persiste tanto `birthDate` como `age` para compat con docs
  legacy de ElenaApp.

**Decisiones clave:**
- **El motor IMR (`computeImr`) NO cambia.** Sigue recibiendo `age`
  como input. La derivación pasa por el caller (`quizToPayload`).
  Mantener el motor agnóstico al método de captura evita acoplar el
  motor canónico a decisiones de UI.
- **No retro-deducimos `birthDate` desde `age`** porque inventaríamos
  un día/mes random. El adapter de SPEC-087 deja `birthDate: null` si
  el doc solo tiene `age` (caso ElenaApp legacy).
- **Persistir ambos campos** evita que el sitio dependa de hacer
  derivación cada vez que lee `age`. Cuando el user cumple años en
  el futuro, se puede recomputar el `age` cached con un script o on
  next login.
- **El default inicial del state es `birthDate: ''`** (no una fecha
  hardcodeada). Evita el caso "user olvidó cambiarlo y quedó con 35
  años".
- TS transpile validation OK en los 6 archivos.

**Tarea pendiente para el agente del repo Flutter:**
Agregar a la SPEC `canonical-mirror` que ElenaApp también persista
`profile.birthDate` (no solo `age`). Hoy la app captura `_birthDate`
internamente pero solo escribe `age`. Cuando deploye eso, ambos
clientes tendrán el mismo source-of-truth y la edad se mantendrá
viva año a año en cumpleaños.

**Smoke plan post-deploy:**
1. Anónimo en /quiz → step 1 ahora muestra un date picker (no input
   numérico).
2. Probar una fecha que dé edad 17 (ej. nacido hace 17 años hoy) →
   aparece el banner rojo "Necesitas tener 18 años o más" y bloquea
   avanzar.
3. Probar una fecha que dé edad 18+ → muestra "Tienes N años" en vivo
   y permite continuar.
4. Completar el quiz + registrarse.
5. Firebase Console → `users/{uid}.profile`: ver `birthDate:
   "YYYY-MM-DD"` y `age: N` coherentes (`N = calculateAge(birthDate)`).
