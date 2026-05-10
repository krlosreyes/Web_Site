# SPEC-035 — PostReactions con CTA al test (no a registro directo)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — UX / conversión
**Severidad:** MEDIO (mejora la fluidez del funnel anónimo)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-024 (gating quiz), SPEC-032 (PostReactions), SPEC-034 (login amigable)

---

## Contexto

Al final de cada artículo, `PostReactions.tsx` muestra dos botones (👍/👎) y, para anónimos, un CTA azul **"🔒 Registrate para reaccionar"** que linkea directo a `/login`. Carlos pide cambiar el copy a **"Contesta el Test para reaccionar"** y apuntar al quiz que está en la misma página debajo.

Por qué tiene sentido:

1. El test del artículo está **abajo en la misma página** (`#quiz-section`). Pedirle al user que se vaya a `/login` saca al user del flow del artículo justo cuando está más enganchado.
2. El test es lo que da elegibilidad para registro (SPEC-024). Reaccionar implica registrarse, que implica completar el test. Decirle "Contesta el Test" es **el siguiente paso real**, no un atajo a registro.
3. Si el artículo no tiene quiz, el CTA cae al fallback "Registrate" → `/login` (donde SPEC-034 lo guía).

## Problema

CTA actual saca al user de la página del artículo. Pierde contexto y se baja la conversión.

## Solución propuesta

Tres estados del CTA según contexto:

| Estado | User | Tiene quiz | CTA |
|---|---|---|---|
| **A** | Anónimo | Sí | "🧪 Contesta el test para reaccionar" → scroll a `#quiz-section` |
| **B** | Anónimo | No | "🔒 Registrate para reaccionar" → `/login` (fallback actual) |
| **C** | Logueado | (cualquiera) | Botones activos, sin CTA |

`PostReactions.tsx` recibe nuevo prop `hasQuiz: boolean` desde `posts/[slug].astro` (`article.quiz?.length > 0`).

### Comportamiento del scroll

Click en "Contesta el test" → smooth scroll a `#quiz-section` (que ya existe). Si por alguna razón el id no está en el DOM (artículo legacy sin quiz), el botón ni se renderiza.

### Sin cambios en lógica de votación

El flow después del test no cambia: completar quiz → registrarse → reaccionar. SPEC-024 mantiene su rol intacto. Esta spec solo es el copy + acción del CTA.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Editar `metamorfosis-web/src/components/blog/PostReactions.tsx`:
   - Sumar prop `hasQuiz: boolean`.
   - Branching del CTA: si hasQuiz → scroll a `#quiz-section`; si no → link a `/login`.
3. Editar `metamorfosis-web/src/pages/posts/[slug].astro` para pasar el prop.
4. Build + commit + push.
5. Verificación visual.

## Criterios de aceptación

- [x] Anónimo en artículo con quiz: ve CTA "🧪 Contesta el test para reaccionar".
- [x] Click en el CTA hace smooth scroll al quiz, sin recargar página.
- [x] Anónimo en artículo sin quiz (legacy): ve fallback "🔒 Registrate para reaccionar" → `/login`.
- [x] Logueado: no ve CTA, los botones funcionan normalmente (sin cambio).
- [x] Funciona en mobile y desktop.

## Pruebas manuales

1. Modo incógnito → abrir un artículo CON quiz → bajar al bloque de reacciones → ver "🧪 Contesta el test para reaccionar".
2. Click → la página scrollea suave hasta el quiz, queda visible.
3. Completar el quiz como anónimo → vuelve al CTA del quiz "Registrate para ver tu puntaje" (SPEC-024).
4. Si llegás a un artículo legacy sin quiz: ver fallback "Registrate para reaccionar".
5. Logueado en cualquier artículo: NO ver CTA, votar 👍 funciona como antes.

## Riesgos y trade-offs

- **El user que clickea CTA del test puede no completarlo**: queda como anónimo, NO puede reaccionar. Pero ahora tiene la flag elegible para registrarse. El próximo intento de reacción lo manda al fallback `/login` correcto. Aceptable.
- **Si el `#quiz-section` no carga por error**: el scroll no hace nada. Mitigado con renderizado condicional del CTA solo cuando `hasQuiz` es true.
- **No detectamos si el quiz YA fue completado por el user anónimo**: si el flag `imr_article_read=true` ya existe (por otro artículo), igual mostramos "Contesta el test". Una iteración futura puede leer ese flag y mostrar "Registrate para reaccionar" (saltando el test redundante). Por ahora prefiero la versión simple — pedir el test del artículo actual mantiene la consistencia.

## Compatibilidad con ElenaApp

Sin impacto.

## Commit

```
feat(spec-035): postreactions con cta al test (no a registro directo)

- Anónimo + artículo CON quiz: CTA '🧪 Contesta el test para reaccionar'
  con smooth scroll a #quiz-section (no saca al user de la página)
- Anónimo + artículo SIN quiz (legacy): fallback 'Registrate para
  reaccionar' a /login
- Logueado: sin cambios
- Nuevo prop hasQuiz en PostReactions; posts/[slug].astro lo pasa
  según article.quiz?.length

Cierra SPEC-035.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/components/blog/PostReactions.tsx` — nuevo prop `hasQuiz`, branching del CTA.
- `metamorfosis-web/src/pages/posts/[slug].astro` — pasa `hasQuiz={article.quiz?.length > 0}` al componente.

**Decisiones tomadas en la marcha:**
- **Scroll smooth con `scrollIntoView({ behavior: 'smooth' })`** en lugar de `href="#quiz-section"`: garantiza animación suave incluso si CSS scroll-behavior está override-eado.
- **Mantener fallback a registro para artículos sin quiz** en lugar de ocultar el CTA: deja una salida viable.
- **Sin lectura de `imr_article_read` flag**: mantiene la lógica simple. Siempre apunta al test del artículo actual.

**Sin desviaciones del plan funcional.**
