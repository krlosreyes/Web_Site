# Revisión SEO + performance + funnel — Metamorfosis Real

**Fecha:** 2026-05-25
**Revisor:** Cowork (Claude)
**Alcance:** dominio actual `metamorfosisvital.com.co` (SPEC-111 en curso hacia `metamorfosisreal.org`).

---

## Resumen ejecutivo (leer primero)

El tráfico está en cero por **una causa dominante que ya fue diagnosticada y
apenas empieza a resolverse**: hasta el 2026-05-24 el sitio servía
`canonical="http://localhost:4321/"` (regresión de SPEC-107 fixed por
SPEC-108). Google descartaba todas las URLs como no canónicas. La verificación
de propiedad en Google Search Console, el submit del sitemap y la solicitud
manual de indexación de 5 URLs se hicieron **hace 1 día**. La ventana normal
para ver los primeros resultados orgánicos es **7-14 días**, y para
consolidar posiciones estables **2-3 meses**.

Antes de sacar conclusiones sobre "el SEO no funciona", conviene esperar el
ciclo natural. Dicho esto, sí hay palancas técnicas y de contenido que se
pueden mover en paralelo para acelerar el crecimiento cuando la indexación
empiece a materializarse.

Este documento las lista, las prioriza y las mapea a specs concretas.

---

## Hallazgos por severidad

### 🔴 Críticos (accionar en 7 días)

**H1. Imágenes del Plan 14 días pesan 6.5-8.5 MB cada una (100 MB total).**

`/public/plan14d/dia-01.webp` a `dia-14.webp` son webp pero cada archivo
individual supera los 6 MB. Un webp bien optimizado para display 1200px
debería estar entre 100-300 KB. Cuando un user carga `/dashboard/plan`, el
LCP se dispara. Impacto directo en Core Web Vitals → Google penaliza ranking.

**Fix:** re-encodear los 14 archivos con `cwebp -q 78 -m 6` o similar hasta
llegar a ~250 KB por imagen. Ganancia esperada: **~95 MB menos** en total,
LCP de `/dashboard/plan` bajaría 3-5s en móvil promedio.

**Propuesta:** SPEC-113.

**H2. `carlos-reyes.png` (1.6 MB), `logoSite.png` (1.4 MB), `elena-mockup.png` (605 KB) sin variante webp.**

Regla CLAUDE.md ya estipula "imágenes >500 KB deben tener variante webp".
Estos tres archivos infringen la regla.

**Fix:** generar `.webp` de cada uno (calidad 82, método 6) y usar el webp
para render inline. El PNG/original se mantiene solo para OG/scrapers.

**Propuesta:** SPEC-117.

### 🟡 Importantes (accionar en 30 días)

**H3. Meta descriptions inconsistentes o ausentes.**

Inventario de las 16 páginas públicas:

| Página | Title | Description | Diagnóstico |
|---|---|---|---|
| `/` | "" (fallback siteName) | "Ecosistema de salud metabólica de alta autoridad..." | Abstracta, sin keywords fuertes |
| `/biblioteca` | "Biblioteca" | "Adquiere el conocimiento científico..." | Corta (79 chars), no dice qué contiene |
| `/imr` | "Qué es el IMR" | Buena | ✓ |
| `/imr/metodologia` | "Metodología del IMR" | Buena | ✓ |
| `/quiz` | "Diagnóstico IMR" | Buena (acción + tiempo + valor) | ✓ |
| `/sobre-mi` | "Sobre mí" | Buena | ✓ |
| `/comunidad` | "La Tribu \| Comunidad Biohacker" | **Sin description** | 🔴 |
| `/calculadora` | (redirect 301) | — | OK (redirect a /quiz) |
| `/dashboard`, `/dashboard/plan`, `/login` | varios | Sin description (correcto: noindex) | ✓ |
| `/posts/[slug]` | del artículo | **Primeros 160 chars del contenido raw** | 🔴 subóptimo |
| `/elenasupport` | "Soporte Elena App" | Buena | ✓ |

**Problemas puntuales:**

- **Home:** "alta autoridad" no significa nada para el usuario ni para Google. Falta keyword directa como "salud metabólica", "ayuno intermitente" o "índice metabólico".
- **Biblioteca:** debería decir cuántos artículos hay y de qué temas ("Artículos sobre ayuno, nutrición, ejercicio, hidratación y sueño basados en evidencia científica").
- **Comunidad:** sin description. El SERP muestra un fragmento aleatorio del contenido.
- **Artículos:** `articleDescription = content.substring(0, 160)` corta a mitad de frase y no está escrito para SEO. Debería ser un campo `metaDescription` editable en el admin.

**Propuesta:** SPEC-114 (descriptions optimizadas + campo `metaDescription` en admin).

**H4. Schema.org (JSON-LD) limitado.**

Actualmente hay: `Organization`, `WebSite`, `Article`. Faltan:

- **BreadcrumbList** en `/biblioteca` y `/posts/[slug]` — Google los muestra como breadcrumbs en SERP (mejora CTR).
- **FAQPage** en `/elenasupport` — la sección de FAQ ya existe estructurada; agregando el schema, Google la muestra como rich snippet.
- **HowTo** para artículos con secciones numeradas ("cómo empezar con ayuno intermitente", "protocolo 16:8"). Requiere convención en el admin.
- **Person** en `/sobre-mi` — mejora la marca personal de Carlos como autor de referencia (E-E-A-T de Google).

**Propuesta:** SPEC-115.

**H5. Sitemap incompleto.**

Falta `/imr/metodologia` (creada en SPEC-102) y `/elenasupport` (creada hoy
en SPEC-112). Ambas son páginas relevantes para SEO.

**Fix:** agregar 2 líneas al array `STATIC_PAGES` en `sitemap.xml.ts`.

**Propuesta:** incluir en SPEC-114 (junto con descriptions).

### 🟢 Deseables (accionar en 90 días)

**H6. Bundle Recharts (326 KB) carga en admin.**

`CartesianChart.DPxt9idA.js` pesa 326 KB. Solo se usa en `AnaliticaIMR.tsx`
(panel admin). Si se importa con `client:only="react"` en lugar de
`client:load`, sale del critical path de cualquier página no-admin.

**Nota:** hay que verificar primero que efectivamente está en el bundle del
cliente público. Si Astro ya lo aisló al admin, este item baja de prioridad.

**Propuesta:** SPEC-116 (ya candidata en backlog auditoría 2026-05-08 #27).

**H7. Volumen de contenido editorial insuficiente para long-tail.**

En un nicho de salud, los sitios que capturan tráfico orgánico consistente
tienen **30-100+ artículos** con densidad de keywords sobre temas del pilar.
Este sitio tiene menos artículos (no accedo directo a Firestore para contar,
pero por el flujo de creación editorial `handleSmartPaste` y prompts de
SPEC-066 se ve que el pipeline está optimizado y la cadencia es baja).

**Recomendación estratégica:** publicar 2-3 artículos por semana durante 90
días → +30-40 artículos. Cada artículo es una entrada nueva de búsqueda
long-tail ("qué es el ayuno 16:8", "cuántas horas dormir para bajar de peso",
"electrolitos en ayuno prolongado", etc.).

Los prompts editoriales existentes (SPEC-066) ya facilitan esto: 5 frameworks
+ NotebookLM-friendly. **El cuello de botella es tiempo humano, no
tooling.**

**Propuesta:** SPEC-118 (content sprint 90 días con calendario y temas
priorizados por volumen de búsqueda + competencia).

**H8. Tracking de referrers/canales de adquisición.**

Umami trackea 13 eventos custom bien pensados (cta_quiz_iniciar,
cta_youtube_hero, etc.) — sólido. Pero no vi tracking explícito de UTMs
desde YouTube o redes. Sin esto no podés atribuir qué canal trae tráfico
cuando el volumen empiece a crecer.

**Fix:** convención UTM para todos los links salientes de YouTube y redes
(`?utm_source=youtube&utm_medium=description&utm_campaign=video_XYZ`).
Umami los captura automáticamente.

**Propuesta:** SPEC-119 (convención UTM + dashboard de fuentes en el admin).

---

## Plan de acción por horizonte

### Horizonte 1 — próximos 7 días

Foco: **quick wins que Google ya va a "ver" en la próxima re-indexación** +
resolver los críticos.

| # | Acción | Quién | Esfuerzo | Impacto |
|---|---|---|---|---|
| 1 | SPEC-113: compresión imágenes plan14d | Yo | 30 min código + 1h re-encodear | Alto (Core Web Vitals) |
| 2 | SPEC-117: webp de carlos-reyes/logo/elena-mockup | Yo | 20 min | Medio |
| 3 | Agregar `/imr/metodologia` y `/elenasupport` al sitemap | Yo | 5 min (dentro de SPEC-114) | Bajo pero necesario |
| 4 | Monitorear GSC cobertura diariamente hasta el 2026-06-01 | Carlos | 5 min/día | Alto (validación diagnóstico) |
| 5 | Descripción del canal de YouTube: agregar link al sitio con UTM | Carlos | 10 min | Medio (backlink + tráfico dirigido) |

### Horizonte 2 — próximos 30 días

Foco: **contenido + señales de calidad + preparación de la migración**.

| # | Acción | Quién | Esfuerzo |
|---|---|---|---|
| 6 | SPEC-114: meta descriptions + campo `metaDescription` en admin | Yo | ~2h |
| 7 | SPEC-115: schema.org FAQPage + BreadcrumbList + Person | Yo | ~2h |
| 8 | SPEC-118 fase 1: publicar 8-10 artículos nuevos usando prompts SPEC-066 | Carlos + IA | ~1h por artículo |
| 9 | SPEC-111 cutover a `metamorfosisreal.org` (cuando Resend confirme y GSC nueva propiedad esté lista) | Ambos | Sesión de ~2h coordinada |
| 10 | Interlinking: cada artículo debe linkear a 2-3 artículos relacionados | Carlos manual o en el editor | ~5 min por artículo |
| 11 | Comprimir carlos-reyes/logo/elena-mockup vía SPEC-117 (si no se hizo en semana 1) | Yo | 20 min |

### Horizonte 3 — próximos 90 días

Foco: **crecimiento sostenido + medición + comunidad**.

| # | Acción | Quién |
|---|---|---|
| 12 | SPEC-116: Recharts a `client:only` (evaluar primero si está en bundle público) | Yo |
| 13 | SPEC-118 fase 2: 20-30 artículos adicionales | Carlos |
| 14 | SPEC-119: convención UTM + dashboard fuentes en admin | Yo |
| 15 | Newsletter (Resend broadcast) con lead magnet — captura de emails más allá del quiz | Yo (spec) + Carlos (contenido) |
| 16 | Guest posts / colaboraciones con otros creadores de salud metabólica en LATAM | Carlos |
| 17 | Google Discover optimization: OG images con caras humanas + títulos click-worthy | Yo (auditar) + Carlos (aprobar cambios) |

---

## Métricas para trackear semanalmente

- **GSC → Coverage:** URLs indexadas (objetivo 7 días: las 5 solicitadas + 5-10 más automáticas)
- **GSC → Performance:** impresiones (aparecen antes que los clicks; primer indicador de que Google entrega el sitio)
- **GSC → Clicks + CTR:** cuando aparezcan
- **Umami → Sessions + bounce rate:** por página. Bounce alto en `/quiz` es red flag.
- **Umami → Custom events:** `cta_quiz_iniciar` (top de funnel), `imr_completado` (conversión), `registro_completado` (fondo de funnel).
- **Firebase → registro totales:** cohorte fundador (SPEC-056) hasta el cap de 1000.
- **Resend → email deliverability:** open rate + bounce rate del welcome.

---

## Lo que NO conviene hacer

- **No comprar backlinks.** Google los detecta y penaliza. Para un nicho de
  salud es especialmente riesgoso.
- **No copy-paste de otros sitios.** Google identifica contenido duplicado y
  lo entierra. Los prompts editoriales existentes generan contenido original.
- **No cambiar dominios repetidamente.** SPEC-111 ya es una migración; que
  sea la última por al menos 2 años.
- **No keyword-stuff.** Escribir para humanos primero, para SEO segundo.
  Los prompts SPEC-066 ya lo hacen bien.
- **No abrir muchas SPECs nuevas al mismo tiempo.** El flujo SDD funciona
  cuando cada spec se cierra antes de abrir la siguiente. Sugerencia: SPEC-113
  y SPEC-117 primero (críticos), después el resto secuencial.
- **No obsesionarse con métricas antes del 2026-06-08.** El sitio necesita
  esa ventana para que Google empiece a servir resultados. Analizar tráfico
  el 2026-05-30 va a devolver una imagen distorsionada.

---

## Anexo: dependencias entre las SPECs propuestas

```
SPEC-108 (SEO canonical fix) ✅
   └── habilita → SPEC-111 (migracion dominio), SPEC-113, SPEC-114...

SPEC-113 (imagenes plan14d) [CRITICO]
   └── independiente. Puede pushearse mañana.

SPEC-117 (webp de carlos/logo/elena) [CRITICO]
   └── independiente. Puede combinarse con SPEC-113 en un solo commit
       de "performance sweep".

SPEC-114 (meta descriptions + admin metaDescription field)
   └── independiente.

SPEC-115 (schema.org FAQ + Breadcrumb + Person)
   └── independiente.

SPEC-118 (content sprint 90d)
   └── depende de SPEC-114 (para que los articulos nuevos tengan meta
       description dedicada desde el admin).

SPEC-116 (Recharts client:only)
   └── verificar primero si es problema real (grep en bundle publico).

SPEC-119 (UTM convention + dashboard)
   └── depende de tener volumen suficiente para que el dashboard tenga
       datos utiles. Postponer a horizonte 90d.
```

## Resultado esperado si se ejecuta el plan

- **7 días:** primeras impresiones en GSC (5-20 URLs indexadas), Core Web Vitals verde en móvil.
- **30 días:** 100-500 impresiones/semana en GSC, 20-50 sessions/semana en Umami desde orgánico, primeros clicks (CTR ~1-3%).
- **90 días:** 2000-5000 impresiones/semana, 200-500 sessions/semana desde orgánico, biblioteca con 30-40 artículos indexados, ranking en primera página para 5-10 keywords long-tail.

Estos números son estimaciones conservadoras para un nicho de salud con
contenido nuevo. Un canal YouTube activo con backlinks a artículos específicos
puede acelerar significativamente.
