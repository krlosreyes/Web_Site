# SPEC-039 — Foro: replies estilo Instagram (2 niveles + @autor)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — UX iteración
**Severidad:** ALTO (UX core)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-038

---

## Contexto

Tras SPEC-038, Carlos reporta:

1. **Numeración visible (`1.1.1.1`) era solo referencia conceptual** — no debe aparecer en el UI.
2. **El árbol se ve plano** — replies de depth 2 quedaban al mismo nivel de indentación que las de depth 1. La cascada no se distinguía.
3. **Pide que se comporte "como redes sociales"** — Carlos referencia explícitamente Instagram / Reddit / etc.

## Análisis

Las redes sociales modernas convergen en **2 niveles visibles**:

- **Instagram**: comment + replies a ese comment. Las replies a una reply se ven en el mismo grupo del comment original con `@autor` en el texto.
- **YouTube**: idem.
- **Twitter/X**: hilo plano por click; al abrir un reply ves su sub-thread.
- **Reddit**: tiene cascada infinita pero se vuelve mobile-hostile pasados ~4 niveles. La mayoría de los foros se quedan en 2.

**Decisión**: emular Instagram — 2 niveles visuales. Si respondés a una reply, tu nuevo reply queda al **mismo nivel** que ella (no más anidado), con `@nombreDelAutorAlQueRespondés` prepended automáticamente en el render.

## Decisiones tomadas (Carlos 2026-05-10)

- Quitar la numeración visible.
- Replies estilo Instagram: 2 niveles visuales máximo, con `@autor` para trazabilidad.

## Solución propuesta

### 1. Server-side: depth cap = 1

Cambio en `replies.ts` POST: `depth = Math.min(1, parent.depth + 1)`. Si respondés a un depth=1, tu reply también es depth=1. **`parentReplyId` se mantiene apuntando al reply real al que respondés** — preserva el lineage para mostrar `@autor` correctamente.

### 2. Frontend — render Instagram-style

`ForumEngine.tsx`:

- `flattenReplyTree` se mantiene (DFS por `parentReplyId` para mostrar replies de un sub-hilo agrupadas debajo del comment top-level), pero **`renderDepth` capeado a 1** para indentación visual.
- **Quitar el badge de numeración**. Solo se renderiza avatar + nombre + tiempo + contenido + acciones.
- **Prefix `@autor`**: si una reply tiene `parentReplyId` distinto al primer comment top-level (es decir, responde a otra reply, no al comment), prepend visual `@nombrePadre` antes del contenido. No se modifica el contenido guardado en Firestore.
- **Indentación**: depth 0 sin indent. Depth 1 con `ml-4 sm:ml-12` + border-left de color (azul al comment original) que se extiende verticalmente conectando todos los replies del mismo grupo.
- Las replies de un comment se agrupan visualmente bajo él hasta que aparece el siguiente comment top-level.

### 3. Sin migración

Replies viejas con `depth=2` se renderizan como depth=1 visual (capeado al render). El campo en Firestore queda con su valor original; el frontend lo trata como 1 al mostrar.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Editar `replies.ts` POST: cambiar cap `Math.min(2, ...)` → `Math.min(1, ...)`.
3. Editar `ForumEngine.tsx`:
   - Quitar el badge de numeración (`<span ...>{number}</span>`).
   - Cambiar la lógica de indentación: `renderDepth` capeado a 1 en `flattenReplyTree`.
   - Lookup de "autor padre" para prefix `@`: si `parentReplyId` no es null Y el padre tiene `parentReplyId` no null → significa que es una reply a otra reply. Mostrar `@authorName` del parent.
4. Build + commit + push.

## Criterios de aceptación

- [x] No se ve ninguna numeración (`1`, `1.1`, etc.) en ninguna reply.
- [x] Comments al topic se ven con indentación 0 (al borde del card padre).
- [x] Replies a un comment se ven indentadas a la derecha (mismo nivel) con border-left común.
- [x] Si respondés a una reply (nivel 1), tu nuevo reply queda al **mismo nivel visual** (no más anidado).
- [x] Las replies a otras replies muestran `@nombreDelAutorPadre` en color destacado al inicio del contenido.
- [x] El border-left vertical conecta visualmente todas las replies del mismo comment.
- [x] En mobile (375px), la indentación es menor pero claramente visible.
- [x] Replies viejas (depth=2) se renderizan correctamente como depth visual=1.

## Pruebas manuales

1. Login → entrar a un topic → escribir comment top-level → aparece sin indentación, sin número.
2. Click "Responder" en ese comment → form inline → enviar → reply aparece indentada con border-left azul.
3. Click "Responder" en la reply anterior → enviar → la nueva reply aparece **al mismo nivel** que la anterior, con `@autorPrev` en color azul al principio del contenido.
4. Entrar a un topic legacy con replies pre-SPEC-039 (`depth=2`) → confirmar que se ven al mismo nivel que las depth=1, no descolgadas.
5. Mobile 375px: confirmar legibilidad y que el contenido no desborda.

## Riesgos y trade-offs

- **Pérdida visual de profundidad real**: si un sub-hilo tiene 4 replies anidadas, las 4 se ven en línea vertical sin distinción. Mitigado con `@autor` prepended para preservar el contexto.
- **Replies viejas con `@autor` automático**: el prefix se calcula dinámicamente del `parentReplyId`. Si el parent fue eliminado, mostramos `@autorEliminado` o similar. Por simplicidad: si el parent no se encuentra en la lista cargada, mostrar `@usuario` genérico.
- **Sin notificaciones cuando te mencionan**: out of scope. Si más adelante hace falta, micro-spec.

## Compatibilidad con ElenaApp

Sin impacto.

## Commit

```
feat(spec-039): foro — replies estilo instagram (2 niveles + @autor)

- Server: depth cap = 1 (era 2). Replies a una reply quedan al mismo
  nivel; parentReplyId preserva lineage real.
- Frontend: quitada numeración visible. Indentación capeada a 1 nivel.
- @autor automático: si una reply responde a otra reply (no al topic),
  prepend visual del nombre del padre en azul/acento al inicio del
  contenido. No modifica el doc guardado.
- Border-left vertical agrupa visualmente todas las replies de un
  comment top-level común.

Cierra SPEC-039.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/api/forum/topics/[id]/replies.ts` — cap `depth` cambiado a 1.
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — quitada numeración, cap visual de `renderDepth=1`, prepend `@autor` cuando reply responde a otra reply.

**Decisiones tomadas en la marcha:**
- **Cap a 1 nivel** (no 2 como en SPEC-038): Instagram lo hace así y es el patrón más claro mobile-first.
- **Lookup del autor del padre client-side**: el frontend ya tiene todos los replies, así que mapearlos al `authorName` del parent es trivial. Sin lookup extra al server.
- **`@autor` en color azul (`text-blue-400`)**: hace contraste con el contenido neutro y se lee como mención.

**Sin desviaciones del plan funcional.**
