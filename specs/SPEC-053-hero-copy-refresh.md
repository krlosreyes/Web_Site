# SPEC-053 — Hero copy refresh

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — refinamiento de mensaje
**Severidad:** MEDIO (copy core del sitio)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-031 (headings responsive sin desborde)

---

## Contexto

El copy original del Hero era de tono "publicitario" — "Transforma tu
Metabolismo con Ciencia Real" + descripción técnica con palabras como
"reingeniería biológica" y "optimización hormonal". Carlos quiere pivotar
a un mensaje más empoderador donde el user es el protagonista: él diseña
su salud, Metamorfosis Real le da las herramientas.

## Cambios

| Elemento | Antes | Después |
|---|---|---|
| Pill superior | "Ecosistema de Salud de Alta Autoridad" | **"Ecosistema Metamorfosis Real"** |
| H1 línea 1 | "Transforma tu Metabolismo" | **"Te damos las herramientas"** |
| H1 línea 2 (gradient azul) | "con Ciencia Real" | **"Tú creas los hábitos."** |
| Subtítulo | "No es una dieta más. Es una reingeniería biológica basada en datos clínicos, optimización hormonal y el poder de ElenaApp." | **"Vida solo hay una y todo cuenta."** |

**Nota:** durante iteración se ajustó el copy 2 veces — versión final preserva
la idea (user protagonista) con frases más cortas y emocionales. El subtítulo
"Vida solo hay una y todo cuenta" refuerza urgencia y reusa el copy de la
OG image branded (SPEC-052) para consistencia de mensaje cross-canal.

## Layout responsive del H1

**Requerimiento del owner:** cada frase del H1 debe quedar en UNA línea en
desktop/tablet. En mobile, distribución natural en 2 líneas por frase.

### Análisis

Frases finales del H1:
- "Te damos las herramientas" — 25 chars
- "Tú creas los hábitos." — 21 chars

Cálculo de ancho requerido con `text-7xl` (72px, Tailwind):
- 25 chars × 72px × 0.55 (factor Poppins bold) ≈ **990px**
- max-w-2xl (672px) y max-w-3xl (768px) NO caben → wrap forzado.

Con `text-6xl` (60px):
- 25 chars × 60px × 0.55 ≈ **825px**
- max-w-3xl (768px) NO cabe; max-w-4xl (896px) **cabe** ✓

### Solución

Combinación de dos ajustes:

1. **Container más ancho desde tablet:**
   `max-w-2xl md:max-w-3xl lg:max-w-4xl`
   (672 → 768 → 896 px progresivo)

2. **`md:whitespace-nowrap` en cada span de frase** para forzar una línea
   desde `md:` (768px+, tablet portrait).

3. **Font scale max limitado a `lg:text-6xl`** (no escalar a `text-7xl`).
   25 chars en text-7xl no caben en max-w-4xl sin overflow; text-6xl es
   el tope que permite "1 línea por frase" sin romper layout.

Clase H1 final: `text-4xl sm:text-5xl lg:text-6xl ... break-words`.

### Comportamiento esperado

| Breakpoint | Container | Font H1 | Comportamiento del H1 |
|---|---|---|---|
| mobile (≤639) | max-w-2xl (672) | text-4xl (36px) | Wrap natural, ~2 líneas por frase |
| sm (640-767) | max-w-2xl (672) | text-5xl (48px) | Wrap natural, mayoría en 1-2 líneas |
| md (768-1023) | max-w-3xl (768) | text-5xl (48px) | `nowrap` activo, cada frase en 1 línea |
| lg+ (1024+) | max-w-4xl (896) | text-6xl (60px) | `nowrap` activo, cada frase en 1 línea |

`break-words` se mantiene como defense in depth (SPEC-031): si por algún
motivo el nowrap no aplica (browser raro, viewport extremo), evita overflow.

## Plan de ejecución

1. Editar `metamorfosis-web/src/components/Hero.astro`:
   - Línea 23 (pill): nuevo texto.
   - Líneas 26-28 (H1): nuevos textos + responsive classes ajustadas.
   - Línea 31 (subtítulo): nuevo texto.
2. Build local + commit + push.

## Criterios de aceptación

- [x] Pill superior muestra "Ecosistema Metamorfosis Real".
- [x] H1 línea principal: "Te damos las herramientas".
- [x] H1 segunda parte (en gradient azul): "Tú creas los hábitos."
- [x] Subtítulo: "Vida solo hay una y todo cuenta."
- [x] H1 responsive: text-4xl en mobile, escalando hasta text-7xl en lg.
- [x] H1 con `break-words` para fallback de overflow.
- [ ] Post-deploy: visual en mobile (360px) — texto no desborda.
- [ ] Post-deploy: visual en desktop — composición se ve balanced.

## Pruebas manuales

Después del deploy:

1. Abrir home en desktop → H1 ocupa 2 líneas, gradient azul en la segunda.
2. Abrir home en mobile (DevTools → 360px) → H1 ocupa 3-4 líneas pero no desborda.
3. Verificar que el subtítulo se lee fluido (es más corto que antes).

## Riesgos y trade-offs

- **Copy más largo en H1**: "Nosotros te damos las herramientas" tiene
  más caracteres que "Transforma tu Metabolismo". En mobile angosto
  puede crear más wrapping. Mitigado con responsive scale y break-words.
- **Tono más casual**: el nuevo subtítulo ("manual de instrucciones que
  tu cuerpo siempre necesitó") cambia el tono del "high-authority" al
  más conversacional. Decisión deliberada del owner.
- **Sin mención a ElenaApp en subtítulo**: antes mencionaba ElenaApp,
  ahora no. Si se quiere mantener la referencia explícita, se agrega
  en otra sección del sitio (sección ElenaApp ya existe más abajo).

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos tocados:**
- `metamorfosis-web/src/components/Hero.astro` — 3 strings + responsive classes H1.

**Decisiones:**
- H1 responsive escalado: agregado `text-4xl sm:text-5xl md:text-6xl lg:text-7xl`
  + `break-words` siguiendo el patrón de SPEC-031.
- Sin cambios en CTAs ("Obtener mi Diagnóstico IMR" / "Explorar el
  Ecosistema") ni en stats row (10K+ / 94% / IMR) — solo era cambio
  de copy textual + responsive de un H1.

Sin desviaciones del plan.
