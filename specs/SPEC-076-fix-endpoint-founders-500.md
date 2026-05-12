# SPEC-076 — Fix endpoint `/api/admin/founders` retornaba HTTP 500

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — fix de bug bloqueante
**Severidad:** ALTO (la tab "Fundadores" del admin estaba inutilizable)
**Fecha de creación:** 2026-05-12
**Cerrada:** 2026-05-12
**Autor:** Carlos Reyes
**Depende de:** SPEC-058 (creación original del endpoint)

---

## Contexto

Carlos abrió el dashboard admin → tab Fundadores y vio una card de error:

> ⚠ Error obteniendo fundadores
> HTTP 500

El counter del cohorte se mostraba (`0 / 1000`) porque viene de otra query
en el mismo endpoint, pero el listado de fundadores fallaba.

## Causa raíz

El endpoint `pages/api/admin/founders.ts` (creado en SPEC-058) usaba:

```ts
const snap = await db
    .collection(COLLECTIONS.USERS)
    .where('founder.isFounder', '==', true)
    .orderBy('founder.number', 'asc')
    .get();
```

Firestore exige un **índice compuesto manual** para combinar `where` con
`orderBy` en campos distintos — incluso cuando ambos son sub-paths del
mismo objeto (`founder.isFounder` y `founder.number`).

Cuando el índice no existe, Firestore devuelve un error con un link para
crearlo en la consola. El catch del endpoint atrapaba esto y devolvía 500
genérico.

El comentario original del código decía *"Firestore lo crea automático en
primer query si no existe"* — eso es **falso**. Firestore crea
automáticamente índices simples (un solo campo), pero los compuestos
requieren creación manual.

Otros endpoints del proyecto (biblioteca, stats) ya seguían el patrón
correcto: hacer `where` solo, ordenar en memoria. SPEC-058 fue el único
que se desvió.

## Solución

Dos cambios mínimos:

### 1) Query sin `orderBy`, sort in-memory

```ts
const snap = await db
    .collection(COLLECTIONS.USERS)
    .where('founder.isFounder', '==', true)
    .get();

const founders = snap.docs
    .map(doc => { /* ... */ })
    .sort((a, b) => a.number - b.number);
```

Como `FOUNDER_CAP = 1000`, el sort in-memory es trivial. Sin índice
compuesto requerido.

### 2) Mensaje de error útil en el body

Antes:

```ts
catch (error) {
    console.error('[admin.founders.GET] Error:', error);
    return jsonResponse(500, { error: 'Error obteniendo fundadores' });
}
```

Después:

```ts
catch (error) {
    console.error('[admin.founders.GET] Error:', error);
    const msg = error instanceof Error ? error.message : 'Error obteniendo fundadores';
    return jsonResponse(500, { error: msg });
}
```

Patrón ya usado en `SPEC-064` (delete posts): exponer `error.message` al
cliente. En un panel admin de single-user (solo Carlos) esto no es leak
de información — es debug útil. Si Carlos lo abre a más admins en el
futuro, sanitizar los mensajes.

## Criterios de aceptación

- [x] Endpoint usa `where` solo, sin `orderBy` en Firestore.
- [x] Sort por `founder.number` ASC se hace in-memory.
- [x] `catch` devuelve `error.message` real, no string genérico.
- [x] Comentario del código corregido (Firestore NO crea índices
      compuestos automáticos).
- [ ] Post-deploy: el tab Fundadores del admin carga sin error 500. Con
      0 fundadores el listado es vacío pero la card no muestra el banner
      rojo.

## Riesgos y trade-offs

- **Sort in-memory**: para 1000 docs es instantáneo (~1ms). Si el cap
  alguna vez sube a 10k+, considerar paginación + cursor. Por ahora,
  ese trade-off no aplica.
- **Mensaje de error expuesto**: válido en panel admin de single-user.
  Si se abre a más admins, agregar sanitización (`error.message
  .replace(/firestore/i, 'database')` o similar).
- **No requiere acción en Firestore consola**: el fix evita crear el
  índice manual. Si en el futuro hay otro query que sí lo requiera,
  esa decisión va con su spec propia.

## Resultado

Implementado en una sola pasada (2026-05-12).

**Archivo modificado:**
- `metamorfosis-web/src/pages/api/admin/founders.ts` — query sin orderBy,
  sort in-memory, mensaje de error útil.

**Decisiones:**
- Sort in-memory en lugar de pedir a Carlos crear índice manual:
  resuelve el bug hoy sin acción adicional. Patrón consistente con el
  resto del proyecto.
- Exponer `error.message`: alinea con SPEC-064 (delete posts) y facilita
  el debug futuro.

**Notas operativas:** después del deploy (90-120s), recargar
`/admin/dashboard` → tab Fundadores. Debería verse:
- Counter 0/1000 (igual que antes — viene de otra query, no afectada).
- Listado vacío sin banner rojo de error.
- Cuando se registre el primer fundador, aparecerá ordenado por número.

Sin desviaciones del plan.
