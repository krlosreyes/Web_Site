# SPEC-015 — Drafts + preview en vivo + validación quiz

**Estado:** ✅ Cerrada
**Fase:** 4
**Severidad:** ALTO (UX crítica del editor)
**Fecha de creación:** 2026-05-09
**Cerrada:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** ninguna (toca areas distintas a SPEC-014, no hay conflicto)

---

## Contexto

El editor admin actual (`ArticleEditor.tsx`) tiene tres pain points operativos serios:

1. **Sin drafts.** Cada click en "🚀 PUBLICAR AHORA" guarda y publica inmediatamente. No hay forma de guardar progreso a medias para seguir mañana, ni de tener un artículo "en cocción" sin que lo vea el público. Si Carlos está escribiendo un artículo largo y tiene que cerrar el navegador, pierde el trabajo (o peor, lo publica a medias por accidente).

2. **Sin preview del markdown.** El "Cuerpo del Artículo" es un `<textarea>` con el markdown crudo. Para ver cómo va a verse renderizado, hay que publicar y abrir `/posts/{slug}`. Acoplamiento alto entre editar y ver.

3. **Sin validación de quiz.** El form de quiz permite publicar con preguntas vacías, opciones vacías, o `correctAnswer` apuntando a una opción que el usuario nunca completó. Al renderizar en `posts/[slug]`, el `ArticleQuiz` puede mostrar opciones en blanco o quedarse trabado en una respuesta inválida.

## Problema

Editar artículos hoy es lento y propenso a errores. Cualquier mejora estructural pasa por resolver estos tres puntos juntos.

## Solución propuesta

### 1. Drafts vía campo `status`

Agregar al schema del doc `metamorfosis_posts/{id}`:

```ts
status: 'draft' | 'published',
publishedAt: string | null,  // ISO; null si está en draft
updatedAt: string,           // ISO; siempre actualizado en cada save
```

**Compatibilidad con artículos legacy** (sin campo `status`): tratar `status === undefined` como `'published'`. Los artículos viejos siguen visibles sin migración.

**Endpoints:**
- `POST /api/admin/posts` (crear): default `status: 'draft'` salvo que el body especifique `'published'`. Setear `updatedAt` siempre, `publishedAt` solo si `status === 'published'`.
- `PUT /api/admin/posts` (editar): respeta el `status` del body. Si pasa de `draft` a `published` por primera vez, setear `publishedAt`.

**Frontend público (filtros):**
- `pages/biblioteca.astro`: solo lista artículos donde `status !== 'draft'` (incluye legacy sin campo).
- `pages/posts/[slug].astro`: si `article.status === 'draft'`, devolver `Astro.redirect("/404")` o `404`. Si no está logueado el admin, no debe poder ver drafts.

**Editor (`ArticleEditor.tsx`):**
- Reemplazar el botón único "🚀 PUBLICAR AHORA" por dos:
  - **"💾 Guardar borrador"** → guarda con `status: 'draft'`. No redirige; muestra confirmación inline ("Borrador guardado HH:MM").
  - **"🚀 Publicar ahora"** → valida quiz primero (ver punto 3); si OK, guarda con `status: 'published'`.
- Si está editando un draft existente, mostrar badge "BORRADOR" en el header.

**`PostList.tsx` (admin):**
- Cada card del post muestra un badge: 🟢 "Publicado" o 🟡 "Borrador".
- Filtros: "Todos / Publicados / Borradores" en la tab Articles.

### 2. Preview en vivo

Toggle simple "Edit / Preview" arriba del textarea de contenido. En modo Preview:

- Renderizar el markdown actual del state `content` con `marked.parse()` (igual que en `posts/[slug].astro`).
- Aplicar la misma clase wrapper `prose prose-invert max-w-[70ch]` para que el preview coincida con el render real.
- Mantener el toggle Edit/Preview simple (no split-view por ahora — agregamos si Carlos lo pide).

**Implementación:**
```tsx
const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
const renderedHtml = useMemo(() => marked.parse(content), [content]);
// ...
{previewMode === 'edit' ? (
    <textarea ... />
) : (
    <div
        className="prose prose-invert max-w-[70ch] mx-auto"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
)}
```

`marked` ya está como dependencia (lo usa `posts/[slug].astro`).

### 3. Validación de quiz

Antes de publicar (no antes de guardar borrador), validar:

- Cada `question` no vacía (trim > 0).
- Al menos 2 `options` no vacías por pregunta.
- `correctAnswer` apunta a una opción no vacía.
- Si el array `quiz` está vacío (sin preguntas), está OK — el quiz es opcional.

Si falla, mostrar errores inline (no `alert()`) en cada pregunta problemática, con borde rojo y mensaje específico:

```
⚠️ Pregunta 2: la opción marcada como correcta está vacía.
⚠️ Pregunta 3: solo hay 1 opción válida (necesitás al menos 2).
```

Y deshabilitar el botón "Publicar" hasta que las validaciones pasen.

## Plan de implementación

1. **Modificar `src/pages/api/admin/posts.ts`** (server-side):
   - POST: default `status: 'draft'`, setear `updatedAt`, `publishedAt` si publicado.
   - PUT: respetar el `status` del body; setear `publishedAt` la primera vez que pase a `published`.
   - Mantener el resto igual.

2. **Modificar `src/components/admin/ArticleEditor.tsx`**:
   - Estado: agregar `status` (heredado del article o `'draft'`), `previewMode`, errores de validación de quiz.
   - Función `validateQuiz()` que devuelve un array de errores por pregunta.
   - Reemplazar el botón único de publicar por dos botones (Guardar borrador / Publicar).
   - Toggle Edit/Preview en el área de contenido.
   - Importar `marked` para el preview.

3. **Modificar `src/components/admin/PostList.tsx`**:
   - Mostrar badge de status en cada card.
   - (Opcional) Filtros Todos/Publicados/Borradores.

4. **Modificar `src/pages/biblioteca.astro`**:
   - En el query de `metamorfosis_posts`, filtrar `status !== 'draft'` o equivalente (Firestore no tiene `!=`, así que usar `where('status', 'in', ['published'])` con manejo de docs sin campo).
   - Más simple: traer todos y filtrar en JS: `articles.filter(a => a.status !== 'draft')`.

5. **Modificar `src/pages/posts/[slug].astro`**:
   - Si `article.status === 'draft'`, redirect a `/404`.
   - Excepción si el usuario es admin (cookie `admin_session` válida): permitir preview. Útil para QA antes de publicar.

## Criterios de aceptación

- [ ] El doc en Firestore tiene `status`, `publishedAt`, `updatedAt` después de un save.
- [ ] Artículos legacy sin `status` siguen visibles en `/biblioteca`.
- [ ] Click en "💾 Guardar borrador" guarda sin publicar; el artículo NO aparece en `/biblioteca` ni en `/posts/{slug}` para visitantes anónimos.
- [ ] Click en "🚀 Publicar ahora" valida quiz; si hay errores, no publica y muestra los errores inline.
- [ ] Toggle Edit/Preview en el editor: en Preview se ve el markdown renderizado (h1/h2, listas, blockquotes) con el mismo estilo que `posts/[slug]`.
- [ ] PostList muestra badge "Borrador" o "Publicado" en cada card.
- [ ] Admin logueado puede ver `/posts/{slug-de-draft}`; visitante anónimo recibe 404.

## Pruebas

```sh
# Crear un draft via curl (con cookie admin)
curl -s -X POST https://metamorfosisvital.com.co/api/admin/posts \
    -H 'Content-Type: application/json' \
    -b "$COOKIE" \
    -d '{"title":"Draft Test","content":"# Hola","images":[],"references":[],"quiz":[],"status":"draft"}' \
    | python3 -m json.tool
# Esperado: {success: true, id: "..."}

# Verificar que NO aparece en biblioteca
curl -s https://metamorfosisvital.com.co/biblioteca | grep -c 'Draft Test'
# Esperado: 0

# Verificar que /posts/draft-test sin cookie redirect a 404
curl -s -o /dev/null -w "%{http_code}\n" https://metamorfosisvital.com.co/posts/draft-test
# Esperado: 302 (redirect a /404) o 404

# Verificar que /posts/draft-test CON cookie admin renderiza
curl -s -o /dev/null -w "%{http_code}\n" -b "$COOKIE" https://metamorfosisvital.com.co/posts/draft-test
# Esperado: 200

# Promover a published via PUT
curl -s -X PUT https://metamorfosisvital.com.co/api/admin/posts \
    -H 'Content-Type: application/json' \
    -b "$COOKIE" \
    -d '{"id":"<id>","status":"published"}' \
    | python3 -m json.tool

# Ahora sí debería aparecer en biblioteca
curl -s https://metamorfosisvital.com.co/biblioteca | grep -c 'Draft Test'
# Esperado: 1
```

UI manual:
1. Crear nuevo artículo → click "💾 Guardar borrador" → confirma "Borrador guardado HH:MM".
2. Toggle Preview → ver markdown renderizado con prose styling.
3. Agregar pregunta de quiz con opciones vacías → click "Publicar" → ver error inline.
4. Completar opciones → click "Publicar" → publica OK.
5. Ir a `/biblioteca` → ver el artículo. Ir a `/posts/<slug>` → ver el artículo renderizado.

## Riesgos / consideraciones

- **Artículos legacy sin `status` field**: tratamos `undefined` como `'published'`. Esto NO migra los docs (no necesitamos), solo los respeta.
- **Admin viendo drafts requiere cookie validation server-side en `posts/[slug].astro`**, igual que admin/dashboard. Reusable: `isValidSessionValue(Astro.cookies.get('admin_session')?.value)`.
- **Preview puede divergir del render real** si los estilos `prose` del editor difieren de los de `posts/[slug]`. Solución: aplicar exactamente la misma clase wrapper.
- **`dangerouslySetInnerHTML`** abre vector XSS si el markdown contiene HTML malicioso. `marked` no sanitiza por default. Mitigación: `marked` con opciones `sanitize: false` (deprecada en v5+) o usar `DOMPurify.sanitize(marked.parse(content))`. Para el editor admin (auth required) el riesgo es bajo pero conviene anotarlo.
- **`updatedAt`** se actualiza en cada save. Si querés timestamps separados (created/updated/published), agregar más campos.

## Commit

```
feat(spec-015): drafts + preview en vivo + validación quiz

- metamorfosis_posts schema: + status (draft|published), publishedAt,
  updatedAt. Compat con legacy: undefined trata como published.
- POST /api/admin/posts: default draft, setea updatedAt y publishedAt.
- PUT /api/admin/posts: respeta status, marca publishedAt la primera
  vez que pasa a published.
- ArticleEditor: 2 botones (Guardar borrador / Publicar). Toggle
  Edit/Preview con render de markdown. Validación quiz antes de
  publicar (errores inline, no alert).
- PostList: badge Borrador/Publicado por card.
- biblioteca.astro: filtra drafts (visible solo si status no es draft).
- posts/[slug].astro: 404 para drafts a menos que sea admin logueado
  (preview pre-publicación).

Cierra specs/SPEC-015-drafts-preview-quiz-validation.md
```

---

## Resultado

Implementada el 2026-05-09 en una pasada. Carlos confirmó "continuemos" tras los cambios.

**Cambios mergeados:**

- `api/admin/posts.ts`: default `status: 'draft'`, `publishedAt: null`, `updatedAt`. PUT marca `publishedAt` la primera vez que el post pasa a published (lookup del doc previo + condicional).
- `biblioteca.astro`: trae todos y filtra `status !== 'draft'` (`undefined` legacy = published).
- `posts/[slug].astro`: drafts → redirect `/404` para anónimos. Admin logueado (cookie `admin_session` válida) puede ver el draft para preview pre-publicación.
- `ArticleEditor.tsx`: badge 🟢/🟡 + timestamp "Guardado HH:MM"; toggle ✎ Editar / 👁 Preview con `marked.parse` y mismo wrapper `prose prose-invert` que la página real; botones dobles "Guardar borrador" + "Publicar ahora"; validación quiz con `validateQuizForPublish` (pregunta no vacía, ≥2 opciones válidas, `correctAnswer` apunta a opción real); errores inline por pregunta con borde rojo + banner explicativo.

**Aprendizajes:**

- **`useMemo` para markdown render** evita re-parsear en cada keystroke. Solo re-parsea cuando cambia `content`.
- **Validación con feedback inline** (no `alert`) es mucho mejor UX. Cada pregunta sabe cuál es su error específico.
- **Compat con docs legacy** (sin campo `status`) usando `undefined === published` evita migración. El sistema funciona en modo mixto.
- **Admin con cookie puede ver drafts** = preview pre-publicación gratis. Reutiliza `isValidSessionValue` de SPEC-003 — patrón consistente.

**Pendientes que se mueven a otras specs:**

- Sanitización XSS en preview con `DOMPurify` (no aplica hoy porque solo admin lo usa, pero conviene si alguna vez exponemos preview a public).
- Auto-save de drafts en background (cada 30s o al hacer pausa de tipeo).
- Diff visual antes de publicar (qué cambió desde la última versión publicada).
