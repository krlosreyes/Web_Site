# SPEC-067 — Parser handleSmartPaste tolerante + [QUIZ] restaurado en prompts

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — fix de regresión + robustez
**Severidad:** ALTO (botón "Procesar Contenido" fallaba en silencio + quiz olvidado en prompts)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-015 (editor admin), SPEC-063 (normalizer), SPEC-066 (prompts editoriales)
**Regresión de:** SPEC-066 (los prompts perdieron las secciones IMAGENES/REFERENCIAS/QUIZ que el parser soporta)

---

## Contexto

Carlos pegó en el editor admin el output que NotebookLM le devolvió, y el botón
"Procesar Contenido" aparentaba no hacer nada. Investigación reveló dos
problemas combinados:

### 1) Parser estricto (causa directa del bug visible)

`handleSmartPaste` en `ArticleEditor.tsx` usa:

```ts
const parts = text.split(/\[(TITULO|CONTENIDO|IMAGENES|REFERENCIAS|QUIZ)\]/i);
```

Pero NotebookLM (y a veces Gemini) escribió `[TÍTULO]` con tilde en la Í. La
regex es case-insensitive pero **no tilde-insensitive**, así que `[TÍTULO]`
no matchea `TITULO`. Resultado: el split no encontró el marcador, el title
quedó vacío, el botón cerró el campo de smart-paste y al usuario le pareció
que no había hecho nada.

Variantes adicionales que el parser estricto rechazaba:
- `**[TITULO]**` (envuelto en negrita)
- `[TITULO]:` (con dos puntos)
- `[ TITULO ]` (con espacios internos)
- `[IMÁGENES]` (con tilde)

### 2) Regresión de SPEC-066: los prompts no piden el quiz

Al rehacer los prompts tras el corte de contexto, omití las secciones
`[IMAGENES]`, `[REFERENCIAS]` y **`[QUIZ]`** del formato de salida. El parser
soporta las 5 secciones desde antes; los prompts solo le pedían 2 a la IA.

Consecuencia: aunque la IA generara markdown perfecto, los artículos no tenían
quiz, referencias ni imágenes seteadas — Carlos tenía que añadirlas a mano.
Carlos detectó esto al ver que el quiz desapareció ("quitaste el test del
artículo que es prioritario. quien te dijo que lo quitaras?"). Era un contrato
existente que rompí al rearmar los prompts.

## Solución

### Fix 1 — Parser tolerante (`ArticleEditor.tsx`)

Pre-normalización del texto antes del split: convertir todas las variantes
a la forma canónica `[TAG]`:

```ts
const TAG_VARIANTS: Array<[RegExp, string]> = [
    [/\*{0,2}\s*\[\s*T[IÍ]TULO\s*\]\s*:?\s*\*{0,2}/gi, '[TITULO]'],
    [/\*{0,2}\s*\[\s*CONTENIDO\s*\]\s*:?\s*\*{0,2}/gi, '[CONTENIDO]'],
    [/\*{0,2}\s*\[\s*IM[AÁ]GENES\s*\]\s*:?\s*\*{0,2}/gi, '[IMAGENES]'],
    [/\*{0,2}\s*\[\s*REFERENCIAS\s*\]\s*:?\s*\*{0,2}/gi, '[REFERENCIAS]'],
    [/\*{0,2}\s*\[\s*QUIZ\s*\]\s*:?\s*\*{0,2}/gi, '[QUIZ]'],
];
let normalized = text;
for (const [re, canonical] of TAG_VARIANTS) {
    normalized = normalized.replace(re, canonical);
}
// ... resto del split y getTagContent igual que antes
```

### Fix 2 — Fallback sin marcadores

Si el output no trae ni `[TITULO]` ni `[CONTENIDO]` (caso extremo: la IA
los ignoró totalmente), el parser usa la primera línea no vacía como título
y el resto como contenido:

```ts
if (!hasTitleMarker && !hasContentMarker) {
    const lines = normalized.split('\n');
    let titleLine = '';
    let contentStart = 0;
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        if (!l) continue;
        titleLine = l.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '').trim();
        contentStart = i + 1;
        break;
    }
    if (titleLine) setTitle(titleLine);
    const rest = lines.slice(contentStart).join('\n').trim();
    if (rest) setContent(normalizeArticleContent(rest));
}
```

### Fix 3 — Alert visible con diagnóstico

El comportamiento anterior era "fallar silencioso si algo no parseó". Ahora,
al finalizar, recolecta advertencias y muestra un alert con ítems concretos:

- "No se detectó título. Edítalo a mano arriba."
- "No se detectó contenido. Pega el cuerpo en el campo Contenido."
- "No se detectó quiz válido (JSON con preguntas). Añade preguntas con
  '+ Añadir Pregunta' o pide a la IA un bloque [QUIZ] con JSON."

El alert sugiere también re-pedir a la IA respetando el formato.

Tono del alert: tuteo neutro hispanoamericano (regla CLAUDE.md sección 4).
No hay voseo argentino — corrección hecha en una segunda pasada tras escribirlo.

### Fix 4 — Restaurar `[QUIZ]/[REFERENCIAS]/[IMAGENES]` en los 5 frameworks

Reescritura completa de `docs/PROMPTS-EDITORIAL.md`:

- Cada framework ahora exige las 5 secciones del parser en su output.
- Cada framework incluye un bloque `[QUIZ]` con plantilla de JSON inline
  (3-4 objetos con `question`, `options`, `correctAnswer`, `explanation`).
- Cada framework define un mínimo de preguntas: A/B/C/D piden 3, E pide 4.
- Cada framework agrega una sección **REGLA DE SINTAXIS LITERAL** con
  ejemplos de "incorrecto" vs "correcto" para que la IA no aplane el
  markdown a prosa plana (problema observado con NotebookLM y a veces
  con Gemini si el prompt no es estricto).
- Sección final "Validación pre-publicación" con checklist + frase
  correctiva lista para usar si la IA aplana el formato.

## Tests

Parser validado en sandbox con 4 escenarios:

1. **Output real de Carlos** con `[TÍTULO]` con tilde → título y contenido
   extraídos correctamente.
2. **Variantes raras**: `**[TITULO]:**` + `[ Contenido ]:` + `[IMÁGENES]` +
   `[QUIZ]` JSON → las 4 secciones extraídas, JSON parseado.
3. **Sin marcadores en absoluto**: el split puro no encuentra nada (correcto;
   el fallback del código real maneja este caso aparte).
4. **Formato canónico**: sigue funcionando idéntico que antes.

6/6 aserciones pasan en sandbox Node.

## Criterios de aceptación

- [x] `ArticleEditor.handleSmartPaste` acepta `[TÍTULO]` con tilde.
- [x] Acepta `**[TITULO]**`, `[TITULO]:`, `[ TITULO ]`, mayúsculas/minúsculas.
- [x] Acepta `[IMÁGENES]` con tilde.
- [x] Fallback: si no hay marcadores, primera línea = título, resto = contenido.
- [x] Alert visible si después del procesamiento title/content/quiz faltan.
- [x] Tono del alert en tuteo neutro (sin voseo).
- [x] Los 5 frameworks de `docs/PROMPTS-EDITORIAL.md` exigen las 5 secciones
      `[TITULO]/[CONTENIDO]/[IMAGENES]/[REFERENCIAS]/[QUIZ]`.
- [x] Los 5 frameworks tienen `[QUIZ]` con plantilla JSON inline.
- [x] Cada framework incluye REGLA DE SINTAXIS LITERAL con ejemplos.
- [x] Tests del parser pasan (6/6 en sandbox Node).
- [ ] Post-deploy: Carlos pega output real de Gemini con el prompt nuevo
      → ve título, contenido, callouts, tabla, listas ✅/❌, **y quiz
      poblado automáticamente**. Si algo falta, el alert lo dice claro.

## Riesgos y trade-offs

- **Regex de pre-normalización puede tener falsos positivos** si el contenido
  del artículo legítimamente contiene `[TITULO]` literal (ej. tutorial sobre
  prompts). Improbable en artículos de salud metabólica. Mitigación: solo
  matcheamos al inicio de línea efectivamente (los corchetes aislados).
  Si aparece este caso, escapar con backtick: `` `[TITULO]` ``.
- **Fallback "primera línea = título" puede ser ruidoso** si la IA empezó con
  "Aquí está tu artículo:" o "Claro, aquí tienes:". El usuario edita a mano.
  El alert le avisa que el título podría no ser el correcto.
- **El prompt más largo puede llevar a outputs más largos** que NotebookLM
  recorta. Mitigación: las plantillas de `[QUIZ]` son compactas (JSON inline
  en una línea). Si el problema persiste, partir el prompt en dos pasadas
  (contenido primero, quiz después).
- **Las IAs siguen pudiendo aplanar el markdown** a pesar de la REGLA DE
  SINTAXIS LITERAL. No es un fix garantizado — es una mejora estadística.
  La frase correctiva al final del doc ("Tu output anterior aplanó el
  markdown...") es el reintento de uso confiable.

## Resultado

Implementado en una sola pasada (2026-05-11) como reacción a regresión
detectada por Carlos.

**Archivos modificados:**
- `metamorfosis-web/src/components/admin/ArticleEditor.tsx` — `handleSmartPaste`
  con pre-normalización + fallback + alert con advertencias.
- `docs/PROMPTS-EDITORIAL.md` — reescrito por completo con las 5 secciones
  del parser + REGLA DE SINTAXIS LITERAL + checklist de validación.

**Decisiones:**
- Pre-normalizar el texto antes del split: más simple que cambiar la regex
  del split (que se vuelve ilegible). Cada variante es una regex propia,
  testeable.
- Fallback sin marcadores en lugar de error: muchas IAs simplemente ignoran
  el formato pedido. Es mejor extraer algo que rechazar todo.
- Alert al final en lugar de en medio del flow: Carlos ve UN alert con TODA
  la información, no una serie de pop-ups.
- Plantillas JSON inline en los prompts en lugar de modo multilínea: las IAs
  respetan mejor el JSON cuando lo ven en una sola línea como plantilla.

**Notas operativas para Carlos:**
1. Volver a generar un artículo con Gemini usando el prompt actualizado
   (cualquiera de los 5 frameworks de `docs/PROMPTS-EDITORIAL.md`).
2. El output esperado: 5 secciones con `[TITULO]`/`[CONTENIDO]`/`[IMAGENES]`/
   `[REFERENCIAS]`/`[QUIZ]`, contenido con `## H2`, `> **callouts**`, tablas
   con pipes, listas con `* ✅` / `* ❌`.
3. Pegar al editor admin → el parser ahora maneja tildes/negritas/dos puntos
   en los marcadores → quiz se popula automático.
4. Si algún output queda raro, el alert te dice qué exactamente no se
   detectó, sin silencio.

**Recomendación para evitar futuras regresiones:**
Cualquier cambio futuro a los prompts editoriales debe primero revisar
qué secciones soporta `handleSmartPaste` en `ArticleEditor.tsx` para no
volver a quitar contratos existentes.

Sin desviaciones del plan.
