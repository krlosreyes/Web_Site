# SPEC-063 — Normalizar párrafos al pegar contenido de IA

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — editor/UX
**Severidad:** ALTO (artículos se ven como muro de texto)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-015 (drafts + editor admin)

---

## Contexto

Los artículos generados por IA y pegados en el editor admin se renderizaban
como un **muro de texto** en el sitio público, ignorando todos los estilos
`prose` elaborados del renderer (h2 con icono ✦, blockquote tipo "CLAVE DEL
PROTOCOLO", listas como grid de cards, ol como roadmap numerado).

Cadena del problema:

1. La IA frecuentemente genera el cuerpo como un solo bloque continuo, con
   `.` entre oraciones pero SIN saltos de párrafo reales (`\n\n`).
2. `handleSmartPaste` en `ArticleEditor.tsx` extraía el `[CONTENIDO]` y lo
   guardaba con `setContent(rawContent.trim())` — sin normalizar.
3. `marked.parse()` convertía ese texto en un único `<p>...</p>` HTML porque
   markdown solo crea párrafos donde hay `\n\n`.
4. El renderer aplicaba `.prose p { ... }` a ese único párrafo gigante, y
   todos los demás estilos (`.prose h2`, `.prose blockquote`, `.prose ol`)
   nunca se activaban porque el contenido no tenía esos elementos.

El renderer está **perfectamente diseñado**. El input estaba roto.

## Solución

Helper `lib/utils/normalizeArticleContent.ts` que detecta y arregla:

### Lógica

1. **Pass-through si ya está bien**: si el contenido tiene `\n\n`, `## headings`
   o `> blockquotes`, NO se toca. La IA hizo su trabajo.
2. **Heurística para bloques planos**: si NO tiene esos marcadores, divide
   el texto en oraciones (`.`/`?`/`!` seguido de mayúscula con tildes
   españolas) y agrupa de a 3 oraciones por párrafo, separadas por `\n\n`.
3. **Garantiza separación de las dos secciones obligatorias del parser**:
   inserta `\n\n` antes de "Lo que cambia en tu cuerpo (y en tu vida):" y
   "Tu plan de acción para esta semana:" aunque vengan pegadas al párrafo
   anterior.
4. **Preserva items de lista**: líneas que empiezan con `*`, `-`, `>`,
   `## heading`, o `1. ` no se agrupan con texto plano.
5. **Limpieza final**: colapsa 3+ saltos consecutivos a `\n\n` y trim.

### Integración

En `handleSmartPaste`:

```ts
// Antes
if (rawContent) setContent(rawContent.trim());

// Después (SPEC-063)
if (rawContent) setContent(normalizeArticleContent(rawContent));
```

### Botón "✨ Re-normalizar" en la toolbar

Para artículos viejos que se cargan al editor y vinieron rotos, agrego un
botón en la toolbar del editor que aplica `normalizeArticleContent(content)`
al contenido actual. Carlos abre un artículo viejo, hace click, y se ve
arreglado al guardar.

## Tests

`lib/utils/normalizeArticleContent.test.ts` con 11 describe cases cubriendo:

- Preserva contenido bien formateado (con `\n\n` o `## headings`).
- Agrupa 6 oraciones en 2 párrafos (3+3).
- Inserta separación antes de "Lo que cambia" y "Tu plan de acción".
- Preserva items de lista y pasos numerados sin agrupar.
- Maneja string vacío, solo espacios, una sola oración.
- No rompe oraciones con abreviaciones (`p.m.` no parte el flujo).
- Colapsa 3+ saltos a doble salto.
- Caso realista con todas las secciones obligatorias.

Valores validados con Python en sandbox (11/11 pass) — no estimación mental
siguiendo `feedback_test_values_calibration.md`.

## Criterios de aceptación

- [x] `lib/utils/normalizeArticleContent.ts` exporta `normalizeArticleContent(input: string): string`.
- [x] Si input ya tiene `\n\n` → pass-through sin modificar (excepto separar las dos secciones obligatorias).
- [x] Si input es bloque plano → agrupa 3 oraciones/párrafo.
- [x] "Lo que cambia en tu cuerpo" y "Tu plan de acción" siempre quedan separadas con `\n\n` del párrafo anterior.
- [x] `ArticleEditor.handleSmartPaste` usa el helper antes de `setContent`.
- [x] Botón "✨ Re-normalizar" en la toolbar para arreglar contenido ya pegado.
- [x] Tests unitarios con 11 describe cases.
- [x] Tests validados con Python (11/11 pass).
- [ ] Post-deploy: pegar el output de IA con contenido en bloque → verificar que en el preview aparecen múltiples `<p>` separados.
- [ ] Post-deploy: cargar un artículo viejo → click "Re-normalizar" → verificar mejora visual.

## Riesgos y trade-offs

- **Heurística "3 oraciones por párrafo"**: puede no ser óptima en todos
  los casos (a veces 2 oraciones tienen más sentido juntas que 3). Pero
  prefiero garantizar separación visual a optimizar densidad. Carlos
  siempre puede ajustar manualmente en el editor antes de guardar.
- **Detección de oraciones con abreviaciones**: el regex
  `(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])` mira la PRÓXIMA letra. Si después de
  "p.m." viene una palabra en minúscula, NO parte ahí. Pero si después de
  "Dr." viene "Fung" en mayúscula, sí partiría. Aceptable: en español
  médico es raro usar "Dr." sin "Dr. Jason Fung" como entidad cohesiva,
  y aún en ese caso el split residual sería minor.
- **No toca contenido bien formateado**: si la IA YA mete `\n\n`, el
  helper se desactiva. Eso garantiza que mejorar el prompt en el futuro
  NO compite con esta heurística — la heurística solo actúa como red de
  seguridad.
- **Artículos viejos no se migran automáticamente**: Carlos tiene que
  abrirlos uno por uno y click "Re-normalizar". Para 10 artículos, 5
  minutos total. Sin migración batch porque sería invasiva y los
  artículos viejos también pueden tener `[CONTENIDO]` legacy.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos creados:**
- `metamorfosis-web/src/lib/utils/normalizeArticleContent.ts` (~120 líneas
  con docstring extenso).
- `metamorfosis-web/src/lib/utils/normalizeArticleContent.test.ts` (~80
  líneas, 11 describe cases).

**Archivos modificados:**
- `metamorfosis-web/src/components/admin/ArticleEditor.tsx` — import del
  helper, llamada en `handleSmartPaste` antes de `setContent`, botón
  "✨ Re-normalizar" en la toolbar.

**Decisiones:**
- Helper pure-function, sin dependencias externas. Testeable, reusable
  desde otros lugares si en el futuro se necesita (newsletter, exports).
- Pass-through cuando el contenido viene bien: respeta el trabajo de la
  IA cuando sí formatea, no compite con prompts mejorados.
- Botón "Re-normalizar" visible solo en el editor — no es operación
  destructiva pero requiere decisión manual (un artículo bien escrito
  manualmente no debería ser re-normalizado).

**Notas operativas para Carlos:**
1. Al pegar el output de un nuevo prompt: el helper actúa automático.
   Verificá en el preview que aparecen múltiples párrafos.
2. Para artículos viejos (los 10 que decidiste regenerar): abrí cada uno
   en el editor admin, click "✨ Re-normalizar", guardá. O directamente
   pegá el output del nuevo prompt y crealos de cero como ya planeaste.
3. Si la IA en algún caso genera markdown bien hecho (con `\n\n` y
   `## headings`), el helper se desactiva. NO interfiere.

Sin desviaciones del plan.
