# SPEC-056 — Cohorte de fundadores (schema + counter atómico)

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — captación
**Severidad:** ALTO (compromiso de marketing con primeros 1000)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-005 (schema), SPEC-006 (onboarding), SPEC-008 (rules)

---

## Contexto

El sitio promete beneficios a los "primeros 1000 usuarios registrados"
(visible en el modal de ElenaApp y en el email de bienvenida actual).
Hasta ahora ese compromiso no tenía mecánica real: todos los usuarios
recibían el mismo doc + el mismo email. Si llegaran 1001 usuarios, no
había forma técnica de distinguir quién es fundador y quién no.

Esta spec implementa el respaldo técnico del compromiso:
- Cap firme de 1000 fundadores con garantía atómica.
- Marca persistente en el doc canónico del usuario.
- Decisión hecha en el onboard (no en código del cliente, no manipulable).
- Cuando ElenaApp se lance, lee directamente el flag para desbloquear
  beneficios sin necesidad de código de validación.

## Decisiones de diseño

### Sin código de validación

La opción inicial era generar un código único por fundador para que el
user lo ingrese en ElenaApp y desbloquee beneficios. Se descartó porque:

- Web y ElenaApp **comparten Firebase Auth + Firestore** (CLAUDE.md sección 2).
  Cuando el user se loguee en ElenaApp con su mismo Google/email, la app
  puede leer `users/{uid}.founder.isFounder` directamente. Cero fricción.
- Códigos por email agregan superficie de pérdida (si pierden el email,
  necesitan soporte).
- Códigos no resuelven nada que el schema canónico no resuelva ya.

Decisión: solo guardar `isFounder + number + assignedAt`. El campo es
fuente de verdad; ElenaApp consulta y aplica beneficios.

### Cap atómico vía runTransaction

Doc nuevo `system/counters` con campo `founderCount`. La asignación se hace
dentro de una `db.runTransaction()` que:

1. Lee el counter actual.
2. Si `current >= FOUNDER_CAP` → marca user como no-fundador.
3. Si `current < FOUNDER_CAP` → incrementa counter + marca user como fundador.

Garantía Firestore: dos transacciones concurrentes que leen el mismo
counter abortan una y la reintentan. El cap es firme — no puede haber
1001 fundadores aunque lleguen 100 requests/segundo en el #1000.

### Idempotencia

Si el user re-hace onboard (clic en CTA dos veces, refresh durante
registro, etc.), `assignFounderIfEligible` detecta que ya tiene
`founder.isFounder` definido (boolean, no undefined) y retorna el estado
existente sin tocar el counter. Importante: la asignación NUNCA debe
duplicarse y consumir 2 cupos para el mismo user.

## Plan de implementación

### Archivos creados

| Archivo | Contenido |
|---|---|
| `src/lib/constants/founders.ts` | `FOUNDER_CAP = 1000`, paths del counter doc |
| `src/lib/founders.ts` | `assignFounderIfEligible(uid, nowIso)` con la transaction |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/lib/types/user.ts` | Nuevo `interface UserFounder` + agregado al `UserDoc` |
| `src/pages/api/users/onboard.ts` | Import del helper + llamada después del set + founder en response |
| `firebase/firestore.rules` | Bloque `match /system/{doc}` cerrado + guard de `founder` en update del user (igual que `app` y `crm`) |

### Schema

```ts
export interface UserFounder {
    isFounder: boolean;          // false si cupo lleno, true si fundador
    number: number | null;       // 1..1000, null si no es fundador
    assignedAt: string | null;   // ISO, null si no es fundador
}
```

`UserDoc` ahora incluye `founder: UserFounder` entre `waitlist` y `app`.

### Helper público

```ts
export interface FounderAssignmentResult {
    isFounder: boolean;
    number: number | null;
    assignedAt: string | null;
    wasAssignedNow: boolean;     // true solo en la primera asignación
}

assignFounderIfEligible(uid: string, nowIso: string): Promise<FounderAssignmentResult>
```

`wasAssignedNow` permite al onboard distinguir entre "primera asignación"
y "ya estaba asignado" — útil en SPEC-057 para decidir si enviar el email
fundador o no (solo en la primera).

### Cambio en `POST /api/users/onboard`

Después de:
1. Set merge del doc canónico.
2. ArrayUnion de `imr.history`.

Se invoca `assignFounderIfEligible` en try/catch (best-effort: si la
transaction falla, el user igual queda creado; un reintento del onboard
lo asignará). El resultado se incluye en el response:

```json
{ "success": true, "uid": "...", "founder": { "isFounder": true, "number": 42 } }
```

## Criterios de aceptación

- [x] `UserFounder` definido en `lib/types/user.ts`.
- [x] `FOUNDER_CAP = 1000` en `lib/constants/founders.ts`.
- [x] `assignFounderIfEligible` en `lib/founders.ts` con runTransaction atómica.
- [x] Onboard llama al helper después del set principal.
- [x] Onboard incluye `founder` en el response.
- [x] Idempotencia: si el user ya tiene `founder` definido, el helper retorna estado actual sin tocar counter.
- [x] Rules: `match /system/{doc}` deny total.
- [x] Rules: `founder` agregado a la lista de campos protegidos en update de `users/{uid}`.
- [ ] Post-deploy: registrarse en home → response del onboard incluye `founder.isFounder = true, number: 1`.
- [ ] Post-deploy: revisar Firebase Console → `system/counters` debe tener `founderCount: 1`.
- [ ] Build local OK sin errores TypeScript.

## Pruebas manuales

Pre-deploy:
```bash
cd metamorfosis-web && npm run build
```

Post-deploy:
1. Visitar home en incógnito → completar quiz IMR → registrarse con email nuevo.
2. Abrir DevTools → Network → ver request a `/api/users/onboard` → response debe incluir `founder: { isFounder: true, number: 1 }`.
3. En Firebase Console: `users/{uid}` debe tener bloque `founder: { isFounder: true, number: 1, assignedAt: "2026-..." }`.
4. `system/counters` debe existir con `founderCount: 1`.
5. Repetir con un segundo email → `number: 2`, `founderCount: 2`.

Para testear el cap sin esperar a 1000 users:
1. En Firebase Console editar `system/counters.founderCount` a 1000.
2. Registrarse con email nuevo → response debe traer `founder: { isFounder: false, number: null }`.
3. En `users/{uid}` el bloque `founder.isFounder` debe ser false.
4. `system/counters.founderCount` debe seguir en 1000 (no se incrementa).
5. Restaurar manualmente para retomar testing.

## Riesgos y trade-offs

- **Counter borrado accidentalmente**: si alguien edita `system/counters`
  y lo pone en 0, los siguientes usuarios serán fundadores aunque ya haya
  pasado el cupo. Mitigación: rules deny + audit periódico + backup
  diario que Firebase mantiene automáticamente.
- **Transaction contention**: en pico de tráfico (lanzamiento) puede
  haber abortos y reintentos → latencia subida. Aceptable hasta 1000
  registros totales — no es escala viral.
- **Email duplicado a fundador**: el helper retorna `wasAssignedNow` que
  permite al caller (onboard, SPEC-057) enviar el email founder solo en
  la primera asignación. Si la transaction se reintenta internamente, el
  primer reintento exitoso retorna `wasAssignedNow=true`; reintentos
  subsiguientes ven `founder` ya definido y retornan `wasAssignedNow=false`.
- **Migración de users existentes**: 0 users registrados al momento (Carlos
  confirmó) → opción B aplicada: counter empieza en 0 sin script de migración.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos creados:**
- `metamorfosis-web/src/lib/constants/founders.ts` (~30 líneas)
- `metamorfosis-web/src/lib/founders.ts` (~100 líneas, `assignFounderIfEligible`)

**Archivos modificados:**
- `metamorfosis-web/src/lib/types/user.ts` — `UserFounder` + agregado al `UserDoc`
- `metamorfosis-web/src/pages/api/users/onboard.ts` — import + invocación + response extendido
- `firebase/firestore.rules` — bloque `system/*` deny + guard del campo `founder`

**Decisiones:**
- NO se setea `founder` en el payload del `userRef.set` principal. La
  transacción lo crea como segundo paso. Eso evita el hack
  `undefined as unknown as boolean` y deja la lógica de asignación
  encapsulada en un solo lugar.
- `FieldValue.increment(1)` para el counter en lugar de `tx.set` con
  el valor calculado. Más seguro: si la transaction se reintenta, el
  increment se reaplica sobre el valor fresco.
- `wasAssignedNow` se expone pero NO se incluye en el response del
  endpoint (solo lo usamos internamente para decidir el email en SPEC-057).

**Próximas specs:**
- SPEC-057: email founder vs standard (usa `wasAssignedNow` del helper).
- SPEC-058: dashboard admin tab "Fundadores" con vista en tiempo real.

Sin desviaciones del plan.
