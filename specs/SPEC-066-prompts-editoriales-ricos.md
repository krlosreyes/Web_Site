# SPEC-066 — Prompts editoriales que generan markdown rico

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — editorial / operación
**Severidad:** ALTO (sin prompts nuevos, SPEC-065 no se activa)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Hermana:** SPEC-065 (renderer que consume el markdown que estos prompts generan)

---

## Contexto

SPEC-065 extiende el renderer para soportar 5 tipos de callouts diferenciados,
tablas, listas con ✅/❌ e índice de contenidos automático. Pero el renderer
solo activa estos componentes si el markdown trae los prefijos y sintaxis
correctos.

Los prompts editoriales actuales (los 5 frameworks A–E) le piden a la IA
generar `## H2`, `**bold**` y `> blockquotes` genéricos. No le piden los 5
tipos de callout, ni tablas comparativas, ni listas con ✅/❌. Hay que
extenderlos.

Requisitos operativos:

- Los prompts deben ser **cortos** (Carlos validó previamente que NotebookLM
  recorta los muy largos).
- Deben **mantener los 5 frameworks A–E** rotando (variedad editorial).
- Deben mantener el **tono y voz de Carlos** ("Amigo que estudió medicina").
- **Tuteo neutro hispanoamericano**, sin voseo argentino (regla de
  CLAUDE.md sección 4 + memoria `feedback_metamorfosis_copy_neutro.md`).

## Solución

Documento único `docs/PROMPTS-EDITORIAL.md` con:

1. **FORMATO OBLIGATORIO COMÚN** — un template visual que todos los 5
   frameworks respetan, mostrando exactamente cómo deben verse los callouts,
   las tablas, las listas con ✅/❌ y el cierre.
2. **Reglas inquebrantables compartidas** — tono, mínimo 3 H2, separación
   con línea en blanco entre callouts, cierre estandarizado.
3. **5 prompts independientes (A, B, C, D, E)** — cada uno define su
   estructura propia (PAS, Mythbuster, Caso clínico, Listicle, Deep dive)
   y exige una combinación específica de callouts.
4. **Checklist de validación pre-publicación** — para que Carlos verifique
   en 20 segundos antes de pegar.

### Distribución por framework

Cada framework usa los 5 callouts en combinaciones distintas para que los
artículos no se sientan repetitivos:

| Framework | Respuesta rápida | Dato clave | Rendimiento | Transición | Implementación | Tabla | ✅/❌ |
|-----------|------------------|------------|-------------|------------|----------------|-------|------|
| A (PAS)   | ✅ | ✅ | ✅ |    |    | ★ | ★ |
| B (Mito)  | ✅ | ✅ |    |    | ✅ | ✅ | ✅ |
| C (Caso)  | ✅ |    | ✅ | ✅ |    | ✅ | ✅ |
| D (List)  | ✅ | ✅ |    |    | ✅ | ★ | ✅ |
| E (Deep)  | ✅ | ✅✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

(★ = "cuando aplique al tema"; ✅ = obligatorio)

E (deep dive) tiene la mayor densidad de callouts: úsalo 1 de cada 10
artículos. Los otros son más livianos para no abrumar.

### Rotación recomendada para los próximos 10 artículos

3× A · 2× B · 2× C · 2× D · 1× E

## Criterios de aceptación

- [x] `docs/PROMPTS-EDITORIAL.md` creado con los 5 frameworks.
- [x] Cada framework cabe en ~20 líneas (NotebookLM-friendly).
- [x] Cada framework lista explícitamente qué callouts EXIGE.
- [x] Formato `[TITULO] / [CONTENIDO]` preservado (compatible con el
      `handleSmartPaste` del editor que ya parsea esos marcadores).
- [x] Regla "tuteo neutro, NO voseo" presente en cada framework.
- [x] Checklist de validación pre-publicación al final del doc.
- [ ] Post-deploy: Carlos genera 1 artículo con framework A (PAS) y otro
      con framework D (listicle), pega ambos en el editor, ve los callouts
      diferenciados + tabla + listas ✅/❌ + TOC funcionando.

## Riesgos y trade-offs

- **NotebookLM puede no respetar los prefijos exactos:** mitigado pidiendo
  el formato `> **Tipo:** ...` explícitamente en cada framework, con
  ejemplos visuales en la sección FORMATO OBLIGATORIO COMÚN. Si NotebookLM
  produce `> Tipo: ...` sin negrita, el helper de SPEC-065 también lo
  detecta (regex con la alternativa `${prefix}\\s*:`).
- **La IA puede inventar callouts que no existen** (ej. "Advertencia:"):
  el helper los ignora silenciosamente (pasan como blockquote default
  "CLAVE DEL PROTOCOLO"). No rompe nada, solo no se diferencia visualmente.
- **5 frameworks puede ser mucho para single-user:** pero es la forma de
  evitar que los 10 artículos se sientan idénticos en estructura. Si Carlos
  prefiere consolidar, se puede reducir a 3 (PAS, Mythbuster, Deep dive)
  en una futura iteración.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivo creado:**
- `docs/PROMPTS-EDITORIAL.md` — 5 frameworks + reglas + checklist (~250
  líneas, fácilmente buscable).

**Decisiones:**
- Un solo doc en `docs/` en lugar de 5 archivos: facilita la consulta y
  comparación entre frameworks. Carlos abre el doc, decide qué framework
  va a usar, copia ese bloque.
- Bloques de prompt en triple backticks: copy-paste directo a NotebookLM
  sin tener que re-formatear.
- Tabla de distribución de callouts: ayuda a Carlos a planificar la
  variedad sin tener que leer los 5 prompts completos.

**Notas operativas para Carlos:**
1. Abre `docs/PROMPTS-EDITORIAL.md` en VS Code (o donde sea).
2. Decide framework según el tema (PAS para problemas claros, Mythbuster
   para mitos, Caso para temas técnicos, Listicle para N puntos, Deep
   dive para conceptos profundos).
3. Copia el bloque entero del framework elegido.
4. Reemplaza `{TEMA}` con el tema concreto.
5. Pega a NotebookLM.
6. Pega el output al editor admin → publicar.
7. Si NotebookLM recorta o ignora el formato, recordar: "respeta el
   formato exacto del prompt".

Sin desviaciones del plan.
