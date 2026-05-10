# SPEC-000 — Metodología Spec-Driven Development (Metamorfosis Real)

**Estado:** 📜 Vivo (no se cierra; se actualiza cuando cambia la metodología)
**Fase:** Meta — gobernanza del proyecto
**Fecha de creación:** 2026-05-09
**Autor:** Carlos Reyes
**Origen:** análisis del documento `Spec_Driven_Development.pdf` (NotebookLM,
2026-05-09) cruzado con la práctica real del repo Web_Site.

---

## ¿Por qué este documento?

El PDF describe SDD como un cambio de paradigma: el entregable del humano es
la **especificación**, no el código; la IA ejecuta. Esta spec captura cuáles
de las prácticas del manifiesto adoptamos en este proyecto, cuáles
descartamos, y por qué. Es el "manual del director de orquesta" para
Metamorfosis Real.

## Adoptado (núcleo SDD operativo)

### 1. Una spec por cambio, una commit por spec

Toda mejora pasa por `specs/SPEC-NNN-*.md`. La spec define contexto,
problema, solución propuesta, plan, criterios de aceptación, pruebas
manuales, riesgos, commit y resultado. La implementación cierra contra esa
spec con un único commit + push directo a `main`.

**Por qué funciona acá:** Carlos opera solo, no hay PRs, el feedback loop
es cortísimo. Tener una spec por delante elimina vibe coding y deja audit
trail para futuras decisiones.

### 2. Memoria persistente con ámbitos diferenciados

- **`CLAUDE.md`** — el archivo maestro: scope, stack, reglas
  inquebrantables, mapa de archivos clave, comportamiento esperado del
  agente. Vive en el root del repo. **Lo lee cualquier agente al iniciar.**
- **`ROADMAP-SDD.md`** — índice de todas las specs por fase y estado.
- **`specs/SPEC-NNN-*.md`** — una por cambio. La unidad de trabajo.
- **Memoria del agente (`MEMORY.md` + archivos `feedback_*.md` /
  `project_*.md`)** — patrones que cruzan sesiones (gotchas, preferencias,
  contexto operativo).

### 3. Documentar el "Resultado" tras cerrar

Cada spec termina con sección `## Resultado` describiendo qué quedó hecho y
qué se desvió del plan original. Esto convierte cada spec en post-mortem
ligero — futuras specs aprenden de las pasadas sin tener que leer git log.

### 4. Lecciones cristalizadas como reglas inquebrantables

Cada vez que un loop iterativo nos cuesta tiempo, la lección se promueve a
la sección "Reglas inquebrantables" de `CLAUDE.md` y a memoria como
`feedback_*.md`. Hoy hay 4 reglas (Astro 6 CSRF, cookies de invalidación,
fetch sin chequeo de res.ok, fixes completos en una pasada). Son
inquebrantables porque romperlas ya nos costó horas.

### 5. Verificación humana obligatoria post-deploy

El agente NUNCA marca una spec como cerrada sin confirmación visual del
admin sobre el sitio en producción. Esto es la "ola de calidad del código"
del slide 14 del PDF: el escudo contra aprobar ciegamente.

## Adoptado en este momento (gaps que resuelve este meta-doc)

### 6. CLAUDE.md como archivo maestro

Hasta ahora la "constitución" del repo estaba dispersa entre el ROADMAP y
las memorias auto-cargadas. Centralizarla en `CLAUDE.md` (slide 7 del PDF —
"El Archivo Maestro") evita reinventar reglas y reduce el costo de
onboardear un agente nuevo.

## Pendiente de adoptar (proponer specs si aporta valor)

### 7. Tests automatizados de regresión

Hoy cada spec lista "Pruebas manuales" y Carlos verifica visualmente. Tres
módulos críticos son código puro y se beneficiarían de tests unitarios
automatizados:

- **Motor IMR** (`src/lib/imr/engine.ts`) — `calculateSPEC705`,
  `metabolicAge`, `bodyFatNavy`. Si una refactorización futura mueve un
  decimal, ahora no nos enteramos hasta que un user reporta un score raro.
- **Auth admin** (`src/lib/auth.ts`) — `isValidSessionValue` (constant-time
  compare), `parseCookies`, generación de `Set-Cookie` con flags. Si alguien
  rompe el constant-time, lo único que se ve es que sigue "funcionando".
- **Validadores de endpoints admin** — `leads.ts` PUT (status enum, tags
  array, notes truncado), `posts.ts` POST/PUT (status draft/published).

**Stack sugerido:** Vitest (sin mocks; firestore-emulator si hace falta).
**Trigger para abrir spec:** cuando hagamos una refactor del motor IMR o de
auth.ts.

### 8. Pre-commit hooks

El SPEC-009 (auditoría de credenciales filtradas) se podría haber
prevenido con un hook de pre-commit que grepee credenciales conocidas
(`FIREBASE_PRIVATE_KEY=`, `ADMIN_PASSWORD=`, `-----BEGIN PRIVATE KEY-----`)
en los staged files y aborte el commit. Bajo ROI hoy (Carlos ya tiene la
disciplina), pero útil si suma un colaborador.

**Trigger para abrir spec:** si en el futuro otro humano (o agente)
empieza a commitear en este repo.

## Descartado (no aplica al proyecto)

### Sub-agentes especializados (slide 9)

El PDF propone agente principal + sub-agentes (TDD, docs, seguridad). Para
un equipo de 1, con specs pequeñas y un único deploy target, sumar
coordinación entre agentes es overhead sin retorno. Reevaluar si el repo
crece a >5 colaboradores.

### MCPs específicos del manifiesto (Supabase, Figma, Playwright, slide 8)

- **Supabase MCP** — N/A (usamos Firebase).
- **Figma MCP** — N/A (sin diseño en Figma).
- **Playwright MCP** — útil teóricamente para auto-screenshot post-deploy y
  verificar que nada se rompió visualmente. ROI bajo hoy: Carlos verifica en
  segundos. Reevaluar si las verificaciones manuales empiezan a perder
  errores.

### Modo asíncrono `/remote session` desde celular (slide 13)

Ya tenemos el flow de Cowork con aprobación de tools desde el desktop. No
necesitamos celular para autorizar comandos.

## Antipatrones a evitar (del slide 14 del PDF)

- **Aprobar código ciegamente.** Cada cambio del agente debe ser revisado
  por el humano antes de cerrar la spec. Esto no es burocracia — es el
  único escudo contra que la calidad del código colapse a futuro.
- **Vibe coding.** Pedirle a la IA que "haga X" sin spec previa. Resultado
  típico: el cambio rompe tres cosas que no esperabas.
- **Mezclar specs.** Si trabajando en SPEC-A aparece un problema de SPEC-B,
  se anota o se abre nueva spec — NO se mete en el commit en curso.
- **Confiar en lo que el agente dice que hizo** sin verificar el diff. El
  agente puede afirmar "implementé X" cuando en realidad implementó Y. La
  fuente de verdad es el archivo, no el resumen.

## Cómo se actualiza este documento

- Al adoptar una nueva práctica del PDF, mover el item de "Pendiente" a
  "Adoptado".
- Al descartar una práctica que parecía útil, mover a "Descartado" con
  razón breve.
- Al aprender un nuevo antipatrón con costo real, agregarlo a la sección
  correspondiente.
- Mantenerlo bajo ~300 líneas. Si crece, partir en sub-docs (ej.
  `001-TESTING-STRATEGY.md` cuando adoptemos tests).

Última revisión: **2026-05-09** (creación, post-análisis del PDF NotebookLM).
