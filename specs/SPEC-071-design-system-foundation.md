# SPEC-071 — Design system foundation

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — fundación de marca premium
**Severidad:** CRÍTICO (sin esto, todo el rediseño es inconsistente)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Bloquea:** SPEC-072, SPEC-073, SPEC-074, SPEC-075

---

## Contexto

Tras revisión visual del dashboard usuario, Carlos identificó que el sitio
se ve "de principiante de niño de colegio" comparado con dashboards
profesionales (Hostinger). La raíz del problema NO es un componente
específico sino la falta de un sistema de diseño:

- Tipografías mezcladas sin regla (Inter + Space Grotesk + Playfair).
- Border-radius caóticos: `rounded-2xl`, `rounded-[3rem]`, `rounded-full`,
  `rounded-[2.5rem]` sin sistema.
- 5+ colores acentos compitiendo: azul brillante + teal + cyan + amber + rojo.
- Decoración exagerada (italic + uppercase + tracking-widest + gradient +
  shadow-2xl) aplicada al MISMO tiempo en componentes que no son hero.
- Jerga interna expuesta al usuario: "Reporte de Diagnóstico SPEC-70.5"
  donde SPEC-70.5 es el nombre interno del motor IMR.

Carlos pidió aplicar principios premium a TODO el sitio (opción C en la
discusión). Esta SPEC es la fundación; SPEC-072+ son las aplicaciones
componente por componente.

## Decisiones ratificadas con Carlos

1. **Acento único: teal `#00C49A`.** Confirmado.
2. **Italic + uppercase + tracking-widest se conserva** como decoración de
   marca pero solo en UN h1 del Hero principal de cada vista, no en todo.
3. **"SPEC-XX" eliminado de toda UI visible.** Sin excepciones.

## Solución

### 1) Tokens canónicos en `global.css`

Bloque `@theme` reescrito con sistema completo:

- **Colores**: 3 backgrounds, 2 borders, 3 tonos de texto, 3 variantes de
  accent teal, 3 de status. Sin azul brillante en el cuerpo.
- **Tipografía**: 4 familias declaradas (Inter body, Space Grotesk heading,
  Playfair serif para .prose, Space Grotesk display reservado a hero).
- **Custom font sizes**: `--text-2xs` (11px) agregado para metadata/badges.
- **Legacy aliases** mantenidos (`--color-accent-blue`, `--color-health-green`)
  marcados como DEPRECATED para no romper código durante migración gradual.

### 2) Clases utilitarias en `@layer components`

Nuevas clases para evitar re-escribir patrones ad-hoc:

- `.card` / `.card-elevated`: base de cards consistente.
- `.pill` + variantes `.pill-accent` / `.pill-status-good/warn/bad`.
- `.eyebrow`: label uppercase tracking pequeño antes de heading.
- `.btn-primary` / `.btn-secondary`: CTAs estandarizados.
- `.glass` / `.btn-gradient`: marcadas DEPRECATED pero no eliminadas
  (rompería componentes vivos hasta SPEC-072+).

### 3) `docs/DESIGN-SYSTEM.md`

Documento de referencia con:

- Principios (información sobre decoración, una dirección estética por
  contexto, densidad sobre aire, sistema sobre casos).
- Paleta canónica con tokens Tailwind.
- Reglas de tipografía: familias, escala, pesos, decoración.
- Border radius prohibidos (`rounded-[Xrem]`).
- Espaciado convenciones.
- Componentes utilitarios disponibles.
- Reglas de sombras: prohibido `shadow-2xl` en cuerpo de app.
- Iconografía consistente.
- Copy del producto: sin jerga (SPEC-XX, v5.0, uid, etc.).
- Plan de migración por SPECs hijas.

### 4) Limpieza inmediata de strings UI con "SPEC-70.5"

4 ocurrencias detectadas y reemplazadas:

- `BioDashboard.tsx` línea 106: `'Análisis SPEC-70.5'` → `'Diagnóstico IMR'`
- `BioDashboard.tsx` línea 197: `'Haz el escaneo SPEC-70.5'` → `'Haz tu diagnóstico IMR'`
- `BioDashboard.tsx` línea 219: `'Reporte de Diagnóstico SPEC-70.5'` → `'Tu reporte IMR'`
- `IMRQuiz.tsx` línea 481: `'recibir el reporte SPEC-70.5'` → `'recibir tu reporte IMR'`

Resto de referencias a `SPEC-XX` en el código son comentarios internos
(JSDoc, code comments) — esos se quedan; no son visibles al usuario.

## Criterios de aceptación

- [x] `@theme` en `global.css` con sistema de colores completo.
- [x] Acento principal teal `#00C49A` definido como `--color-accent`.
- [x] Tipografía: Inter body + Space Grotesk heading + Playfair `.prose`.
- [x] `--text-2xs` (11px) custom size agregado.
- [x] Clases utilitarias `.card`, `.pill*`, `.eyebrow`, `.btn-primary/secondary`
      en `@layer components`.
- [x] `docs/DESIGN-SYSTEM.md` creado con principios + tokens + reglas.
- [x] 0 strings visibles con "SPEC-XX" en UI tras grep exhaustivo.
- [x] Legacy aliases (`--color-accent-blue`, `--color-health-green`,
      `.glass`, `.btn-gradient`) marcados DEPRECATED pero conservados
      para compatibilidad durante SPEC-072+.
- [ ] Post-deploy: el sitio NO debería verse visualmente diferente todavía
      (las clases nuevas no se usan hasta SPEC-072+). Verificar que
      tampoco se rompió nada (no hay warnings de Tailwind en build, no
      hay componentes en blanco).

## Riesgos y trade-offs

- **Legacy aliases conservados**: opción "conservadora": no eliminamos
  `--color-accent-blue` ni `.glass` para no romper componentes vivos.
  Trade-off: el sistema todavía tiene ambigüedad ("¿uso `bg-accent-blue`
  o `bg-accent`?"). Cuando todos los componentes se migren en SPEC-072+,
  un SPEC final de cleanup los elimina.
- **Tipografía**: mantengo Space Grotesk como `font-heading` para no
  cambiar el feel de los heros y landings sin permiso de Carlos. Si
  durante SPEC-072 vemos que Inter para headings se ve más limpio,
  cambiamos a Inter unificado. Decisión postergada.
- **Tokens en CSS vs tailwind.config**: Tailwind v4 prefiere `@theme` en
  CSS. Mantengo `tailwind.config.mjs` minimal sin tokens duplicados; si
  un build futuro necesita tokens en JS (raro), agregar plugin.
- **Esta SPEC no toca componentes existentes**. Es preparación. Carlos
  no verá un cambio visual notable hasta SPEC-072. Aceptable porque
  fundación necesaria.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos modificados:**
- `metamorfosis-web/src/styles/global.css` — `@theme` reescrito con tokens
  completos + `@layer components` con clases utilitarias.
- `metamorfosis-web/src/components/BioDashboard.tsx` — 3 strings UI
  limpiadas.
- `metamorfosis-web/src/components/IMRQuiz.tsx` — 1 string UI limpiada.

**Archivos creados:**
- `docs/DESIGN-SYSTEM.md` — documento maestro del sistema visual.
- `specs/SPEC-071-design-system-foundation.md` — esta spec.

**Decisiones:**
- Tokens en `@theme` (Tailwind v4 idiomatic) en lugar de `theme.extend`
  en `tailwind.config.mjs`.
- Legacy aliases conservados para no bloquear migración gradual.
- `--text-2xs` (11px) custom porque metadata/eyebrows necesitan ese
  tamaño y Tailwind no lo trae por default.
- "SPEC-70.5" reemplazado por "diagnóstico IMR" / "reporte IMR" en
  lugar de inventar nombres nuevos — IMR ya es la sigla canónica del
  motor (Índice Metabólico Real), comprensible y consistente.

**Siguiente paso:** SPEC-072 aplicará el sistema a las 4 vistas críticas
(BioDashboard, Hero, IMRQuiz, posts/[slug]) donde el cambio visual será
notorio.

Sin desviaciones del plan.
