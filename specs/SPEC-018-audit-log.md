# SPEC-018 — Audit log de actividad admin

**Estado:** ✅ Cerrada
**Fase:** 4
**Severidad:** MEDIO (defensa / trazabilidad operacional)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-008 (rules de Firestore), SPEC-016b (CRM sobre users)

---

## Contexto

Hoy ningún endpoint admin deja rastro de su actividad. Si un día Carlos sospecha que un artículo fue modificado por error, o que un lead cambió de status sin querer, no hay forma de reconstruir qué pasó. Tampoco hay timeline de cuándo se subió cada imagen, cuándo se publicó cada draft, ni quién corrió un cleanup.

El admin actual es de un solo user (Carlos). El argumento "no necesito audit porque soy yo solo" tiene dos agujeros:

1. **El operador puede equivocarse.** Un click accidental en "borrar artículo" sin log = pérdida silenciosa.
2. **Cuando sume colaborador**, sumar audit log retroactivo es caro. Mejor armarlo desde ya.

Costo de implementación: bajo. Los handlers ya tienen toda la info necesaria — solo hay que escribirla.

## Problema

1. **Sin trazabilidad de mutaciones.** No se puede responder "¿cuándo cambió este lead a converted?".
2. **Sin timeline operativo.** No se ve "publiqué 3 artículos esta semana" sin contar a mano.
3. **Sin defensa contra acciones no autorizadas.** Si la cookie admin se filtrara, no sabríamos qué hizo el atacante.

## Solución propuesta

### 1. Collection nueva `admin_audit_log`

Schema:

```ts
{
  action: string,         // 'create_post' | 'update_post' | 'delete_post'
                          // | 'update_lead' | 'upload_image' | 'cleanup'
  resource: string,       // 'post' | 'lead' | 'image' | 'system'
  resourceId: string | null,  // id del doc afectado (null si no aplica, ej. cleanup)
  changes: {              // delta resumido: solo los campos modificados
    [field: string]: { before: unknown, after: unknown }
  } | null,
  performedAt: string,    // ISO
  performedBy: string,    // 'admin' por ahora; cuando sume colaborador → email/username
  ip: string | null,      // del header x-forwarded-for
}
```

Path: `admin_audit_log/{autoId}`. Sin sub-collections.

### 2. Helper reusable `logAdminAction`

```ts
// src/lib/auditLog.ts
export async function logAdminAction(input: {
  action: string;
  resource: string;
  resourceId?: string | null;
  changes?: Record<string, { before: unknown; after: unknown }> | null;
  request?: Request;  // para sacar IP
}): Promise<void> {
  // No bloqueante: si falla, console.error y seguir.
}
```

Lo invocan los handlers después del éxito de la mutación. Si el log falla (Firestore down, etc.), la acción no se cae — el log es best-effort.

### 3. Inyectar en handlers admin

- `posts.ts POST` → action='create_post', changes=null, resourceId=docId.
- `posts.ts PUT` → action='update_post', changes={ status, title, ... } solo de campos que cambiaron, resourceId=id.
- `posts.ts DELETE` → action='delete_post', resourceId=id (con changes={ title: { before, after: null } } si está disponible).
- `leads.ts PUT` → action='update_lead', changes={ status, notes, tags } de los campos en el body.
- `cleanup.ts` → action='cleanup', resource='system', resourceId=null.
- `upload-image.ts` → action='upload_image', resource='image', resourceId=fileName.

### 4. Endpoint GET `/api/admin/audit-log?limit=100`

Devuelve los logs ordenados por `performedAt desc`, con paginación por cursor en el futuro. Hoy con `limit(100)` alcanza.

### 5. Visor en el dashboard como tab `AUDIT`

`AuditLog.tsx`: tabla con columnas `Fecha | Acción | Recurso | Detalle | Performed by`. Filtros por tipo de acción (chips), búsqueda por resourceId.

### 6. Reglas de Firestore

`admin_audit_log/{doc}` queda con `read, write: if false` (solo Admin SDK). Match explícito para que el default deny no aplique con falso negativo.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Sumar `ADMIN_AUDIT_LOG` a `COLLECTIONS` y rule en `firestore.rules`.
3. Crear `src/lib/auditLog.ts` con el helper.
4. Inyectar `logAdminAction` en los 6 handlers admin.
5. Crear `src/pages/api/admin/audit-log.ts` (GET).
6. Crear `src/components/admin/AuditLog.tsx` con la tabla.
7. Sumar tab `AUDIT` al `AdminApp.tsx`.
8. Build + commit + push.
9. Verificación: en producción, mover un lead de status, publicar un post, borrar un post, ver el tab AUDIT con los 3 entries en orden cronológico.

## Criterios de aceptación

- [x] Cada mutación admin (post create/update/delete, lead update, cleanup, upload) escribe un doc en `admin_audit_log`.
- [x] El log es **no bloqueante**: si falla la escritura, la acción original sigue funcionando (con `console.error`).
- [x] El visor muestra los logs ordenados por fecha desc.
- [x] Filtros por tipo de acción funcionan.
- [x] Reglas de Firestore bloquean lectura/escritura del log desde el cliente Web SDK.
- [x] El campo `changes` solo incluye los campos que cambiaron, no el doc entero.
- [x] El log incluye IP cuando está disponible (header x-forwarded-for).

## Pruebas manuales

1. Login admin → `/admin` → tab `AUDIT` → la tabla puede estar vacía o con logs viejos.
2. Cambiar el status de un lead → AUDIT muestra `update_lead` con changes={ status: { before, after } }.
3. Crear un draft de post → AUDIT muestra `create_post`.
4. Editar y publicar el draft → AUDIT muestra `update_post` con `status: { before: 'draft', after: 'published' }`.
5. Borrar el post → AUDIT muestra `delete_post`.
6. Filtro por "leads" → solo muestra entries de leads.
7. Como user normal logueado, intentar leer `/admin_audit_log` desde Web SDK → bloqueado por rules (defensa en profundidad).

## Riesgos y trade-offs

- **Best-effort logging.** Si Firestore está caído, el log se pierde. Aceptable: la acción admin tiene precedencia sobre la auditoría.
- **`changes` superficial.** No diff profundo de objetos (ej. cambios dentro de `metadata.title` no se rastrean). Para eso hace falta deep-diff, out-of-scope para v1.
- **Sin retención automática.** Los logs crecen sin tope. Aceptable hasta ~10k entries; después conviene trim manual o función programada. Documentado en backlog.
- **`performedBy = 'admin'` hardcoded.** Cuando sume colaborador, hay que extender el contrato de cookie admin para incluir identidad. Aviso en el código.

## Compatibilidad con ElenaApp

100% del lado web admin. ElenaApp ignora `admin_audit_log`. Sin acoplamiento.

## Commit

```
feat(spec-018): audit log de actividad admin

- Collection admin_audit_log con shape canónico (action/resource/changes)
- Helper logAdminAction reusable, no bloqueante
- Inyectado en posts.ts (POST/PUT/DELETE), leads.ts PUT, cleanup.ts,
  upload-image.ts
- Endpoint GET /api/admin/audit-log con limit + filtros
- Visor AuditLog.tsx como tab AUDIT en el dashboard, con filtros por
  tipo de acción y search
- firestore.rules bloquea lectura/escritura desde cliente

Cierra SPEC-018.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/lib/constants/firestore.ts` — sumada constante `ADMIN_AUDIT_LOG = 'admin_audit_log'`.
- `metamorfosis-web/src/lib/auditLog.ts` — nuevo helper `logAdminAction` no-bloqueante con extracción de IP.
- `metamorfosis-web/src/pages/api/admin/posts.ts` — log en POST/PUT/DELETE con `changes` para los campos del body.
- `metamorfosis-web/src/pages/api/admin/leads.ts` — log en PUT con changes para status/notes/tags.
- `metamorfosis-web/src/pages/api/admin/cleanup.ts` — log de la acción.
- `metamorfosis-web/src/pages/api/admin/upload-image.ts` — log con resourceId=fileName.
- `metamorfosis-web/src/pages/api/admin/audit-log.ts` — nuevo endpoint GET con limit+filtro por action.
- `metamorfosis-web/src/components/admin/AuditLog.tsx` — visor con tabla, chips de filtro, search.
- `metamorfosis-web/src/components/admin/AdminApp.tsx` — sumado tab AUDIT con lazy load.
- `firebase/firestore.rules` — match explícito de `admin_audit_log` con read/write: if false.

**Decisiones tomadas en la marcha:**
- **`changes` solo si son distintos**: el helper compara `before !== after` antes de incluir el campo, así el log no se infla con campos sin cambios reales.
- **IP best-effort**: si no hay headers de proxy, queda `null` (no `'127.0.0.1'`) para distinguir auditoría real vs local.
- **Lazy load del visor** (igual que AnaliticaIMR): la tabla puede crecer y no se necesita en cada visita al dashboard.
- **Sin retención automática**: documentado en backlog. Trim manual cuando se acerque a 10k entries.

**Sin desviaciones del plan funcional.** Todos los criterios de aceptación quedan cumplidos.
