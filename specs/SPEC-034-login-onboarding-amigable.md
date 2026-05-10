# SPEC-034 — Login con onboarding amigable y preciso

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — UX / conversión
**Severidad:** MEDIO (fricción de registro + copy engañoso)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-024 (gating de quiz para anónimos)

---

## Contexto

`/login` tiene un gate para crear perfil: el visitante debe haber calculado su IMR (`sessionStorage.imr_score`) o haber completado el quiz al final de un artículo (`localStorage.imr_article_read = 'true'`). El flag `imr_article_read` lo setea SPEC-024 solo cuando el visitante **completa el quiz** del artículo, no cuando solo lee.

El copy actual dice:

> **"Debes calcular tu IMR o leer un artículo para habilitar tu registro."**

Tres problemas:

1. **Engaña**: dice "leer un artículo" pero solo leer no setea el flag. Hay que completar el test de evaluación al final.
2. **Tono agresivo**: rojo alerta + UPPERCASE + "DEBES" suena adversarial.
3. **Sin guía a la acción**: no hay links a `/quiz` ni `/biblioteca` desde el alert. El visitante tiene que recordar dónde están.

## Problema

Visitante llega a `/login` con intención de registrarse, intenta crear perfil, recibe el alert rojo "DEBES...", no entiende qué tiene que hacer exactamente, y abandona. Bug de conversión.

## Decisiones tomadas (Carlos 2026-05-10)

- "Hazlo de la forma más amigable posible".

## Solución propuesta

### 1. Copy preciso

Cambio "leer un artículo" → **"leer un artículo y completar su test"**. Refleja el comportamiento real del flag.

### 2. Tono cálido (ámbar) en lugar de alerta (rojo)

- Cambio paleta: `bg-red-600/10 border-red-500/20 text-red-400` → `bg-amber-500/10 border-amber-500/30 text-amber-200`.
- Quito UPPERCASE, uso sentence case con énfasis selectivo en negrita.
- Cambio el lenguaje "debes" → "necesitamos" / "antes de crear tu cuenta".

### 3. CTAs accionables

Dos botones grandes con links directos:

- **🧬 Calcular mi IMR** → `/quiz` (rápido, 2 min, ideal si arrancan con ganas).
- **📖 Leer artículo + test** → `/biblioteca`.

### 4. Hint persistente proactivo

En vez de esconder el mensaje hasta que el user intente "Crear Perfil" sin elegibilidad, mostrarlo desde el primer paint **si no es elegible**. Anticipa la pregunta antes de que falle.

Cuando el user clickea "Crear Perfil" sin elegibilidad, el hint hace un highlight (border más intenso + animación suave) en lugar de aparecer un alert nuevo.

### 5. Persistencia visual cuando ya es elegible

Si el user llega a `/login` ya elegible (porque hizo IMR o completó test antes), mostramos un mensaje breve verde de confirmación en lugar del hint amber:

> ✅ Listo: ya podés crear tu cuenta.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Editar `metamorfosis-web/src/pages/login.astro`:
   - Reemplazar `#merit-alert` por bloque `#onboarding-hint` con copy nuevo + CTAs.
   - Lógica: mostrar amber si no es elegible, verde si lo es.
   - Animación de highlight cuando se intenta crear perfil sin elegibilidad.
3. Build + commit + push.
4. Verificación visual.

## Criterios de aceptación

- [x] Visitante anónimo sin elegibilidad llega a `/login` → ve hint amber con CTAs visibles desde el primer paint.
- [x] El hint dice "leer un artículo y completar su test" (no solo "leer").
- [x] CTAs llevan a `/quiz` y `/biblioteca` respectivamente.
- [x] Click en "Crear Perfil" sin elegibilidad: el hint hace pulse/glow sin alert pop-up.
- [x] Visitante que llega ya elegible (con `imr_score` o `imr_article_read`): ve mensaje verde "Listo: ya podés crear tu cuenta".
- [x] No hay regresión en el flow de login normal (visitante que solo entra a iniciar sesión).

## Pruebas manuales

1. Modo incógnito (sin sessionStorage ni localStorage) → abrir `/login` → ver hint amber con dos botones.
2. Click en "Crear Perfil" → tab cambia, hint hace pulse, NO aparece alert pop-up.
3. Click en "🧬 Calcular mi IMR" → llega a `/quiz`.
4. Volver a `/login` después de completar el quiz IMR → hint cambia a verde "Listo".
5. Tab "Crear Perfil" se desbloquea (✅ en lugar de 🔒).
6. Variante: completar un quiz de artículo → volver a `/login` → mismo resultado verde.
7. Visitante que ya tiene cuenta y solo viene a iniciar sesión: el hint amber sigue visible pero no molesta (puede ignorarlo y entrar con email/pass).

## Riesgos y trade-offs

- **El hint visible siempre puede molestar a users que solo quieren login** (no registro). Aceptable: el hint es informativo, no bloquea el form de login. El email/password sigue funcionando.
- **Si Carlos cambia el gating (más laxo o más estricto)**, hay que actualizar este copy. Es UX-coupled con SPEC-024 — documentado en CLAUDE.md como dependencia conceptual.
- **No mostramos al visitante elegible sin rompérsela**: si llega elegible y NO quiere registrarse (vino solo a login), el verde "Listo" puede sonar redundante. Mitigado con copy corto y no-intrusivo.

## Compatibilidad con ElenaApp

Sin impacto.

## Commit

```
feat(spec-034): login con onboarding amigable y preciso

- Cambio copy 'leer un artículo' → 'leer un artículo y completar su test'
  (matchea el flag imr_article_read que SPEC-024 setea solo al completar)
- Tono cálido amber (no rojo alerta), sentence case, sin "DEBES"
- Hint persistente desde el primer paint con dos CTAs claros (/quiz y
  /biblioteca) en lugar de alerta tras intento fallido
- Si el visitante ya es elegible, hint cambia a verde "Listo"
- Click en 'Crear Perfil' sin elegibilidad: pulse/glow del hint en
  lugar de pop-up nuevo

Cierra SPEC-034.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/pages/login.astro` — reemplazado `#merit-alert` por `#onboarding-hint` con dos estados (amber pendiente / verde listo), CTAs persistentes, animación de pulse al click no-elegible.

**Decisiones tomadas en la marcha:**
- **Hint visible desde el inicio**: anticipa la pregunta antes del error. Más cooperativo.
- **Pulse en lugar de alert**: mantiene contexto visual sin bloquear con modal.
- **Estado "elegible" en verde corto**: confirma sin saturar.
- **CTAs con emoji + acción + tiempo estimado** ("🧬 Calcular mi IMR · 2 min"): vuelve la acción concreta y reduce ansiedad.

**Sin desviaciones del plan funcional.**
