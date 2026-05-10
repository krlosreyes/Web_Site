# SPEC-038 — Foro: replies anidadas + delete topic solo admin

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Engagement / community
**Severidad:** ALTO (UX core del foro)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-033 (foro), SPEC-036 (fixes), SPEC-037 (instant feedback)

---

## Contexto

Tras desplegar SPEC-036 + 037, Carlos reporta:

1. **El botón "Eliminar" del topic propio sigue sin funcionar.** Decisión: en lugar de seguir debugging, **quitar el botón** del UI público. Solo el admin elimina hilos desde el panel `/admin/forum`. Simplifica UX y elimina la fricción.
2. **Falta funcionalidad de respuesta anidada** (cascada `1.1.1.1` estilo redes sociales). Hoy todas las replies son flat al topic — no se puede contestar a una reply específica.

## Decisiones tomadas (Carlos 2026-05-10)

- Topic: solo admin puede eliminar (vía `/admin/forum`).
- Replies anidadas con numeración tipo `1.1.1`.
- "Hilo" = topic (no reply): se quita botón borrar del topic propio. Replies propios siguen borrables (UX estándar y no afectado por el bug).

## Solución propuesta

### 1. Quitar botón delete topic del UI

`ForumEngine.tsx`:
- Eliminar el `<button>` con `handleDeleteTopic` del detail view.
- Mantener `handleDeleteTopic` en el código por si más adelante se reactiva (rendering condicional, no eliminación del handler).

El endpoint `DELETE /api/forum/topics/[id]` queda vivo; solo no se invoca desde la UI pública. La moderación admin (SPEC-033) usa `/api/admin/forum/delete` que es independiente.

### 2. Replies anidadas — modelo

Schema extendido en `forum_topics/{topicId}/replies/{replyId}`:

```ts
{
  ...campos previos...
  parentReplyId: string | null,  // NEW: id del reply padre, null si responde al topic
  depth: number,                  // NEW: 0..2 (3 niveles máx)
}
```

**Profundidad máxima 3 (depth 0, 1, 2).** Cuando alguien responde a una reply de depth=2, su nueva reply se guarda con depth=2 y `parentReplyId` apuntando al reply al que estaba contestando (no a su padre). El render adopta la convención "después de depth 2 todo se ve plano al mismo nivel" pero internamente se mantiene el lineage.

Razón: 3 niveles cubren el ~95% de los casos sin destruir mobile (cada nivel agrega `pl-4` o `pl-6`; depth 5 sería ilegible en 320px).

### 3. Endpoint POST `/api/forum/topics/[id]/replies` extendido

Body acepta `parentReplyId?: string | null`. Validación:

- Si viene: lookup del parent en `replies/{parentReplyId}`.
  - 404 si no existe o `status === 'deleted'`.
  - 400 si pertenece a otro topic (defensa contra inyección).
  - Calcular `depth = Math.min(2, parent.depth + 1)`.
- Si no viene: `depth=0`, `parentReplyId=null`.

Retro-compatibilidad: replies viejos sin `parentReplyId` se tratan como root (`depth=0`).

### 4. UI render recursivo + numeración

`ForumEngine.tsx` agrupa replies por `parentReplyId` y renderiza un árbol:

```tsx
function ReplyTree({ replies, parentId = null, prefix = '', depth = 0 }) {
    const children = replies.filter(r => (r.parentReplyId ?? null) === parentId);
    return children.map((r, idx) => {
        const num = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
        return (
            <>
                <ReplyCard reply={r} number={num} depth={depth} />
                <ReplyTree replies={replies} parentId={r.id} prefix={num} depth={depth + 1} />
            </>
        );
    });
}
```

**Indentación**: `pl-0`, `pl-6 sm:pl-10`, `pl-12 sm:pl-20` para depth 0, 1, 2.

**Numeración**: badge gris `1`, `1.1`, `1.1.1` arriba a la izquierda de cada reply card.

### 5. Botón "Responder" + form inline

Cada reply tiene un botón pequeño "Responder" al lado del like. Click → un form aparece debajo SOLO de esa reply (no en todas) con `<textarea>` + Send. Submit → POST con `parentReplyId = r.id`.

Cancelar: botón "X" o click fuera cierra el form.

### 6. UI mobile

Indentación reducida en mobile (`pl-6` en lugar de `pl-10`) para no perder espacio en 320px. Numeración siempre visible para que el lineage sea trazable aún sin indentación clara.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Editar `src/pages/api/forum/topics/[id]/replies.ts` — aceptar y validar `parentReplyId`, calcular `depth`.
3. Editar `ForumEngine.tsx`:
   - Quitar botón "Eliminar" del topic.
   - Estructura `ReplyTree` recursiva con numeración.
   - Estado `replyingTo: string | null` (id del reply al que se está respondiendo).
   - Form inline aparece bajo el reply seleccionado.
4. Build + commit + push.
5. Verificación.

## Criterios de aceptación

- [x] El detail del topic NO muestra botón "Eliminar" (incluso para el autor).
- [x] Cada reply tiene botón "Responder" visible.
- [x] Click "Responder" en una reply: aparece un textarea inmediatamente debajo.
- [x] Submit con texto válido: el nuevo reply aparece anidado al padre con la indentación correcta.
- [x] Numeración correcta: top-level es `1`, `2`, `3...`. Reply al `1` es `1.1`. Reply al `1.1` es `1.1.1`.
- [x] Reply a algo de depth=2 queda anidado al mismo nivel (depth=2) con `parentReplyId` correcto.
- [x] En mobile (320–480px) la cascada se ve sin desbordes — indentación reducida.
- [x] Replies viejas (sin `parentReplyId`) siguen viéndose como root level (`depth=0`).
- [x] Eliminar reply propio sigue funcionando (no se cambió ese flow).

## Pruebas manuales

1. Login user → entrar a un topic → escribir reply directo → aparece como `1`.
2. Click "Responder" en `1` → escribir reply → aparece anidada como `1.1` con padding-left.
3. Click "Responder" en `1.1` → reply se anida como `1.1.1`.
4. Click "Responder" en `1.1.1` → la nueva reply queda al lado (depth=2) pero anidada bajo `1.1.1` (no bajo el `1`).
5. Verificar en Firestore Console que cada reply tiene `parentReplyId` correcto.
6. Mobile real 375px: confirmar que la cascada se lee sin overflow horizontal.
7. Confirmar que NO se ve botón "Eliminar" del topic en NINGÚN escenario (autor o no).
8. Borrar reply propio → sigue funcionando.

## Riesgos y trade-offs

- **Profundidad fija 3 vs ilimitada**: ilimitada es ingenierilmente bonita pero rompe mobile. 3 es pragmático. Si Carlos quiere más, una micro-spec con scrollbar horizontal opcional o "ver más" colapsable.
- **Numeración recalculada en cada render**: O(n²) en el peor caso (cada child filtra todo el array). Para foros pequeños (<200 replies) es invisible. Si crece, agregar `useMemo` que pre-agrupe en un Map.
- **Reply a depth=2 anidada al mismo nivel**: rompe la regla "depth=parent.depth+1" intencionalmente para preservar legibilidad. El usuario que vea numeración no entenderá inmediatamente que `1.1.1` y `1.1.1.1` están al mismo nivel visual; mitigado mostrando `@autor_padre` como prefijo en el contenido cuando depth toca el cap.
- **Replies viejas (pre-SPEC-038) sin parentReplyId**: tratadas como root. Sin migración necesaria.
- **Sin notificaciones cuando alguien te responde**: out of scope. Si más adelante hace falta, micro-spec con email.

## Compatibilidad con ElenaApp

Sin impacto.

## Commit

```
feat(spec-038): foro — replies anidadas + delete topic solo admin

- Quitar botón Eliminar del topic en UI pública (handler vivo por si
  se reactiva); el admin elimina hilos desde /admin/forum
- Replies con parentReplyId + depth (0..2). Endpoint valida lookup
  del parent y calcula depth. Replies viejas tratadas como root.
- ForumEngine: ReplyTree recursivo con numeración 1.1.1, indentación
  responsive, botón 'Responder' por reply con form inline.
- Mobile: indentación reducida + numeración visible siempre para
  trazabilidad del hilo aún sin padding claro.

Cierra SPEC-038.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/api/forum/topics/[id]/replies.ts` — POST acepta `parentReplyId` con validación de existencia, status y pertenencia al topic; calcula `depth` con cap en 2.
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — quita botón Eliminar del topic; agrega `ReplyTree` recursivo con numeración y indentación responsive; estado `replyingTo` con form inline; botón "Responder" por reply.

**Decisiones tomadas en la marcha:**
- **Cap depth=2**: balance entre cascada legible y mobile usable. Tres niveles cubren el caso normal de "comentario → respuesta → réplica".
- **Indentación responsive**: `pl-0 / pl-6 sm:pl-10 / pl-12 sm:pl-20`. En mobile el numeral identifica el lineage cuando el padding no alcanza.
- **Numeración como badge gris**: visible pero no protagonista. Estilo "RESP. 1.1.1" en font-mono uppercase tracking-widest, igual a otros badges del admin.
- **Form inline reutilizable**: un solo `<textarea>` que se reposiciona bajo el reply seleccionado; no múltiples DOM. Reduce reflow.

**Sin desviaciones del plan funcional.**
