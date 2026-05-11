# SPEC-060 — Refresh copy de la sección "Ciencia Aplicada"

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — voz de marca
**Severidad:** MEDIO (copy de la home)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes

---

## Contexto

La sección "Ciencia Aplicada" de la home estaba sobrecargada y poco
enfocada: 6 elementos visuales (subtítulo + 4 párrafos + 1 quote + 1 tip
box + 1 párrafo de cierre) con jerga genérica de wellness ("variabilidad
de la frecuencia cardíaca HRV", "respuesta glucémica postprandial",
"futuro de la salud"). El user terminaba sin tener claro qué hace
Metamorfosis Real con esos datos.

Carlos pidió un copy más concreto que:
- Conecte explícitamente con el IMR (no HRV genérico).
- Hable del valor para el usuario individual ("tu avance", "tu metabolismo").
- Simplifique el flujo: menos párrafos, mensaje más directo.
- Termine con la "Estrategia Práctica" en lugar del párrafo "futuro de
  la salud".

## Cambios

### Subtítulo

**Antes:** "Mira cómo transformamos datos técnicos en resultados biológicos reales."

**Después:** "Convertimos datos técnicos en salud real. No adivinamos: usamos la
variabilidad de tu IMR para medir tu avance y lo ajustamos en tiempo real."

### Párrafos

**Antes (4 párrafos + 1 quote):**
1. "El sistema Metamorfosis Real no se basa en conjeturas. Utilizamos el
   análisis de la variabilidad de la frecuencia cardíaca (HRV)."
2. "Orquestamos la carga metabólica ideal para tu cuerpo analizando la
   respuesta glucémica postprandial en tiempo real."
3. Quote: "La autofagia selectiva inducida por el ayuno intermitente (16/8)
   aumenta la eficiencia mitocondrial en más de un 22%."
4. "No solo se trata de cuándo comer, sino de cómo la estructura
   molecular de tus nutrientes interactúa con tu ritmo circadiano."
5. (Después del TipsBox): "Este es el futuro de la salud. Autoridad
   médica unida a inteligencia artificial para salvar el metabolismo
   moderno."

**Después (2 párrafos):**
1. "El ayuno sugerido será el ideal para ti y puede ir cambiando a medida
   que vas mejorando tu metabolismo."
2. "Dominar tu metabolismo es entender cómo la estructura de los
   nutrientes y tus hábitos interactúan con tu ritmo circadiano. Es
   ciencia, no tendencia."

### Estrategia Práctica (TipsBox)

**Antes:** "Consume el 70% de tus carbohidratos post-entrenamiento para
maximizar el transporte de GLUT4 sin elevar la insulina basal."

**Después:** "Consume el 70% de tus carbohidratos tras entrenar. Esto activa
el transporte de GLUT4 y nutre el músculo sin elevar la insulina basal."

(Sutil pero importante: "tras entrenar" es más natural que "post-entrenamiento";
"esto activa" + "nutre el músculo" sustituye la fórmula clínica "para
maximizar".)

## Plan de ejecución

1. Editar `pages/index.astro` sección Ciencia Aplicada:
   - Subtítulo nuevo.
   - Eliminar párrafos 1, 2 y el final.
   - Reemplazar párrafos restantes con los nuevos.
   - Eliminar el `<ScienceBox>` con quote de autofagia.
   - Actualizar copy del `<TipsBox>`.
2. Quitar el `import ScienceBox` huérfano (ya no se usa en index).
3. Build local + commit + push.

## Criterios de aceptación

- [x] Subtítulo dice "Convertimos datos técnicos en salud real. No adivinamos: usamos la variabilidad de tu IMR..."
- [x] Solo 2 párrafos + 1 TipsBox + el botón final.
- [x] El quote con border azul (`<ScienceBox>`) ya no aparece.
- [x] El TipsBox tiene el nuevo copy con "tras entrenar".
- [x] `import ScienceBox` removido de index.astro.
- [x] "sera" corregido a "será" (ortografía).

## Riesgos y trade-offs

- **El componente `ScienceBox.astro` queda sin usuarios** en el sitio.
  No se borra del repo porque puede reusarse en artículos futuros (es
  un wrapper genérico de "quote científico"). Si en una limpieza futura
  se confirma que no se usa, se elimina.
- **"Es ciencia, no tendencia"** es una afirmación fuerte que invita a
  contrastar con marketing wellness. Aceptable para el tono Metamorfosis
  Real (que se posiciona en autoridad y datos, no en lifestyle).

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos modificados:**
- `metamorfosis-web/src/pages/index.astro` — sección "Ciencia Aplicada"
  reescrita: subtítulo + 2 párrafos + TipsBox, eliminados quote de
  autofagia + párrafo final, import de ScienceBox removido.

**Decisiones:**
- Mantener `ScienceBox.astro` como componente reusable aunque ya no se
  use en index (puede aparecer en artículos del blog que escriba el admin).
- Aplicar tilde correcta "será" en lugar de "sera" del input original.
- Sin cambios en el botón final ni en el heading principal "Ciencia
  Aplicada".

Sin desviaciones del plan.
