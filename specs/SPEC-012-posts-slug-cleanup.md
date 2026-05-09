# SPEC-012 — Limpiar duplicados y hardcodes en `posts/[slug]`

**Estado:** ✅ Cerrada
**Fase:** 3
**Severidad:** MEDIO (calidad)
**Fecha de creación:** 2026-05-09
**Cerrada:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** ninguna

---

## Contexto

El template de artículo `src/pages/posts/[slug].astro` tenía varios problemas de calidad arrastrados de WIP:

1. **Bloque "Comunidad CTA" duplicado literalmente.** El código que invita a unirse al foro aparecía dos veces (una en líneas 230-266, otra en 276-313). Ambos idénticos. Cualquier visitante veía dos veces el mismo CTA.
2. **Botón "Volver a la Biblioteca" duplicado.** Aparecía después de cada uno de los CTAs duplicados, así que también dos veces.
3. **`Únete a la discusión con otros 1,240 biohackers`** — número hardcoded inventado. Si la comunidad real es chica o vacía, mentir confunde y daña credibilidad.
4. **`Estudio de 8 min`** hardcoded. Independientemente del largo real del artículo, todos decían 8 minutos.
5. **Fecha fallback `"7 de mayo de 2026"`** hardcoded para artículos sin `createdAt`. Mostraba esa fecha falsa.
6. **`console.log("Articulo marcado como leído para acceso a comunidad")`** dentro del listener de scroll — se imprime cada vez que el user supera el 70% del artículo, ensucia consola en producción.
7. **Listener de scroll sin cleanup** — el listener no se removía después de marcar como leído, así que seguía evaluando en cada scroll del resto de la sesión (perfomance trivial pero sucio).

## Problema

Resultado: artículos del blog con UI confusa (CTA duplicado), datos falsos (1240 biohackers, 8 min, fecha 7 de mayo), y console noise.

## Solución implementada

### Cambios en `src/pages/posts/[slug].astro`

- **Eliminado el segundo bloque "Comunidad CTA"** y el segundo "Volver a la Biblioteca". Quedan los originales (los primeros) con `id="community-cta"` por si alguien lo enlaza desde fuera.

- **Reemplazado `1,240 biohackers`** por `otros biohackers` (sin número falso). Si en el futuro se quiere un counter real, se puede leer de Firestore con un `users.where('waitlist.status', 'in', ['pending','active']).count().get()` — fuera del scope de esta spec.

- **Tiempo de lectura calculado**:
  ```ts
  const wordCount = cleanedContent.trim().split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));
  ```
  200 palabras por minuto es la velocidad de lectura promedio en español (Brysbaert 2019). Mínimo 1 minuto para evitar mostrar "0 min" en artículos muy cortos.

- **Fallback de fecha eliminado**. `formatDate` devuelve `null` si no hay `createdAt`, y el JSX usa `{formattedDate && (<div>...)}` para no renderizar la fila de fecha. Ya no aparece "7 de mayo de 2026" falso.

- **`console.log` eliminado.** El listener ahora también se remueve a sí mismo tras marcar el artículo como leído (cleanup correcto):
  ```js
  const onScroll = () => { ... if (...) { localStorage.setItem(...); window.removeEventListener("scroll", onScroll); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  ```
  `passive: true` mejora performance del scroll en mobile.

- **Script movido fuera del `<article>`**. Antes estaba dentro del JSX como hijo del article, lo cual funcionaba pero confundía. Ahora vive después del `</article>` dentro del layout — más coherente con cómo Astro espera scripts globales.

## Criterios de aceptación

- [x] `grep -c '1,240 biohackers' metamorfosis-web/src/pages/posts/\[slug\].astro` → 0
- [x] `grep -c 'Estudio de 8 min' metamorfosis-web/src/pages/posts/\[slug\].astro` → 0
- [x] `grep -c '7 de mayo de 2026' metamorfosis-web/src/pages/posts/\[slug\].astro` → 0
- [x] `grep -c 'console\.log' metamorfosis-web/src/pages/posts/\[slug\].astro` → 0
- [x] `grep -c 'Volver a la Biblioteca' metamorfosis-web/src/pages/posts/\[slug\].astro` → 1 (era 2)
- [x] `grep -c 'Participar en el Foro' metamorfosis-web/src/pages/posts/\[slug\].astro` → 1 (era 2)
- [ ] Visualmente: abrir un post real en producción y verificar que solo hay UN CTA de comunidad y UN back-link.

## Pruebas

```sh
# Greps
cd ~/Proyectos/Web_Site/metamorfosis-web/src/pages/posts
grep -c '1,240 biohackers\|Estudio de 8 min\|7 de mayo de 2026\|console\.log' '[slug].astro'
# Esperado: 0

grep -c 'Volver a la Biblioteca' '[slug].astro'
# Esperado: 1

grep -c 'Participar en el Foro' '[slug].astro'
# Esperado: 1
```

Visual:
- Abrir `https://metamorfosisvital.com.co/posts/<slug-real>` post-deploy.
- Solo aparece UN bloque CTA de comunidad y UN botón "Volver a la Biblioteca".
- El tiempo de lectura cambia según el largo real del artículo (no siempre "8 min").
- Si el artículo no tiene `createdAt`, no aparece la línea de fecha (en lugar de "7 de mayo de 2026").

## Riesgos / consideraciones

- **El número de biohackers vacío puede confundir** ("otros biohackers" sin contexto suena vago). Si Carlos quiere una métrica real, abrir spec dedicada que lea el counter de waitlist desde Firestore.
- **El cálculo de palabras** asume contenido en texto plano post-marked. Si un artículo tiene mucho HTML/imágenes inline, el conteo puede sobreestimar. Aceptable para un proxy de tiempo de lectura.

## Commit

```
fix(spec-012): limpiar duplicados y hardcodes en posts/[slug]

- Eliminado el segundo bloque "Comunidad CTA" duplicado idéntico
- Eliminado el segundo "Volver a la Biblioteca" duplicado
- Tiempo de lectura calculado dinámicamente (palabras / 200 wpm)
- Fecha fallback "7 de mayo de 2026" eliminada (la fila no se
  renderiza si no hay createdAt)
- "1,240 biohackers" hardcoded → "otros biohackers"
- console.log de tracking eliminado; listener con cleanup correcto
  y { passive: true }
- Script movido fuera de <article> para mejor estructura

Cierra specs/SPEC-012-posts-slug-cleanup.md
```

---

## Resultado

Implementada en una pasada el 2026-05-09 sin iteración.

**Verificación con grep (antes vs después):**

```
'1,240 biohackers'         antes: 2  → ahora: 0
'Estudio de 8 min'         antes: 1  → ahora: 0
'7 de mayo de 2026'        antes: 1  → ahora: 0
'console.log'              antes: 1  → ahora: 0
'Volver a la Biblioteca'   antes: 2  → ahora: 1
'Participar en el Foro'    antes: 2  → ahora: 1
```

**Aprendizajes:**

- **Tiempo de lectura calculado** es fácil (200 wpm es estándar) y aporta credibilidad. Aplica a cualquier blog.
- **Fecha sin fallback** es mejor UX que mostrar fecha falsa. Si no hay metadata, no mostrar la línea — el lector no la extraña.
- **Listeners de scroll deben self-cleanup** o usar `{ once: true }` cuando solo necesitan dispararse una vez.
- **`passive: true`** en listeners de scroll mejora performance en mobile (el browser no espera a que el JS responda antes de scrollear).