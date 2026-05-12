# SPEC-077 — Eliminar fundadores desde admin + counter activo

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — gestión del cohorte fundador
**Severidad:** MEDIO (gestión operativa de Carlos)
**Fecha de creación:** 2026-05-12
**Cerrada:** 2026-05-12
**Autor:** Carlos Reyes
**Depende de:** SPEC-056 (creación del cohorte), SPEC-058 (admin tab),
SPEC-076 (fix endpoint GET)

---

## Contexto

Carlos pidió la capacidad de eliminar fundadores desde el panel admin
con el conteo reflejando correctamente la eliminación. Si elimina al
fundador X, el counter debe bajar de N → N-1 y abrir cupo para que otro
usuario nuevo pueda entrar al cohorte.

Al discutir el modelo, decidimos:

> "El número nos complica y no es necesario que el usuario lo conozca o
> lo tenga presente." — Carlos

Esto simplifica el modelo: el `founder.number` se mantiene en datos
para audit/historial pero **nunca se muestra al usuario final**. Como
nadie lo ve, no hay problema si dos fundadores históricos comparten
el mismo número (uno activo + uno eliminado).

## Modelo final

- **Un solo counter atómico** `system/counters.founderCount`:
  - Incrementa al asignar (`assignFounderIfEligible`).
  - Decrementa al eliminar (`removeFounder`).
  - Es el ÚNICO valor comparado contra `FOUNDER_CAP` en el gate.
- **`founder.number`** queda en el doc del user como audit interno.
  Si tras eliminar+asignar dos fundadores tienen `number=5`, OK — no se
  muestra en ninguna UI pública.
- **`founder.isFounder=false`** marca la eliminación. Conservamos
  `number` y `assignedAt` históricos.

## Solución

### 1) `lib/constants/founders.ts`

- Documentación expandida del `FOUNDER_COUNTER_FIELD` para clarificar
  que es el contador "vivo" (decrementa al eliminar).
- Sin nuevo campo. Se usa el mismo `founderCount` original.

### 2) `lib/founders.ts` — nueva función `removeFounder(uid)`

Transacción atómica:

1. Lee el user. Si no existe → `{ removed: false, countAfter: 0 }`.
2. Si `founder.isFounder !== true` → idempotente, no toca counter,
   devuelve `{ removed: false, countAfter: currentCount }`.
3. Si lo es: lee `founderCount`, decrementa (clamp a 0 como defensa),
   y flipea `founder.isFounder = false` (conservando `number` y
   `assignedAt`).

```ts
const newCount = Math.max(0, currentCount - 1);
tx.set(counterRef, { [FOUNDER_COUNTER_FIELD]: newCount }, { merge: true });
tx.set(userRef, { founder: { isFounder: false, number: ..., assignedAt: ... } }, { merge: true });
```

`Math.max(0, ...)` previene que el counter caiga a negativos si hubiera
una condición de carrera anómala (no debería ocurrir, pero defensa
mínima).

### 3) Endpoint `DELETE /api/admin/founders?uid={uid}`

Handler agregado a `pages/api/admin/founders.ts`:

- Auth gate (cookie admin) idéntico al GET.
- `uid` requerido en query param. 400 si falta.
- Llama `removeFounder(uid)` → respuesta `{ removed, countAfter }`.
- Audit log con `action: 'remove_founder'`, `resource: 'user'`.
- Mensaje de error útil expuesto al cliente (`error.message`) siguiendo
  patrón SPEC-064.

Tipos agregados a `lib/auditLog.ts`:
- `AuditAction`: agregado `'remove_founder'`.
- `AuditResource`: agregado `'user'`.

### 4) UI — `components/admin/FoundersList.tsx`

- Nuevo estado `deletingUid` para feedback visual durante el delete.
- Nueva función `handleDelete(uid, name, email)`:
  - `confirm()` con descripción clara: "Pierde los beneficios.
    Libera un cupo para que otro usuario pueda entrar. Sigue existiendo
    como usuario normal".
  - `fetch DELETE` con `Content-Type: application/json` (regla CLAUDE.md
    sección 4 — sin esto Astro 6 rechaza con 403 CSRF).
  - `credentials: 'include'` explícito.
  - Check `res.ok` + parse body para mensaje útil.
  - `alert()` visible si falla, nunca silencio.
  - Refresh del listado tras éxito.
- Nueva columna "Acciones" en la tabla con botón "Eliminar" por fila.
  Loading state durante la operación.

### 5) UI — `components/BioDashboard.tsx`

Aplicación de la regla "el usuario no ve el número":

**Antes:**
```tsx
<div className="text-2xl font-bold ...">
    #{stats.founderNumber} <span>/ 1000</span>
</div>
```

**Después:**
```tsx
<div className="text-base font-semibold ...">
    Estás dentro del cohorte fundador
</div>
```

El badge "Acceso fundador" sigue prominente con su color amber, pero
sin exponer el número específico. El campo `stats.founderNumber` se
sigue cargando del backend (para detectar SI es fundador), simplemente
no se renderiza.

## Criterios de aceptación

- [x] `removeFounder(uid)` en `lib/founders.ts` con transacción atómica.
- [x] Counter `founderCount` decrementa al eliminar (clamp a 0).
- [x] `founder.isFounder=false` + preserva `number`/`assignedAt` históricos.
- [x] Endpoint `DELETE /api/admin/founders?uid=...` con auth gate.
- [x] Audit log entry `action: 'remove_founder'` resource `'user'`.
- [x] Botón Eliminar en cada fila de FoundersList con confirm + alert si falla.
- [x] Fetch DELETE con `Content-Type: application/json` (regla CSRF Astro 6).
- [x] BioDashboard ya no muestra `#N / 1000` al usuario.
- [ ] Post-deploy: en admin tab Fundadores, eliminar un fundador → counter
      baja → confirm dialog claro → tabla se refresca sin la fila.
- [ ] Post-deploy: al eliminar el último fundador, el siguiente onboard
      vuelve a ser elegible (cupo liberado).

## Riesgos y trade-offs

- **`founder.number` puede colisionar entre eliminado + nuevo**:
  aceptado por decisión de producto (Carlos: "el número no es necesario").
  Si en el futuro se quiere mostrar número en UI, agregar lógica de
  unicidad (ej. usar `founderCountHistorical` separado que no decremente).
- **`Math.max(0, count - 1)`**: defensa mínima. Si en producción se
  detecta que el counter baja por debajo del número real de activos,
  el endpoint GET sigue funcionando porque cuenta `snap.docs.length`
  para los registros y el counter solo sirve como gate.
- **No reasigna automáticamente**: eliminar un fundador NO escala
  automáticamente al "siguiente waitlist". Si Carlos quiere ese
  comportamiento, va en una SPEC futura.
- **El user eliminado no recibe email**: la eliminación no notifica al
  usuario. Es decisión consciente — Carlos puede comunicar manualmente
  si lo necesita.

## Resultado

Implementado en una sola pasada (2026-05-12).

**Archivos modificados:**
- `metamorfosis-web/src/lib/constants/founders.ts` — docstring expandido.
- `metamorfosis-web/src/lib/founders.ts` — función `removeFounder` agregada.
- `metamorfosis-web/src/lib/auditLog.ts` — `AuditAction` + `AuditResource`
  extendidos con `remove_founder` y `user`.
- `metamorfosis-web/src/pages/api/admin/founders.ts` — handler DELETE.
- `metamorfosis-web/src/components/admin/FoundersList.tsx` — handleDelete +
  columna Acciones + botón Eliminar.
- `metamorfosis-web/src/components/BioDashboard.tsx` — banner fundador
  sin número visible.

**Decisiones:**
- Counter único decrementable en lugar de dos counters (vivo+histórico):
  porque el usuario no ve el número, no necesitamos garantizar unicidad
  de números entre vivos+eliminados.
- Conservar `number` y `assignedAt` históricos en el doc del user:
  audit interno sin costo, podría ser útil si en el futuro se requiere
  trazabilidad de "quién era el fundador N originalmente".
- `confirm()` nativo en lugar de modal custom: panel admin de
  single-user, no necesita UX premium (SPEC-064 mismo patrón).
- BioDashboard: cambiamos "#1 / 1000" por copy descriptivo ("Estás
  dentro del cohorte fundador") — comunica el mismo valor sin exponer
  número que es complejo de manejar.

Sin desviaciones del plan.
