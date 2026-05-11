# SPEC-069 — Dashboard de usuario: layout premium coherente

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — visual / UX
**Severidad:** ALTO (Carlos describió el dashboard como "diseño de principiante de niño de colegio")
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-006 (BioDashboard original), SPEC-031 (responsive headings), SPEC-057 (banner fundador), SPEC-061 (títulos italic responsive)

---

## Contexto

Carlos abrió su dashboard personal (`/dashboard`) tras hacer onboarding como fundador #1 y mostró un screenshot con tres problemas combinados:

1. **Huecos enormes en la columna derecha.** Las 3 cards de la derecha (Elena App, La Tribu Biohacker, Dominio Teórico) tenían espacios verticales gigantes entre sí, como si flotaran sueltas en el espacio.
2. **Título del pilar evaluado cortado:** "EL CODIGO DE LA OBESIDA..." con ellipsis. Se nota inmediatamente porque la card "Dominio Teórico" tiene aire de sobra y el texto se trunca a una sola línea innecesariamente.
3. **Badge "DETERIORADO" descolgado a la derecha** sin label que diga qué representa. Visto solo, parece basura visual flotando.

Sus palabras textuales: *"Esto se ve muy desproporcionado hay mucho espacio vacío se siente mal diseñado. Seguimos con el fenómeno de las últimas letras incompletas o cortadas en los títulos. El sitio se debe ver premium en todo su sentido y un diseño así se ve de principiante de niño de colegio. corrige"*.

## Diagnóstico

### Problema 1 — Huecos en la columna derecha

`BioDashboard.tsx` línea 286:

```tsx
<div className="lg:col-span-7 flex flex-col gap-8 h-full justify-between">
```

`h-full` hace que la columna derecha tenga la misma altura que la columna izquierda. La izquierda es alta (círculo IMR 240px + grid de 3 stats + grid de 3 stats de composición). La derecha tiene 3 cards más bajas. `justify-between` reparte el espacio sobrante entre las cards — resultado: huecos gigantes para "llenar" el alto de la izquierda.

### Problema 2 — Título del módulo truncado

`BioDashboard.tsx` línea 346:

```tsx
<span className="text-gray-300 text-xs font-bold uppercase tracking-widest max-w-[200px] truncate">{quiz.articleId.replace(/-/g, ' ')}</span>
```

`max-w-[200px] truncate` corta el texto a una sola línea cuando excede los 200px y le mete `text-overflow: ellipsis`. Para títulos cortos funciona; para "El código de la obesidad: por qué tu cuerpo te devuelve los kilos" produce el "OBESIDA..." que Carlos vio. Y el contenedor de la card tiene aire de sobra — la limitación es innecesaria.

### Problema 3 — Badge "DETERIORADO" descolgado

`BioDashboard.tsx` línea 206:

```tsx
<div className="flex flex-col md:flex-row md:items-end justify-between ...">
```

`md:items-end` alinea los hijos al borde inferior. El `<h1>` "Hola, Charlie" es alto (text-6xl); el badge "DETERIORADO" es chico. Con `items-end`, el badge queda hundido en el borde inferior derecho, separado verticalmente del título por toda la altura del h1. Y el badge no tenía label — solo decía "DETERIORADO" sin contexto de qué significa.

## Solución

### Fix 1 — Columna derecha sin estirarse

```diff
- <div className="lg:col-span-7 flex flex-col gap-8 h-full justify-between">
+ <div className="lg:col-span-7 flex flex-col gap-6">
```

Sin `h-full` (no se estira para igualar la izquierda) ni `justify-between` (no reparte espacio entre cards). Las 3 cards quedan apiladas con gap consistente de 24px. La columna derecha es naturalmente más corta que la izquierda — pero como el grid padre tiene `items-start`, ambas columnas se alinean por arriba y la asimetría no se nota.

### Fix 2 — Título del módulo en 2 líneas máximo

```diff
- <span className="text-gray-300 text-xs font-bold uppercase tracking-widest max-w-[200px] truncate">{quiz.articleId.replace(/-/g, ' ')}</span>
+ <span className="text-gray-300 text-xs font-bold uppercase tracking-wider leading-snug line-clamp-2 break-words">{quiz.articleId.replace(/-/g, ' ')}</span>
```

`line-clamp-2` permite hasta 2 líneas (suficiente para títulos largos del estilo "El código de la obesidad"). `break-words` permite cortar entre palabras si el contenedor es muy estrecho. Quitamos el `max-w-[200px]` artificial — el contenedor padre (`flex flex-col min-w-0 flex-1`) ya limita el ancho con base en su contenedor real.

También cambié el `flex flex-col` del padre a `flex flex-col min-w-0 flex-1` para que el shrink funcione correctamente.

### Fix 3 — Badge con label + alineación al centro

```diff
- <div className="flex flex-col md:flex-row md:items-end justify-between ...">
+ <div className="flex flex-col md:flex-row md:items-center justify-between ...">
```

```diff
- <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
-     <span className="w-2 h-2 rounded-full bg-[#00C49A] animate-pulse"></span>
-     <span className="text-[10px] font-black text-white uppercase tracking-widest">{stats.zona}</span>
- </div>
+ <div className="bg-white/5 px-5 py-3 rounded-2xl border border-white/10 flex items-center gap-3 shrink-0 self-start md:self-center">
+     <span className="w-2 h-2 rounded-full bg-[#00C49A] animate-pulse shrink-0"></span>
+     <div className="flex flex-col leading-none gap-1">
+         <span className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.3em]">Estado</span>
+         <span className="text-[11px] font-black text-white uppercase tracking-widest">{stats.zona}</span>
+     </div>
+ </div>
```

`items-center` alinea el badge al centro vertical del título. Agregamos label "Estado" arriba del valor para que el badge tenga contexto inmediato (antes solo decía "DETERIORADO" suelto; ahora dice "Estado: DETERIORADO"). El `self-start md:self-center` mantiene el badge alineado a la izquierda en mobile (donde flex-col lo apila debajo del título) y centrado en desktop.

### Fix bonus — Descender del h1 italic

```diff
- <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white italic uppercase tracking-tight leading-none break-words">
+ <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white italic uppercase tracking-tight leading-tight break-words pb-1">
```

`leading-none` con `italic` puede recortar los descender de letras como J/Q/g/y en algunas fonts. `leading-tight` da un mínimo de aire para que la letra final no se vea cortada. `pb-1` de seguridad. Esto previene la recurrencia del "fenómeno de letras cortadas" que Carlos mencionó (ver SPEC-061 para el mismo patrón en el título del quiz IMR).

## Criterios de aceptación

- [x] Columna derecha sin `h-full` ni `justify-between`. Cards con `gap-6` consistente.
- [x] Título del pilar evaluado con `line-clamp-2 break-words` en lugar de `truncate`.
- [x] Badge de estado con label "Estado" arriba del valor.
- [x] Badge alineado con `items-center` en desktop (no descolgado al final).
- [x] H1 con `leading-tight` y `pb-1` para preservar descender de letras italic.
- [ ] Post-deploy: dashboard se ve compacto, sin huecos verticales en la columna derecha.
- [ ] Post-deploy: "El código de la obesidad..." se ve completo (en 2 líneas si hace falta).
- [ ] Post-deploy: badge "Estado: Deteriorado" alineado al título, con label visible.

## Riesgos y trade-offs

- **Columna derecha más corta que la izquierda:** en pantallas wide, la asimetría visual existe (la columna izquierda termina más abajo que la derecha). Acepto el trade-off porque:
  - El grid padre tiene `items-start` — ambas columnas se alinean por arriba, no hay vacío arriba.
  - El espacio "sobrante" debajo de la columna derecha es área visual de respiración, NO huecos entre cards. Diferencia clave de UX.
  - Forzar igualdad de altura volvería al problema original (huecos artificiales entre cards).
- **`line-clamp-2` puede cortar títulos muy largos (>2 líneas):** improbable porque los títulos de artículos del nuevo prompt tienen 60-80 caracteres. Si en el futuro hay títulos extremadamente largos, agregaríamos un tooltip con el título completo. Por ahora, line-clamp-2 cubre 99% de los casos sin truncate visible.
- **`leading-tight` + `pb-1` añade ~6px al header:** despreciable, casi imperceptible. Previene el recorte de descender.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivo modificado:**
- `metamorfosis-web/src/components/BioDashboard.tsx` — 4 cambios puntuales:
  1. Header `items-center` + h1 con `leading-tight pb-1`.
  2. Badge con label "Estado" + estructura interna en columna.
  3. Columna derecha sin `h-full justify-between`.
  4. Título de pilar evaluado con `line-clamp-2 break-words` en lugar de `truncate max-w-[200px]`.

**Decisiones:**
- Líneas-clamp-2 en lugar de tooltip: la card tiene espacio suficiente para mostrarlo completo, no se necesita interacción hover para leer el título.
- Label "Estado" en lugar de mover el badge a otro lugar: mantiene la estructura del header (título a la izquierda, dato a la derecha) que es estándar en dashboards SaaS premium.
- Quitar `h-full` en lugar de estirar las cards individuales: forzar altura uniforme entre cards de naturaleza distinta (texto compacto vs lista de quizzes) habría hecho que la card "Elena App" se viera vacía con padding excesivo.

Sin desviaciones del plan.
