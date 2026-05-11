# SPEC-061 — Fix título quiz responsive + copy honesto

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — copy + UX
**Severidad:** ALTO (promesa marketing no respaldada por feature real)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-031 (headings responsive), SPEC-047 (quiz landing copy)

---

## Contexto

Dos problemas en la landing del quiz (`/quiz`, paso 0 del IMRQuiz):

### 1. Título responsive con escalado y tracking agresivos

El H1 tenía `text-3xl sm:4xl md:6xl tracking-tighter`. En desktop con
`md:text-6xl` (60px) + `tracking-tighter` (-0.05em), la palabra
"METABOLISMO" se veía comprimida y rozaba el borde del contenedor;
"TIENE TU" arriba quedaba con kerning visualmente apretado.

Carlos detectó el problema visualmente (mismo patrón de SPEC-031:
headings de texto largo + tracking apretado = riesgo de overflow).

### 2. Copy del sub-hook prometía un "reporte" que no existe

El copy decía:

> Descubre tu **Índice Metabólico Real (IMR)** y recibe un reporte
> personalizado con los 5 pilares que tienes que ajustar para recuperar
> energía, claridad mental y composición corporal.

Pero el quiz NO entrega:
- Un "reporte personalizado" (no hay documento PDF ni similar).
- "Los 5 pilares para ajustar" (los 5 pilares son una taxonomía
  editorial, no un análisis personalizado por user).
- Promesas vagas de "recuperar claridad mental" (no hay métricas ni
  tracking de claridad mental).

Lo que SÍ entrega (verificado contra el motor IMR SPEC-70.5 +
SPEC-006 onboard):

- **IMR score 0-100** (con label: OPTIMIZADO/EFICIENTE/FUNCIONAL/INESTABLE/DETERIORADO).
- **Edad metabólica** estimada (formula Mifflin-St Jeor + ajustes).
- **3 bloques componentes**: E (Estructura), M (Metabolismo), C (Conducta) con peso 0-1 cada uno.
- **Composición corporal**: body fat % (Navy), lean mass %, IMC, FFMI, WhtR.
- Lista de espera ElenaApp (post-registro).

El gap entre lo prometido y lo entregado erosiona confianza. Carlos
pidió "ajustar de forma coherente".

## Solución

### 1. Título: escalado más conservador

| Antes | Después |
|---|---|
| `text-3xl sm:4xl md:6xl` | `text-3xl sm:4xl md:5xl lg:6xl` |
| `tracking-tighter` (-0.05em) | `tracking-tight` (-0.025em) |
| `leading-[1.05]` | `leading-[1.1]` |

Cambios:
- Agrega breakpoint `lg:` para que el text-6xl solo aparezca en pantallas
  ≥1024px (donde el ancho del container ya garantiza espacio holgado).
- `tracking-tight` en vez de `tighter` reduce la compresión: más
  cómodo de leer y menos riesgo de overflow.
- `leading-[1.1]` (vs 1.05) le da más respiro vertical entre las dos
  líneas del título cuando wrappea.

### 2. Copy honesto del sub-hook

**Antes:**
> Descubre tu **Índice Metabólico Real (IMR)** y recibe un reporte
> personalizado con los 5 pilares que tienes que ajustar para recuperar
> energía, claridad mental y composición corporal.

**Después:**
> Calcula tu **Índice Metabólico Real (IMR)** en menos de 2 minutos.
> Descubre tu edad metabólica estimada y la zona biológica donde te
> encuentras hoy.

Cambios:
- "Calcula" en lugar de "Descubre" — el quiz literalmente CALCULA un
  número, no descubre un secreto.
- "en menos de 2 minutos" anclado al hook ("2 minutos" estaba en el
  pill arriba pero acá refuerza expectativa de tiempo).
- "edad metabólica estimada" + "zona biológica" — lo que SÍ entrega.
- Eliminado: "reporte personalizado", "5 pilares", "claridad mental",
  "composición corporal" → no es lo que el output muestra hoy.
- Conexión con el título "¿Qué edad tiene tu metabolismo?" → la
  respuesta es "tu edad metabólica estimada" que aparece en el sub.

## Criterios de aceptación

- [x] H1 del quiz usa `text-3xl sm:4xl md:5xl lg:6xl tracking-tight`.
- [x] Sub-hook NO menciona "reporte personalizado".
- [x] Sub-hook NO menciona "5 pilares" como entregable.
- [x] Sub-hook menciona "edad metabólica" y "zona biológica" (cosas reales).
- [x] Hook principal "Tu cuerpo te está hablando. Vamos a traducirlo." se mantiene.
- [ ] Visualmente en desktop el título se ve cómodo, sin compresión.
- [ ] Visualmente en mobile (≤640px) el título wrappea sin romper palabras.

## Pruebas manuales

1. Visitar `/quiz` en desktop (≥1280px) → título grande pero sin compresión, "METABOLISMO" no roza el borde.
2. Visitar en tablet (768-1024px) → text-5xl, dos líneas balanceadas.
3. Visitar en mobile (≤640px) → text-3xl, wrap natural sin overflow.
4. Leer el sub-hook → coherente con lo que el user va a recibir post-quiz.
5. Completar quiz y verificar que el output (dashboard post-registro)
   coincide con la promesa: IMR + edad + zona + bloques.

## Riesgos y trade-offs

- **Pérdida de promesa "aspiracional"**: el copy nuevo es más sobrio.
  Si en el futuro el quiz sí entrega un reporte PDF + análisis de 5
  pilares (feature nueva), el copy se puede mover hacia esa promesa.
  Por ahora prefiere ser honesto que vender humo.
- **"Zona biológica" puede sonar genérico**: pero es exactamente el
  label que el motor IMR retorna (`OPTIMIZADO`, `EFICIENTE`, etc.).
  Connecta directamente con el output que el user ve.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos modificados:**
- `metamorfosis-web/src/components/IMRQuiz.tsx` — H1 con escalado más
  conservador + tracking-tight, sub-hook reescrito.

**Decisiones:**
- Mantener el frase corta "Tu cuerpo te está hablando. Vamos a
  traducirlo." (hook emocional, no promete features).
- No tocar el botón CTA ("Iniciar mi diagnóstico") ni los trust
  signals abajo ("sin registro previo · resultado al instante · basado
  en evidencia").
- Si en el futuro se quiere reintroducir copy más vendedor, hacerlo
  cuando el feature exista (ej. "Recibe tu reporte por email" solo
  cuando el endpoint exista de verdad).

Sin desviaciones del plan.
