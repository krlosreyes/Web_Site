# Design System — Metamorfosis Real

> **Constitución visual del sitio.** Cualquier componente nuevo o modificado
> DEBE seguir estas reglas. Si un valor que necesitas no está acá, primero
> se agrega como token en `src/styles/global.css`, después se usa.
>
> Establecido en SPEC-071. Aplicado progresivamente desde SPEC-072 en adelante.

---

## 1. Principios

1. **Información sobre decoración.** El sitio comunica salud — credibilidad
   primero, look segundo. Si una decoración compite con la lectura, se
   quita.
2. **Una sola dirección estética por contexto.** Hero/landings pueden usar
   tipografía expresiva (italic + uppercase + gradient en UN h1).
   Dashboard, listas, cards, formularios usan tipografía neutra.
3. **Densidad alta antes que aire promocional.** Cada card debe ganarse su
   espacio. No hay "cards con padding gigante para que se vean importantes".
4. **Sistema antes que casos.** Border-radius, escala tipográfica, paleta,
   sombras son escalas finitas (3-6 valores). Si pedimos rounded-[3rem]
   o text-7xl en un componente nuevo, es señal de mal uso del sistema.
5. **Sin jerga interna en UI.** Nombres de specs (SPEC-XX), nombres de
   versiones (v5.0), nombres de variables (SCHEMA_VERSION) nunca aparecen
   visibles al usuario.

---

## 2. Colores

### Paleta canónica

| Token Tailwind | Valor | Uso |
|---|---|---|
| `bg-bg-base` | `#020617` | Fondo principal de la app |
| `bg-bg-surface` | `#0c1422` | Cards / paneles primarios |
| `bg-bg-elevated` | `#1a2332` | Cards anidadas, hover state |
| `border-border-subtle` | `rgba(255,255,255,0.08)` | Bordes default |
| `border-border-strong` | `rgba(255,255,255,0.14)` | Bordes hover/focus |
| `text-text-primary` | `#f1f5f9` | Headlines, datos primarios |
| `text-text-secondary` | `#94a3b8` | Body, labels, descripciones |
| `text-text-muted` | `#64748b` | Metadata, captions |
| `bg-accent` / `text-accent` | `#00C49A` | Acento único — CTAs, highlights |
| `bg-accent-strong` | `#00b389` | Hover de accent |
| `bg-accent-soft` | `rgba(0,196,154,0.1)` | Fondo de pills accent |
| `bg-status-good` | `#10b981` | Estado "Óptimo" |
| `bg-status-warn` | `#f59e0b` | Estado "Transición" |
| `bg-status-bad` | `#ef4444` | Estado "Deteriorado" |

### Reglas de color

- **Un solo acento**: teal `#00C49A`. Cualquier "color de marca" en un
  componente nuevo es teal. Eliminamos azul brillante `#3B82F6` del cuerpo
  de la app (queda solo en `accent-blue` legacy para no romper código
  viejo, pero no usar en código nuevo).
- **Colores de estado** solo para semántica del IMR / quiz / health: bueno,
  advertencia, malo. No usar verde/amber/rojo como acentos decorativos.
- **Gradientes**: máximo UNO por pantalla, y solo en el h1 del Hero.
  Nunca en backgrounds de cards, bordes, botones, badges.

---

## 3. Tipografía

### Familias

| Familia | Token | Uso |
|---|---|---|
| Inter | `font-body` | Body, labels, todo lo que no sea heading |
| Space Grotesk | `font-heading` / `font-display` | Headings de hero y page titles |
| Playfair Display | `font-serif` | EXCLUSIVO `.prose p` y `.prose blockquote` en /posts/[slug] |

**Regla:** dentro de un mismo componente, no mezclar más de una familia
(salvo el caso del renderer de artículos, que justifica Playfair para
texto largo de lectura).

### Escala

| Token | Tamaño | Uso |
|---|---|---|
| `text-2xs` | 11px | Metadata, badges, eyebrows |
| `text-xs` | 12px | Labels secundarios |
| `text-sm` | 14px | Body chico, captions |
| `text-base` | 16px | Body default |
| `text-lg` | 18px | Body destacado |
| `text-xl` | 20px | Subtítulos de card |
| `text-2xl` | 24px | Títulos de card, section header |
| `text-3xl` | 30px | h1 default de página |
| `text-4xl` | 36px | h1 del Hero principal |
| `text-5xl` | 48px | Hero claim (responsive desktop) |

**Prohibido en cuerpo de app:** `text-6xl` (60px) y mayores. Solo se permite
en el Hero principal de la home como statement, no en headings repetidos
del sitio.

### Pesos

- `font-medium` (500): body default
- `font-semibold` (600): texto destacado dentro de body
- `font-bold` (700): subtítulos de card, labels importantes
- `font-black` (900): solo `<h1>` y `<h2>` de hero/landing

### Decoración (reglas estrictas)

- **`italic`**: solo en UN h1 por pantalla (típicamente el principal del
  Hero). Nunca en labels, body, badges, títulos de cards.
- **`uppercase + tracking-widest`**: solo en pills de estado y eyebrows
  (text-2xs). Nunca en headings.
- **`bg-clip-text` con gradient**: máximo UNA palabra por vista, y solo
  en el h1 del Hero. Nunca en saludos, nombres de usuario, títulos
  repetidos de cards.
- **`text-shadow` / `drop-shadow-2xl`**: solo en hero sobre imagen.

---

## 4. Border radius

| Token | px | Uso |
|---|---|---|
| `rounded-md` | 6px | Pills, badges |
| `rounded-lg` | 8px | Inputs, botones |
| `rounded-xl` | 12px | Cards default |
| `rounded-2xl` | 16px | Cards prominentes, hero panels |
| `rounded-full` | — | Solo avatares y dots |

**Prohibido:** valores arbitrarios `rounded-[Xrem]`, `rounded-[Npx]`.
Si una card "pide" más radius, es señal de que el componente está
mal proporcionado.

---

## 5. Espaciado

Usar la escala estándar de Tailwind. Convenciones:

- **Card interna padding:** `p-6` (24px) mobile, `md:p-8` (32px) desktop.
  Nunca `p-12` o `p-16` para "hacer que la card respire" — eso es decoración
  excesiva.
- **Gap entre cards apiladas:** `gap-4` (16px) o `gap-6` (24px). Nunca
  `gap-12+`.
- **Sección de página padding-y:** `py-16` mobile, `md:py-24` desktop.
- **Container max-width:** `max-w-7xl` para contenido full, `max-w-3xl`
  para contenido editorial, `max-w-xl` para formularios.

---

## 6. Componentes utilitarios

Definidos en `global.css` `@layer components`:

| Clase | Uso |
|---|---|
| `.card` | Card primaria — `bg-bg-surface border border-border-subtle rounded-xl` |
| `.card-elevated` | Card anidada / hover |
| `.pill` | Badge base — `rounded-md text-2xs uppercase` |
| `.pill-accent` | Pill con color teal |
| `.pill-status-good` / `warn` / `bad` | Pills semánticas |
| `.eyebrow` | Label uppercase tracking pequeño antes de heading |
| `.btn-primary` | CTA principal — teal sólido |
| `.btn-secondary` | CTA secundario — outline |

Usar estas clases en lugar de re-escribir `bg-white/[0.03] border-white/10
rounded-2xl ...` cada vez. Si un caso pide variación, primero pensar si
merece nueva clase utilitaria.

---

## 7. Sombras

- **Sombras prohibidas en cuerpo de app:** `shadow-2xl`, `shadow-blue-500/20`,
  `shadow-[0_0_Npx_...]`. Cada card con su aura suma noise visual.
- **Sombras permitidas:** `shadow-sm` para focus rings de inputs, `shadow-lg`
  ÚNICAMENTE en modals/popovers/toasts (elementos flotantes que necesitan
  separación visual del fondo).
- **Hero sobre imagen** puede usar `drop-shadow-2xl` para legibilidad del
  texto sobre fondo variable — es excepción justificada.

---

## 8. Iconografía

- **Una sola librería**: `lucide-react` (importada como `Icons.X`).
- **Tamaño consistente**: `w-5 h-5` para iconos de body, `w-6 h-6` para
  destacados.
- **Color**: `text-accent` para iconos de acento, `text-text-secondary`
  para neutros, nunca `text-blue-400` o colores ad-hoc.

---

## 9. Copy del producto

- **Tuteo neutro hispanoamericano.** Sin voseo argentino (`sos`, `tenés`,
  `mirá`, `pegá`).
- **Nada de jerga técnica visible**: no usar "SPEC-XX", "v5.0",
  "schema_version", "uid", "Firestore". Reemplazar por términos
  comprensibles: "tu reporte", "diagnóstico IMR", "perfil", "datos".
- **Frases cortas en CTAs**: 1-3 palabras (`Iniciar`, `Ver reporte`,
  `Entrar a la tribu`). Si necesita más palabras, partir en CTA + descripción.

---

## 10. Migración (cómo aplicar el sistema)

SPEC-071 establece el sistema. Las SPECs SPEC-072 a SPEC-075 lo aplican
componente por componente:

- **SPEC-072**: 4 vistas críticas (BioDashboard, Hero, IMRQuiz, posts/[slug]).
- **SPEC-073**: Componentes públicos secundarios (Navbar, Footer, Pillars,
  ScienceBox, ElenaAppCTA, Biblioteca).
- **SPEC-074**: Comunidad + Auth + Sobre-mí.
- **SPEC-075**: Admin (panel interno).

**Regla durante migración:** las clases legacy (`bg-bg-base`, `accent-blue`,
`health-green`, `.glass`, `.btn-gradient`) NO se eliminan inmediatamente —
se dejan en `global.css` con comentario DEPRECATED. Cuando se reescribe
un componente, se reemplazan por las clases nuevas. Cuando un legacy ya no
tenga uses, se elimina (PR de cleanup separado).
