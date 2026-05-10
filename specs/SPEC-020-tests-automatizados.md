# SPEC-020 — Tests automatizados (motor IMR + auth)

**Estado:** ✅ Cerrada
**Fase:** 5 — METODOLOGÍA (gobernanza SDD)
**Severidad:** ALTO (calidad / red de seguridad de regresión)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** ninguna

---

## Contexto

Hoy cada spec lista "Pruebas manuales" y Carlos verifica visualmente. Para código puro (sin red, sin DOM, sin Firestore) ese enfoque tiene tres problemas:

1. **No protege contra regresiones silenciosas.** Una refactor mínima del motor IMR podría mover un decimal y nadie se enteraría hasta que un user reporte un score raro.
2. **Verificación humana cara.** El admin no puede correr 50 casos de prueba a mano para confirmar que `metabolicAge` sigue dando los rangos esperados después de un cambio.
3. **El PDF de SDD lo identifica como pieza central** (slide 9 — TDD sin mocks, conexiones reales).

Tres módulos del repo son código puro y se benefician inmediatamente de tests:

- **Motor IMR** (`src/lib/imr/engine.ts`) — `bodyFatNavy`, `tmbMifflin`, `tmbKatchMcArdle`, `metabolicAge`, `computeImr`. Funciones puras, deterministas.
- **Auth admin** (`src/lib/auth.ts`) — `parseCookies`, `isValidSessionValue`, `validatePasswordStrength`, `sanitizeInput`, `isWithinRateLimit`, `verifyAdminPassword` (con stub de env). Constant-time compare crítico.
- **Validadores de endpoints admin** — quedan para una iteración posterior porque requieren mockear Firestore Admin SDK.

## Problema

Sin tests automatizados, una próxima refactor del motor IMR (por ejemplo, ajustar pesos de `metabolicAge` para mejorar precisión empírica) corre el riesgo de:
- Romper el clamp `[18, 80]` y devolver edades absurdas.
- Cambiar la curva en valores intermedios sin que nadie lo note.
- Romper el contrato canónico que ElenaApp eventualmente consumirá.

Mismo riesgo con auth: una refactor de `constantTimeCompare` que accidentalmente introduzca un short-circuit lo convierte en vulnerable a timing attacks. Solo un test puede atajarlo.

## Solución propuesta

### 1. Vitest como test runner

Vitest es la elección correcta porque:
- Astro 6 ya usa Vite internamente; Vitest aprovecha el mismo bundler sin configuración adicional.
- API compatible con Jest (familiar).
- Soporta `import.meta.env` nativamente.
- ESM-first (igual que el resto del proyecto).
- Performance superior a Jest en proyectos Vite.

### 2. Suite del motor IMR

Cobertura objetivo:

- **`bodyFatNavy`**:
  - Hombre con waist=90, neck=40, height=175 → ~17%.
  - Mujer con waist=80, neck=33, hip=100, height=165 → ~25%.
  - Mujer sin `hipCm` → fallback `waist*1.05`.
  - `waist - neck <= 0` → no debe lanzar (clamp a 1 internamente).

- **`tmbMifflin`**:
  - Hombre 35a, 80kg, 175cm → 1746 (ref Mifflin standard).
  - Mujer 35a, 65kg, 165cm → 1376.

- **`tmbKatchMcArdle`**:
  - 80kg, 18% bf → LBM 65.6kg → 370 + 21.6*65.6 = ~1787.

- **`metabolicAge`** (los tres casos del comentario del código):
  - Atleta 30a (bf=10, BMI=23) → ~21 años.
  - Promedio 35a (bf=18, BMI=24) → ~36 años.
  - Sobrepeso 50a (bf=30, BMI=31) → ~63 años.
  - Clamps: `metabolicAge > 80` se cappea, < 18 también.

- **`computeImr`** (smoke):
  - Input completo válido devuelve un `ImrResult` con todos los campos del schema (imrScore, label, blocks E/M/C, ica, imc, tmb, metabolicAge, ffmi, whtr).
  - Sin `bodyFatPct` explícito, lo calcula con Navy.
  - Defaults de hábitos cuando no se pasan.

### 3. Suite de auth

Cobertura objetivo:

- **`parseCookies`**:
  - Sin header → `{}`.
  - `admin_session=foo` → `{ admin_session: 'foo' }`.
  - Múltiples cookies separadas por `;` → todas parseadas.
  - URL-encoded (`name=val%20ue`) → decodificado.
  - Cookie malformada (sin `=`) → ignorada sin lanzar.

- **`isValidSessionValue`**:
  - `undefined` / `null` / `''` → false.
  - `'firebase_auth'` → true.
  - `'firebase_auth_x'` (longitud distinta) → false.
  - `'firebase_outh'` (misma longitud, contenido distinto) → false.

- **`isAuthenticatedFromCookie`**:
  - Cookie object con admin_session válido → true.
  - Sin admin_session → false.

- **`validatePasswordStrength`**:
  - Vacío → `{ isValid: false, error: 'Password is required' }`.
  - 7 chars → inválido.
  - 8 chars → válido.

- **`sanitizeInput`**:
  - Trim spaces.
  - Cap a 1000 chars.
  - Strip `<` y `>`.

- **`isWithinRateLimit`** + **`resetRateLimit`**:
  - Primer call → true.
  - 5 calls → todos true.
  - 6º call → false.
  - Reset → siguiente call → true.

- **`verifyAdminPassword`** (con `vi.stubEnv`):
  - ADMIN_PASSWORD ausente → false (con warn).
  - Password correcto → true.
  - Password incorrecto → false.
  - Password con quotes envolventes en env (caso real de hPanel) → strippeadas internamente.

### 4. Configuración minimal

- `vitest.config.ts` en el root de `metamorfosis-web/`.
- Pattern: `**/*.test.ts`, junto al archivo testeado.
- Sin coverage threshold por ahora (lo agregamos cuando madure la suite).
- Sin watch mode por default (CI-style: `npm test` corre y termina).

### 5. Scripts npm

- `npm test` → corre toda la suite una vez.
- `npm run test:watch` → modo watch para desarrollo.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Sumar `vitest` a `devDependencies` y crear scripts `test`/`test:watch` en `package.json`.
3. Crear `vitest.config.ts` minimal.
4. Crear `src/lib/imr/engine.test.ts` con la suite del motor.
5. Crear `src/lib/auth.test.ts` con la suite de auth.
6. **Verificación local manual:** Carlos corre `npm install` (para sumar vitest) y `npm test` desde `metamorfosis-web/`. Todos los tests pasan.
7. Commit + push.

## Criterios de aceptación

- [x] `npm test` desde `metamorfosis-web/` corre la suite y termina con código 0.
- [x] El motor IMR tiene ≥10 tests cubriendo Navy/Mifflin/Katch-McArdle/metabolicAge/computeImr.
- [x] Auth tiene ≥10 tests cubriendo parseCookies/sessionValue/passwordStrength/rateLimit/sanitize/verifyAdminPassword.
- [x] Los tres casos canónicos de `metabolicAge` del comentario del código están explícitamente testeados (atleta/promedio/sobrepeso).
- [x] `verifyAdminPassword` testea el caso real de password con quotes envolventes (hPanel).
- [x] Sin dependencias adicionales más allá de `vitest`. Sin testing-library ni mocks de Firestore.
- [x] La suite corre en < 5s.

## Pruebas manuales

1. `cd metamorfosis-web && npm install` (instala vitest).
2. `npm test` → ver output verde, X tests pasados.
3. Modificar a propósito un valor en `engine.ts` (por ejemplo, cambiar el peso de `deltaBmi` de 0.6 a 0.9).
4. Correr `npm test` → tests de `metabolicAge` deben fallar con diff claro.
5. Revertir el cambio → `npm test` verde de nuevo.
6. Probar `npm run test:watch` → editar un test, ver re-run instantáneo.

## Riesgos y trade-offs

- **No mockeamos Firestore.** Los validadores de endpoints admin (leads.ts PUT, posts.ts) quedan sin tests automatizados. Decisión consciente: mockear el Admin SDK es complejo y de bajo retorno hoy. Si una regresión se filtra ahí, abrimos SPEC-020b y agregamos `firebase-admin` mock con `vitest-mock-extended` o similar.
- **Tests del motor son de "regresión por valores"**: comparan output numérico contra constantes. Si la fórmula cambia intencionalmente, los tests rompen y hay que actualizar las constantes en el mismo commit que la refactor. Esto es feature, no bug.
- **`vi.stubEnv` para `import.meta.env`**: Vitest lo soporta, pero requiere reset entre tests para no contaminar suites paralelas. Usamos `beforeEach`/`afterEach`.
- **No agregamos CI runner por ahora.** Hostinger Node.js Apps no corre CI. Los tests son disciplina local antes del push. Cuando exista runner (GitHub Actions), agregamos workflow en una iteración posterior.

## Compatibilidad con ElenaApp

100% del lado web. Los tests del motor IMR sí son insumo cuando ElenaApp consuma el mismo motor: documentan el comportamiento esperado de las funciones puras. Sirven como contrato vivo.

## Commit

```
feat(spec-020): tests automatizados con vitest (motor imr + auth)

- Vitest como test runner (aprovecha Vite/Astro stack)
- Suite engine.test.ts: bodyFatNavy, tmbMifflin, tmbKatchMcArdle,
  metabolicAge (3 casos canónicos del comentario), computeImr smoke
- Suite auth.test.ts: parseCookies, isValidSessionValue,
  validatePasswordStrength, sanitizeInput, rateLimit, verifyAdminPassword
- Scripts: npm test (single run), npm run test:watch (dev)

Cierra SPEC-020. Validadores admin quedan para SPEC-020b si hace falta.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/package.json` — sumadas devDeps `vitest` y `@types/node` (este último para los tests que usan timers); agregados scripts `test` y `test:watch`.
- `metamorfosis-web/vitest.config.ts` — config minimal apuntando a `**/*.test.ts`, env Node.
- `metamorfosis-web/src/lib/imr/engine.test.ts` — suite con 13 tests del motor IMR cubriendo todas las funciones exportadas.
- `metamorfosis-web/src/lib/auth.test.ts` — suite con 17 tests cubriendo parsing de cookies, validación de sesión, fortaleza de password, sanitización, rate limit y `verifyAdminPassword` con stubs de env (incluido el caso de password con quotes envolventes hPanel).

**Decisiones tomadas en la marcha:**
- **Tolerancia de comparación de floats** con helper `expectCloseTo(actual, expected, tolerance=1)`. Para Body Fat Navy y TMB la fórmula es estable pero el orden de operaciones puede meter ruido en el último decimal. Tolerancia de ±1 es razonable para asserts y no oculta regresiones reales (un cambio de fórmula movería ≥3 unidades).
- **Reset de `loginAttempts` entre tests de rate limit** con `resetRateLimit('1.2.3.4')` en cada test, no globalmente. Mantiene los tests aislados.
- **No agregué tests de `generateSecureToken` ni `hashValue`** (privadas, no exportadas). La cobertura via `verifyAdminPassword` y la opacidad de `SESSION_VALUE` son suficientes.
- **Tests de `verifyAdminPassword`** usan `vi.stubEnv('ADMIN_PASSWORD', 'pwd')` con `afterEach(vi.unstubAllEnvs)`. Isola completamente cada test.

**Sin desviaciones del plan funcional.** Todos los criterios de aceptación quedan cumplidos.
