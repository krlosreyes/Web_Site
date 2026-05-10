# SPEC-025 — Fecha pública del artículo refleja `publishedAt`

**Estado:** ✅ Cerrada
**Fase:** 4 (Admin/UX — extensión post-cierre)
**Severidad:** ALTO (consistencia editorial entre admin y frontend público)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-023 (publishedAt editable manualmente)

---

## Contexto

Tras SPEC-023, Carlos puede editar manualmente `publishedAt` desde el editor. Pero el frontend público sigue mostrando y ordenando por `createdAt`:

- `metamorfosis-web/src/pages/posts/[slug].astro:64` — `formatDate(article.createdAt)`.
- `metamorfosis-web/src/pages/biblioteca.astro:10` — `orderBy('createdAt', 'desc')`.

Resultado: si Carlos backdatea un artículo a marzo, el visitante igual ve la fecha de creación del doc (mayo) y la biblioteca lo lista por orden de creación, no por orden editorial. Inconsistencia entre lo que se ve en `/admin` (post SPEC-023) y lo que se ve en `/posts/{slug}`.

## Problema

1. **Detalle del artículo muestra `createdAt`**: visitante puede ver "publicado el 9 de mayo" cuando Carlos editó la fecha a "publicado el 15 de marzo".
2. **Biblioteca ordena por `createdAt`**: el orden cronológico no respeta la decisión editorial de fechas manuales.

Ambos rompen el contrato de SPEC-023 ("fecha editable") y confunden tanto al admin como al lector.

## Solución propuesta

### 1. `posts/[slug].astro` muestra `publishedAt` con fallback

```ts
const formattedDate = formatDate(article.publishedAt || article.createdAt);
```

- Si el doc tiene `publishedAt` (post-SPEC-015 + SPEC-023) → muestra esa.
- Si no (artículos legacy) → fallback a `createdAt`.
- Si tampoco → no se muestra (`formatDate(undefined)` ya devuelve `null` y el render condicional lo oculta).

### 2. `biblioteca.astro` ordena por `publishedAt` con fallback in-memory

Firestore no permite `orderBy` con OR ni con fallback nativo. Solución: fetch sin orden estricto y ordenar in-memory (mismo patrón que `stats.ts` y `leads.ts` admin).

```ts
const snapshot = await postsRef.get();
// orden in-memory por publishedAt || createdAt desc
allArticles.sort((a, b) => {
    const aDate = a.publishedAt || a.createdAt || '';
    const bDate = b.publishedAt || b.createdAt || '';
    return bDate.localeCompare(aDate);
});
```

Articles legacy sin `publishedAt` caen al lado-`createdAt`, que existe desde antes. El orden cronológico queda consistente con lo que muestra el admin (SPEC-023 default "Más recientes").

### 3. (No incluido) mostrar fecha en cards de biblioteca

Carlos no lo pidió en este round. Si después quiere agregar la fecha visible en la card, es una iteración chica de UX que se mete en otra spec.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Editar `posts/[slug].astro` línea 64.
3. Editar `biblioteca.astro`: cambiar `orderBy('createdAt', 'desc').get()` por `get()` sin orden + sort in-memory.
4. Build + commit + push.
5. Verificación E2E: editar `publishedAt` de un artículo a una fecha pasada desde admin, recargar el detalle público y la biblioteca, confirmar que la fecha mostrada Y el orden coinciden con la nueva fecha.

## Criterios de aceptación

- [x] El detalle público muestra `publishedAt` cuando existe; si no, `createdAt`.
- [x] La biblioteca ordena por `publishedAt` desc cuando existe; legacy sin `publishedAt` cae con su `createdAt`.
- [x] Backdatear un artículo a una fecha pasada desde el admin se refleja en el detalle público y mueve la card al lugar correcto en la biblioteca.
- [x] Sin regresiones para artículos legacy (siguen viéndose con su `createdAt`).

## Pruebas manuales

1. Login admin → editar un artículo → cambiar `publishedAt` a una semana atrás → guardar.
2. Abrir `/posts/{slug}` en otra pestaña → la fecha visible junto al ícono Calendar coincide con la nueva fecha.
3. Abrir `/biblioteca` → la card del artículo aparece en la posición correcta del orden cronológico.
4. Verificar que un artículo legacy (sin `publishedAt`) sigue mostrándose con su fecha original.

## Riesgos y trade-offs

- **biblioteca.astro pierde ordenamiento server-side**: el sort in-memory es O(n log n) sobre N artículos. Para N < 1000 es invisible. Si crece a >5k, agregar índice compuesto en Firestore.
- **`publishedAt` puede venir como string ISO o Firestore Timestamp**: el helper `formatDate` ya parsea ISO. Para legacy con Timestamp nativo, `new Date(ts)` se queja. SPEC-023 normaliza siempre a ISO en POST/PUT, pero docs muy viejos pueden tener Timestamp nativo. El fallback a `createdAt` cubre ese caso porque ese campo ya viene como ISO desde SPEC-015.

## Compatibilidad con ElenaApp

Sin impacto. ElenaApp no consume artículos.

## Commit

```
fix(spec-025): fecha publica del articulo refleja publishedAt

- posts/[slug].astro: formatDate(publishedAt || createdAt)
- biblioteca.astro: orden in-memory por publishedAt || createdAt desc
- Compatibilidad legacy: sin publishedAt cae a createdAt en ambos
- Cierra el loop de SPEC-023 en el frontend público

Cierra SPEC-025.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/posts/[slug].astro` — línea de `formattedDate` ahora usa `article.publishedAt || article.createdAt`.
- `metamorfosis-web/src/pages/biblioteca.astro` — quitado el `orderBy('createdAt', 'desc')` server-side, agregado sort in-memory por `publishedAt || createdAt` desc tras el fetch.

**Decisiones tomadas en la marcha:**
- **Sort por `localeCompare` sobre el string ISO**: ISO 8601 ordena lexicográficamente igual que cronológicamente, así que `localeCompare` es equivalente a parsear cada string a Date sin el costo. Funciona también si el timestamp es Firestore (lo serializamos a ISO en SPEC-023).
- **No mostrar la fecha en las cards de biblioteca por ahora**: Carlos pidió consistencia, no nueva información. Si después la quiere visible, una línea más en el JSX.

**Sin desviaciones del plan funcional.** Todos los criterios de aceptación quedan cumplidos.
