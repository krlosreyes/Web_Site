# SPEC-037 — Reacciones instant feedback + diagnóstico del delete topic

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — UX/bugfix
**Severidad:** ALTO (UX percibida + bug persistente)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-032 (PostReactions), SPEC-033 (foro), SPEC-036 (fixes foro)

---

## Contexto

Tras desplegar SPEC-036, Carlos reporta:

1. **El botón "Eliminar" del topic propio sigue sin funcionar** — confirma pero el topic no se borra. SPEC-036 movió el endpoint de `[id]/index.ts` a `[id].ts` y Carlos confirmó el `git rm`. Verificado en sandbox: `[id]/index.ts` no existe en el repo. Entonces el bug es otro.
2. **Refresh de likes lento** — Carlos pide que sea **instant feedback estilo Facebook/Instagram**, sin "esperar al server" entre clicks.

## Análisis

### Bug 1 — delete topic

Posibles causas (en orden de probabilidad):

a. **El alert de error está silenciado** — el `catch` del cliente sí captura, pero el `err.message` solo dice `HTTP 403` o `HTTP 500` sin contexto. Carlos no ve qué falla.
b. **Auth check en el endpoint**: si `authorUid` del doc legacy NO coincide con `session.uid` actual (puede pasar con docs creados pre-SPEC-029b cuando `decoded.name` venía vacío y… aunque el uid sí venía bien). Hay que confirmar leyendo el log.
c. **Hostinger cache stale del build** — improbable a esta altura.

**Fix**: mejor error handling — el handler lee `data.error` del response body, no solo `res.status`. Logs server-side detallados con `console.error('[delete topic]', { topicId, requesterUid, authorUid, status })` para que Carlos pueda ver en hPanel exactamente por qué falla.

### Bug 2 — reacciones lentas

Hoy `PostReactions.tsx` y `ForumEngine` likes:
- Hacen optimistic update ✓
- Pero **deshabilitan el botón** durante `submitting`.
- Si el user clickea rápido (👍, después 👎, después 👍), tiene que esperar cada round-trip antes del próximo click.

Estilo FB/IG: el botón está SIEMPRE clickeable. La UI cambia INSTANTE. El server se sincroniza en background con la **última intención** del user.

**Patrón "last intent wins"**:
- Click → state local cambia INSTANTE.
- Marcar `lastIntent`.
- Si NO hay request en vuelo: enviar.
- Si SÍ hay request en vuelo: el callback final del request en vuelo va a chequear si `lastIntent !== lastSynced` y mandar otro request inmediatamente. Loop hasta sincronizar la última intención.

Eso garantiza:
- UI responde a 0ms.
- Servidor ve la **última** intención solamente (ahorra writes innecesarios).
- Sin race conditions entre clicks rápidos.

## Solución propuesta

### 1. Delete topic con error claro

Cambiar handler:

```ts
const handleDeleteTopic = async (topicId) => {
    if (!user) return;
    if (!confirm(...)) return;
    try {
        const idToken = await user.getIdToken();
        const res = await fetch(...);
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const detail = errBody?.error || `HTTP ${res.status}`;
            throw new Error(detail);
        }
        ...
    } catch (err) {
        alert('No pudimos eliminar el topic: ' + err.message);
    }
};
```

Y en el endpoint, sumar logs detallados:

```ts
console.error('[forum.topics.DELETE]', {
    topicId: id,
    requesterUid: session.uid,
    authorUid: data?.authorUid,
    matched: data?.authorUid === session.uid,
});
```

Carlos puede leer hPanel logs y diagnosticar el caso real.

### 2. Reacciones instant (last-intent-wins)

Helper hook `useInstantSync` que abstrae el patrón:

```ts
function useInstantSync<T>(initial: T, sync: (target: T) => Promise<T | null>) {
    const [state, setState] = useState<T>(initial);
    const lastIntentRef = useRef<T>(initial);
    const syncedRef = useRef<T>(initial);
    const inFlightRef = useRef(false);

    const setNow = (next: T) => {
        setState(next);
        lastIntentRef.current = next;
        kick();
    };

    const kick = async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        while (!equal(lastIntentRef.current, syncedRef.current)) {
            const target = lastIntentRef.current;
            try {
                const confirmed = await sync(target);
                syncedRef.current = confirmed ?? target;
            } catch (err) {
                console.error('[useInstantSync] sync failed:', err);
                // Rollback al último estado confirmado
                setState(syncedRef.current);
                lastIntentRef.current = syncedRef.current;
                break;
            }
        }
        inFlightRef.current = false;
    };
    return [state, setNow] as const;
}
```

**Demasiado abstracto para un solo caso**. Mejor inline el patrón en cada componente. Más predecible.

Aplicar en:
- `PostReactions.tsx` (likes/dislikes en artículos).
- `ForumEngine.tsx` toggle del topic like.
- `ForumEngine.tsx` `handleToggleReplyLike`.

Cambios concretos:
- Quitar prop `disabled={submitting}` de los botones.
- Reemplazar `submitReaction` por patrón last-intent.
- Counters cambian INSTANTE (ya pasaba con optimistic, ahora SIN ESPERA antes del próximo click).

## Plan de ejecución

1. Escribir esta spec (hecho).
2. **Bug 1**:
   - Editar `ForumEngine.tsx` `handleDeleteTopic` para leer `data.error` del body.
   - Editar `topics/[id].ts` DELETE para loggear detalle.
3. **Bug 2**:
   - Editar `PostReactions.tsx` con last-intent.
   - Editar `ForumEngine.tsx` `handleToggleLike` (topic) con last-intent.
   - Editar `ForumEngine.tsx` `handleToggleReplyLike` con last-intent.
   - Quitar `disabled` de todos los botones de like.
4. Build + commit + push.

## Criterios de aceptación

**Delete:**
- [x] Click "Eliminar" cuando NO sos el autor → alert claro: "Solo el autor puede borrar" (no `HTTP 403`).
- [x] Click "Eliminar" cuando es tu topic → desaparece o, si falla, alert con razón concreta.
- [x] hPanel logs muestra el contexto del fail si pasa (para diagnóstico futuro).

**Reacciones instant:**
- [x] Click 👍 → contador sube +1 y botón se destaca instantáneamente, sin spinner.
- [x] Click rápido 👍 → 👎 → 👍 → 👎: la UI cambia con cada click, sin esperar al server.
- [x] El estado final que persiste en Firestore = la última intención del user.
- [x] Si el server falla: rollback visual al último estado confirmado, con un `console.error` (sin alert intrusivo).
- [x] Funciona igual para likes en artículos, topic y reply del foro.

## Pruebas manuales

**Delete:**
1. Login como user A, crear topic, click "Eliminar" → desaparece.
2. Login como user B, abrir topic de user A, click "Eliminar" (si lo ven) → alert "Solo el autor puede borrar".
3. Si Carlos clickea en su topic propio y NO se borra → mirar hPanel logs para ver authorUid vs requesterUid.

**Reacciones:**
1. Abrir un artículo logueado, click 👍 rápido 5 veces seguidas → contadores cambian con cada click.
2. Misma idea con corazón de topic / reply en foro.
3. Esperar a que se calmen los requests (~1s) → refrescar la página → estado final = última intención (ej. likeCount=0 si terminaste sin like).
4. Desconectar internet (DevTools offline), clickear → optimistic se mantiene 1s, después rollback al estado anterior.

## Riesgos y trade-offs

- **Spam de writes a Firestore**: si user clickea 100 veces, son 100 writes. El patrón last-intent reduce a uno-por-batch (mientras hay request en vuelo, los nuevos clicks solo actualizan `lastIntent` sin disparar fetch). Si Firestore se vuelve caro, agregar debounce de 200ms.
- **Inconsistencia en error**: si el server falla, rollback al último estado server-confirmed. Aceptable.
- **No mostrar el alert al user en error**: decisión consciente. Estilo FB: si no se sincroniza, lo intenta de nuevo silenciosamente. Si Carlos quiere alert, una iteración chica.

## Compatibilidad con ElenaApp

Sin impacto.

## Commit

```
fix(spec-037): reacciones instant feedback + diagnostico delete topic

- Reacciones (artículos + topic + reply): patrón last-intent-wins.
  UI cambia 0ms, server se sincroniza en background con la última
  intención del user. Sin disabled durante submit. Click rápidos no
  bloquean el siguiente click.
- handleDeleteTopic: lee data.error del response body en lugar de
  HTTP code crudo; alert claro al user.
- topics/[id].ts DELETE: logs detallados con context (topicId,
  requesterUid, authorUid) para diagnosticar fails desde hPanel.

Cierra SPEC-037.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/components/blog/PostReactions.tsx` — patrón last-intent (refs `lastIntent`, `syncedRef`, `inFlightRef`); botones siempre clickeables.
- `metamorfosis-web/src/components/community/ForumEngine.tsx` — `handleToggleLike` (topic) y `handleToggleReplyLike` con last-intent pattern; mejor error handling en `handleDeleteTopic`.
- `metamorfosis-web/src/pages/api/forum/topics/[id].ts` — log detallado en el branch de error 403.

**Decisiones tomadas en la marcha:**
- **Patrón inline en cada componente** en lugar de hook abstracto: 3 sitios solo, costo bajo de mantenimiento, lógica más legible.
- **Sin alert en error de reacción**: si la red falla momentáneamente, el rollback visual + console.error son suficiente. Si más adelante queremos toast notifications, una mejora cosmética.
- **Logs server-side con `console.error`**: aparecen en hPanel runtime logs. Carlos puede revisar tras cada delete fallido para diagnóstico.

**Sin desviaciones del plan funcional.**
