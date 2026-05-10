# SPEC-032 — Likes / Dislikes en artículos

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Engagement / feedback
**Severidad:** ALTO (feedback editorial directo + nuevo gancho de conversión para anónimos)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-008 (rules), SPEC-024 (gating anónimos)

---

## Contexto

Los artículos no tienen ninguna forma de medir si el contenido conecta. Carlos publica, los lectores leen (o no), nadie sabe nada. Necesitamos feedback explícito y simple — un botón 👍 / 👎 al final de cada artículo. Esto:

1. Le da a Carlos data accionable (qué temas resuenan, cuáles aburren).
2. Suma una métrica real al dashboard admin (alimentando SPEC-019).
3. Crea otro gancho de conversión: anónimo no puede votar → CTA registro.

## Problema

1. **Cero feedback estructurado**: hoy solo el quiz mide engagement, y no todos los artículos tienen quiz.
2. **Sin proxies de calidad por artículo**: no sabés si "Autofagia" performó mejor que "Magnesio".
3. **Anónimos sin invitación**: el quiz tiene gating (SPEC-024); los likes pueden replicar el patrón.

## Decisiones tomadas (Carlos 2026-05-10)

- Anónimos NO votan; CTA registro.
- Permitir cambiar voto (👎 → 👍).
- Contadores visibles para todos; admin ve el detalle por user en `metamorfosis_posts/{id}/reactions/`.

## Solución propuesta

### 1. Modelo de datos

```
metamorfosis_posts/{postId}
├── reactions: { likes: number, dislikes: number }   (denormalizado, lectura O(1))
└── ...resto del doc...

metamorfosis_posts/{postId}/reactions/{uid}
├── value: 'like' | 'dislike'
├── createdAt: ISO
└── updatedAt: ISO
```

Presence-based: si existe el doc en `/reactions/{uid}`, el user votó. La key es el uid (no auto-id), garantía de idempotencia natural.

### 2. Endpoint server-side `/api/posts/[slug]/react`

Hago la operación con **Admin SDK + transaction** en lugar de rules client-side. Razones:

- Las rules de Firestore son complejas para validar `FieldValue.increment` en cross-doc updates.
- Centraliza la lógica de swap (decrement viejo, increment nuevo).
- Permite audit log si en el futuro lo querés.

**Métodos:**

- `GET /api/posts/[slug]/react` (auth): devuelve `{ userReaction, counts }`.
- `POST /api/posts/[slug]/react` (auth): body `{ value: 'like' | 'dislike' | null }`. Idempotente:
  - Si `value === current`: no-op.
  - Si cambia (`null → 'like'`, `'like' → 'dislike'`, etc.): transaction que actualiza `reactions/{uid}` + counters del post atómicamente.

**Auth**: Firebase ID token en header `Authorization: Bearer <token>` (mismo patrón que `/api/users/onboard`).

### 3. Reglas Firestore

```
match /metamorfosis_posts/{post}/reactions/{uid} {
  allow read: if request.auth != null;
  allow write: if false;  // solo Admin SDK del endpoint
}
```

El cliente NO escribe directo — siempre vía endpoint. Esto evita que un user manipule el counter sin pasar por la lógica.

Read solo a logueados (no necesitamos exponer detalle de quién votó qué a anónimos).

### 4. Componente `PostReactions.tsx`

Cliente React que se monta debajo del contenido del artículo, antes del Quiz / References / CTA final.

**Estados:**
- `loading` (al cargar el GET inicial).
- `currentUser` (Firebase Auth).
- `userReaction: 'like' | 'dislike' | null`.
- `counts: { likes, dislikes }` (puede empezar con valores pasados desde SSR para evitar flash).

**Interacciones:**
- Anónimo: muestra los contadores + CTA "Registrate para reaccionar" linkeando a `/login`.
- Logueado sin voto: ambos botones activos.
- Logueado con voto: el botón elegido destacado, contador con efecto.
- Click en mismo botón que ya está votado: quita el voto.
- Click en el otro botón: cambia el voto.
- Optimistic update + rollback en error.

### 5. SSR pre-fill de counters

`posts/[slug].astro` ya hace fetch del doc del post. Le paso `reactions` (default `{ likes: 0, dislikes: 0 }`) al componente como prop. El componente lo usa como estado inicial → el botón rinde con el counter correcto en el primer paint, sin esperar al fetch del cliente.

### 6. Audit log

Sumar `'react_post'` al `AuditAction` y loguear cuando un user reacciona — útil para detectar abuso (ej. mismo user votando en cadena rápida — no se previene acá, solo se observa). Best-effort, no bloquea la respuesta.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Crear `src/pages/api/posts/[slug]/react.ts` (GET + POST).
3. Actualizar `firestore.rules` con bloque `metamorfosis_posts/{post}/reactions/{uid}`.
4. Crear `src/components/blog/PostReactions.tsx`.
5. Editar `posts/[slug].astro` para pasar `slug` + `initialReactions` al componente y montarlo.
6. Sumar `'react_post'` a `auditLog.ts AuditAction`.
7. Build + commit + push.
8. Verificación.

## Criterios de aceptación

- [x] Logueado puede votar 👍 → counter sube, botón destacado.
- [x] Volver a clickear el mismo botón quita el voto.
- [x] Click en el botón opuesto: votos se intercambian (likes-1, dislikes+1) atómico.
- [x] Refresh: el voto del user persiste, el counter es correcto.
- [x] Anónimo NO puede votar; ve "Registrate para reaccionar" linkeado a `/login`.
- [x] Anónimo SÍ ve los contadores actuales.
- [x] Si el endpoint falla, optimistic update se revierte y el user ve el estado real.
- [x] Audit log captura `react_post` con uid + slug + value.
- [x] Counters denormalizados consistentes con cantidad real de docs en `/reactions/`.
- [x] Las rules bloquean writes directos del cliente al `/reactions/{uid}`.

## Pruebas manuales

1. Login como user real → abrir un artículo → votar 👍 → contador sube +1.
2. Refresh → voto persiste, botón sigue destacado.
3. Click en 👎 → contador likes -1, dislikes +1.
4. Click en 👎 de nuevo → ambos counters bajan a su valor original (voto removido).
5. Modo incógnito → abrir el mismo artículo → ver contadores actuales sin botones activos + CTA registro.
6. Click en CTA → llega a `/login` con el contexto correcto.
7. Firebase Console → `metamorfosis_posts/{id}/reactions/` → ver entries con uid del user.
8. Tab Audit log del admin → ver entry `react_post`.
9. (Bonus) intentar escribir directo desde Web SDK del cliente → rules lo rechazan.

## Riesgos y trade-offs

- **Counters pueden divergir** si el endpoint falla a mitad de la transaction (split-brain teórico). Firestore transactions son atómicas, así que esto es muy raro. Si algún día divergen, un script de reconciliación corre `count()` de la subcollection y lo escribe.
- **Sin rate limit por user**: un user motivated podría hacer click 100 veces para subir-bajar. La lógica idempotente lo previene en counters reales (no se duplica), pero genera N writes a Firestore (cuesta). Aceptable hoy. Si abusan, agregamos `lastReactedAt` en `users/{uid}` con cooldown.
- **Performance**: cada reacción es 1 GET + 1 POST + 1 transaction (3 ops Firestore). Para tráfico web actual está bien; con 1000 users/día simultáneos, optimizar.

## Compatibilidad con ElenaApp

ElenaApp puede leer `metamorfosis_posts/{id}.reactions` para ranking de contenidos, sin acoplamiento adicional.

## Commit

```
feat(spec-032): likes/dislikes en artículos con endpoint y rules

- Endpoint POST/GET /api/posts/[slug]/react: auth con ID token,
  transaction Admin SDK que mantiene counters denormalizados sincronizados
  con los docs en metamorfosis_posts/{id}/reactions/{uid}
- PostReactions.tsx: botones 👍/👎 con SSR pre-fill de counts,
  optimistic update + rollback, gating de anónimos con CTA registro
- Rules: metamorfosis_posts/{post}/reactions/{uid} read auth, write
  bloqueado al cliente (solo Admin SDK)
- Audit log: 'react_post' captura cada cambio de reacción

Cierra SPEC-032.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/api/posts/[slug]/react.ts` — nuevo. GET y POST con auth via ID token. Transaction atomic en POST (lee viejo + actualiza reaction doc + actualiza counters denormalizados del post).
- `metamorfosis-web/src/components/blog/PostReactions.tsx` — nuevo. Botones 👍/👎 con estados loading/anonymous/voted. Optimistic update con rollback. CTA registro para anónimos en lugar del estado activo.
- `metamorfosis-web/src/pages/posts/[slug].astro` — sumado el componente debajo del contenido principal, con `client:visible` y props `slug` + `initialReactions`.
- `firebase/firestore.rules` — agregado bloque `metamorfosis_posts/{post}/reactions/{uid}` con `read: if request.auth != null` y `write: if false`.
- `metamorfosis-web/src/lib/auditLog.ts` — `'react_post'` agregado a `AuditAction`.

**Decisiones tomadas en la marcha:**
- **Server-side endpoint en lugar de rules complejas**: aunque cuesta un round-trip más, evita que las rules se vuelvan ilegibles con `FieldValue.increment` validations.
- **Counters denormalizados en doc raíz del post**: lectura O(1) para el SSR. Si divergen vs. count() real (imposible bajo transactions, pero defensa por las dudas), un script de reconciliación lo arregla.
- **Sin rate limit por user todavía**: aceptable a este volumen. Cuando explote, agregamos cooldown.

**Sin desviaciones del plan funcional.**
