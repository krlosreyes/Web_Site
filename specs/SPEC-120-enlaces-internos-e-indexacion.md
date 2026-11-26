# SPEC-120 — Enlaces internos e indexación

Estado: IMPLEMENTADO (26-nov-2026)

## Diagnóstico (Search Console, 26-nov-2026)

- 6 páginas indexadas, 32 sin indexar. Ningún artículo indexado.
- 12 artículos "Descubierta: actualmente sin indexar": Google los conoce por el
  sitemap pero no los rastrea. Página de referencia de la calculadora:
  "No se ha detectado ninguna".
- La portada tenía 0 enlaces a artículos y los artículos 0 enlaces entre sí.
  Solo /biblioteca los enlazaba.

## Cambios

- `src/data/relatedPosts.ts`: temas (ayuno, composición, ejercicio, sueño,
  hidratación, alimentación), selección de portada y `getRelated()`.
- `src/components/PostLinks.astro`: tarjetas con enlaces HTML planos.
- Portada: "Un artículo por cada pilar" (6 enlaces).
- Cada artículo: "Artículos relacionados" (3, del mismo tema primero) y
  enlaces a calculadora y test.
- Calculadora: "Artículos sobre composición corporal".
- Tests: `relatedPosts.test.ts` (todos los slugs existen, cada artículo
  está en un tema, 3 relacionados distintos sin el actual).

## Acciones en Search Console (26-nov-2026)

Indexación solicitada: calculadora, /imr/metodologia, portada y 7 artículos
(ayuno guía, Andrés, comer menos, 5 mitos, hambre, espejo, báscula). Cuota
diaria agotada.

Pendiente próximos días: /imr, sueño (3), zona 2, gimnasio, 3 pm, comida es
información, mito del ayuno, horario de oficina, y /biblioteca.

## Al artículo nuevo

Agregar su slug a `POST_SEO` y a un tema de `TOPICS`; el test falla si falta.
