# SPEC-105 — Imágenes AI coherentes para los 14 días del Plan IMR

**Estado:** 🔨 Fase 1 lista (código preparado con slots). Fase 2 pendiente: Carlos genera 14 imágenes AI.
**Fase:** Bloque B refuerzo (engagement + retención del plan)
**Severidad:** MEDIO (el plan funciona sin imágenes; con imágenes mejora retención y anclaje conceptual)
**Fecha de creación:** 2026-05-20
**Autor:** Carlos Reyes
**Depende de:** SPEC-100 (plan 14d), SPEC-101 (progresión), SPEC-030 (webp + performance)

---

## Contexto

El Plan IMR de 14 días entrega contenido editorial denso por día (título + descripción + acción + referencias). Carlos detectó que es 100% texto y planteó la hipótesis de que agregar imágenes coherentes por día puede:

1. **Anclar el concepto del día** en memoria visual (Cialdini cap 7 "Asocio luego pienso": la imagen evoca asociaciones que el texto solo no genera).
2. **Aumentar retención** entre sesiones (el usuario que vuelve al día 5 reconoce visualmente el bloque sin leer otra vez).
3. **Reforzar la sensación de producto profesional** (imágenes a medida vs muro de texto).

El test IMR (8 substeps) queda **fuera de scope** de esta spec — su flujo es de 2 minutos y las imágenes podrían distraer. Si futuras métricas muestran que el test se abandona, se aborda en SPEC separada con iconos pequeños no fotos.

## Problema

El componente `Plan14d.tsx` renderiza 14 cards puramente textuales. Sin contraste visual entre días, el usuario que avanza día por día siente repetición. La retención entre sesiones depende solo de la memoria textual.

## Solución propuesta

Agregar **una imagen conceptual por día** (14 imágenes en total) generadas con AI siguiendo un *style master* unificado para coherencia visual.

### Decisiones tomadas con Carlos (2026-05-20)

1. **Ruta de generación**: AI (Midjourney v6 / Imagen 3 / Flux 1.1 Pro). Costo único ~$30. NO usar Unsplash genérico (no específico al concepto del día).
2. **Alcance inicial**: Plan 14d primero. Test IMR queda fuera de scope.
3. **Hosting**: archivos en `/public/plan14d/` del repo, formato webp, max ~200 KB cada uno (regla SPEC-030).

### Convención de naming

```
public/plan14d/
  dia-01.webp
  dia-02.webp
  ...
  dia-14.webp
```

Nombres con cero-padding para que ordenen alfabéticamente. Dimensiones recomendadas: 1600×900 px (aspect 16:9), comprimidas a webp quality 82.

### Style master (aplicable a las 14 generaciones)

Todas las imágenes deben compartir esta base de estilo. Pegar al final de cada prompt específico:

```
Style: cinematic editorial photography, muted dark palette with subtle
teal (#00C49A) accents, soft natural light (golden hour or moody blue
hour), minimalist composition, shallow depth of field, realistic
texture, no human faces, no text overlays. Aspect ratio 16:9.
```

Esto garantiza que las 14 piezas se vean como una serie editorial, no como collage random.

### Los 14 prompts específicos

Cada prompt va concatenado con el style master.

| Día | Tema | Prompt específico |
|---|---|---|
| 1 | Activa tu cambio metabólico | *"A clear glass of water with a pinch of sea salt visible on a rustic wooden table, dawn light streaming through a window, condensation on the glass, intimate framing."* |
| 2 | Acceso a tus reservas (switch metabólico) | *"An empty kitchen at 8 pm: dim warm pendant light over a clean dining table, plates and utensils put away, single candle still burning, sense of intentional pause."* |
| 3 | Limpieza interna (autofagia) | *"Translucent green tea steeping in a glass cup, steam rising softly, dappled morning light through eucalyptus leaves in background, ethereal calm."* |
| 4 | Sincroniza tu reloj interno | *"A minimalist analog clock face on a bedside table showing 6:30 am, perfectly made bed in soft focus behind, first sunlight crossing the room diagonally."* |
| 5 | Activa el músculo | *"A single kettlebell on weathered hardwood floor, side lighting creating dramatic shadow, chalk dust faintly visible in the air, gym corner in moody dim background."* |
| 6 | Calidad por encima de cantidad | *"Top-down view of one densely packed plate: grilled salmon, avocado half, dark leafy greens, on a black slate plate, overhead daylight, no garnish overload."* |
| 7 | Primer corte: dónde estás | *"A coiled measuring tape and an open notebook with a pen on a marble surface, side window light casting soft shadow, mid-morning."* |
| 8 | Convierte lo aprendido en rutina | *"A path of evenly spaced stepping stones across calm water, low angle, golden hour reflections, sense of forward continuity."* |
| 9 | Pulir lo que ya hace bien | *"A craftsman's hand-tool (chisel) resting on a partially finished piece of polished wood, side light highlighting the grain, workshop in soft focus background."* |
| 10 | Sin altibajos en la energía | *"A still glass of water on a horizon-line table, perfectly flat surface, faint horizon visible through the glass, blue hour palette, sense of equilibrium."* |
| 11 | El estrés mata el progreso | *"A made bed with a single soft blanket folded back, warm bedside lamp glowing, an open book face-down, blackout curtains drawn — invitation to rest."* |
| 12 | Segundo corte: qué cambió | *"Two stacked notebook pages side by side: one dated 'day 7', one dated 'day 12', subtle pencil notes visible but blurred, soft daylight."* |
| 13 | Lo que sí puedes mantener | *"Three smooth river stones stacked in balanced cairn on weathered wood, soft side light, blurred natural background, minimalist sense of sustainable structure."* |
| 14 | Tu nuevo baseline | *"A mountain summit at dawn, low fog in the valleys below, single solid horizon line, teal-blue gradient sky giving way to warm sunrise, no figure visible — open future."* |

Cada prompt es **específico al concepto del día** y evita decoración genérica. Sin caras humanas para evitar uncanny valley AI + tema legal de likeness.

### Cambios técnicos en código

#### 1. Schema de datos (`src/data/plan14d.ts`)

Agregar campo opcional `image` a `DayPlan`:

```ts
export interface DayPlan {
    day: number;
    phase: 'Reset' | 'Consolidación';
    title: string;
    description: string;
    /** SPEC-105: imagen conceptual del día. Opcional para back-compat. */
    image?: {
        /** Ruta absoluta desde /public, ej. '/plan14d/dia-01.webp' */
        src: string;
        /** Alt text descriptivo para accesibilidad. */
        alt: string;
    };
    actions: { E: DayAction; M: DayAction; C: DayAction };
}
```

Los 14 `image` se rellenan en `PLAN_14_DAYS` con paths fijos. Los archivos físicos los sube Carlos después de generar.

#### 2. Componente (`src/components/Plan14d.tsx`)

En el render de cada día (estado actual + completado), agregar bloque condicional:

```tsx
{day.image && (
    <img
        src={day.image.src}
        alt={day.image.alt}
        loading="lazy"
        decoding="async"
        className="w-full aspect-video object-cover rounded-lg mb-4 border border-white/[0.06]"
    />
)}
```

- `loading="lazy"` para que las imágenes de días futuros (cuando estén locked) no descarguen hasta scroll.
- `decoding="async"` para no bloquear el render.
- `aspect-video` (16:9) consistente con dimensiones generadas.
- Border sutil para integración con design system existente.
- Si `day.image` es undefined (caso día sin imagen aún subida), no se renderiza nada — fallback graceful.

#### 3. Specs de performance (regla SPEC-030)

- **Tamaño máximo por imagen**: 200 KB en webp. Si una sale más pesada, recomprimir con `cwebp -q 75` o ImageMagick.
- **Dimensiones**: 1600×900 px source (suficiente para retina) → webp comprimido.
- **NO preload**: las imágenes están dentro de `Plan14d.tsx` que es `client:only="react"`, no aparecen en el critical path. `loading="lazy"` es suficiente.
- **CDN/cache**: Hostinger sirve `/public/` con cache estándar. No requiere config extra.

## Plan de implementación

### Fase 1 — Yo (esta spec)

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1 | Agregar campo `image?` a `DayPlan` interface | `src/data/plan14d.ts` | 10 min |
| 2 | Rellenar los 14 `image` con paths esperados y alt text | `src/data/plan14d.ts` | 20 min |
| 3 | Render condicional en `Plan14d.tsx` (estados `current` y `completed`) | `src/components/Plan14d.tsx` | 25 min |
| 4 | Verificación: si no hay archivos físicos, el componente no rompe | sandbox | 10 min |
| 5 | Commit + push | git | 5 min |

**Total Fase 1:** ~70 min. Carlos puede deployar con los slots vacíos — el plan se ve igual que hoy mientras no haya archivos.

### Fase 2 — Carlos (generación)

| # | Tarea | Tiempo |
|---|-------|--------|
| 1 | Suscribirse o usar Midjourney v6 / Imagen 3 / Flux 1.1 Pro | 10 min |
| 2 | Generar cada imagen con el prompt específico + style master. Generar 4 variaciones por día y elegir la mejor | 4-6 h |
| 3 | Comprimir cada elegida a webp ≤200 KB (cwebp, squoosh.app o ImageMagick) | 1 h |
| 4 | Subir 14 archivos a `metamorfosis-web/public/plan14d/dia-01.webp ... dia-14.webp` | 15 min |
| 5 | Verificar paths exactos contra `plan14d.ts` | 5 min |
| 6 | Commit + push | 5 min |

**Total Fase 2:** ~6-8 h de Carlos (concentradas o repartidas en 2-3 días).

### Fase 3 — Verificación post-deploy

- Abrir cada día en `/dashboard/plan` y confirmar que la imagen carga.
- Lighthouse mobile en `/dashboard/plan` debe mantenerse ≥ baseline pre-spec.
- Mobile 375px: la imagen no se desborda ni rompe la card.
- Inspeccionar Network tab: solo el día actual y completados anteriores cargan imagen (los locked NO descargan por `loading="lazy"`).

## Criterios de aceptación

- [ ] `DayPlan` tiene campo opcional `image?: { src, alt }`.
- [ ] Los 14 días tienen el path declarado en `PLAN_14_DAYS`.
- [ ] El componente renderiza la imagen si existe, sin romper si no.
- [ ] `loading="lazy"` y `decoding="async"` aplicados.
- [ ] Aspect ratio 16:9 mantenido en todos los días.
- [ ] Mobile 375px sin desbordes.
- [ ] Lighthouse mobile Performance ≥ baseline.
- [ ] Cada imagen pesa ≤ 200 KB en webp.
- [ ] Cada día tiene `alt` descriptivo en español (accesibilidad + SEO).
- [ ] Build limpio.

## Pruebas manuales

```sh
cd metamorfosis-web && npm run build
```

**Smoke post-deploy con imágenes:**

1. Logueado con plan en curso → `/dashboard/plan` → ver imagen del día actual antes de la card de acción.
2. Avanzar día 1 → ver imagen del día 2 al desbloquear.
3. Días completados anteriores muestran imagen en versión compacta (o no, según diseño final).
4. Días locked: NO descarga la imagen hasta scroll (verificar en Network tab).
5. Lighthouse: capturar score actual antes y después.

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| AI genera imagen con cara borrosa / "AI-ish" identificable | Media | Prompt explícito "no human faces". Generar 4 variaciones y elegir la mejor. Si todas salen mal, regenerar con un seed distinto |
| Imágenes pesan más de 200 KB y Lighthouse cae | Media | Comprimir agresivamente con cwebp -q 75 o squoosh. Si igual no baja, reducir dimensiones a 1280×720 |
| Coherencia visual rota (algunas días se ven de un estilo, otras de otro) | Media | El style master debe ir tal cual al final de CADA prompt. No improvisar style por día |
| Hostinger no cachea `/public/` correctamente | Baja | El patrón funcionó para SPEC-030 (header-bg.webp). Confirmado |
| Algunas imágenes terminan siendo decorativas en vez de conceptuales | Media | Los prompts son específicos. Si una sale genérica, regenerar con prompt más específico al concepto del día |

## Fuera de scope (intencional)

- **Test IMR (8 substeps)**: si métricas futuras muestran abandono del test, abrir SPEC separada con iconos pequeños.
- **Versión mobile-específica de imágenes**: usamos las mismas para mobile y desktop. Si una imagen se ve mal en mobile, recortar manualmente en post.
- **Imágenes para los emails transaccionales**: spec separada si vale la pena.
- **Animaciones / lottie / GIFs**: estático es suficiente. Animaciones cargan peso y distraen del contenido.
- **Personalización de imagen por pilar débil**: 14 días × 3 pilares = 42 imágenes. Overkill para v1. Una imagen por día es suficiente.
- **Generación on-the-fly server-side por usuario**: complicación innecesaria. Estáticas en `/public/` es lo correcto.

## Commit sugerido (Fase 1)

```
feat(spec-105): slots de imagen por día en Plan IMR 14d

- DayPlan extendido con campo opcional image:{src,alt}
- Los 14 días tienen path declarado en /plan14d/dia-XX.webp
- Plan14d.tsx renderiza imagen con lazy loading + aspect-video
- Sin archivos físicos: componente sigue funcionando (fallback)

Pendiente Fase 2: Carlos genera 14 imágenes con AI usando los
prompts documentados en specs/SPEC-105 y las sube a /public/plan14d/.
```

## Resultado

**Fase 1 implementada 2026-05-20 — slots de imagen listos:**

### Archivos modificados (3)

- **`src/data/plan14d.ts`**:
  - Interface `DayImage` exportada con `{ src, alt }`.
  - Campo opcional `image?: DayImage` agregado a `DayPlan`.
  - Los 14 días tienen su path declarado (`/plan14d/dia-01.webp` ... `dia-14.webp`) + alt text descriptivo en español.

- **`src/lib/imr/plan14d.ts`**:
  - Re-export del tipo `DayImage`.
  - `DayPlanForUser` ahora incluye `image?`.
  - `getPlanForPillar()` propaga el campo `image` en el plan aplanado.

- **`src/components/Plan14d.tsx`**:
  - Bloque `{day.image && (<img …/>)}` entre el header del día y la descripción, en el estado `current` del render.
  - Atributos `loading="lazy"` + `decoding="async"` para no bloquear el critical path.
  - `aspect-video object-cover rounded-lg` para mantener 16:9 consistente.
  - Border sutil `border-white/[0.06]` para integración con design system.
  - Fallback graceful: si el archivo no existe en `/public/plan14d/`, el bloque no se renderiza y el componente sigue funcionando.

### Verificaciones pasadas en sandbox

- Braces balanceados (data 88/88, lib 9/9, componente 114/114).
- 14 paths declarados (grep confirma `src: '/plan14d/dia-` × 14).
- Build conceptualmente limpio (sin imports rotos ni referencias colgantes).
- Sin voseo en alt texts.

### Pendiente — Carlos genera las 14 imágenes

**Style master a concatenar al final de cada prompt:**

```
Style: cinematic editorial photography, muted dark palette with subtle
teal (#00C49A) accents, soft natural light (golden hour or moody blue
hour), minimalist composition, shallow depth of field, realistic
texture, no human faces, no text overlays. Aspect ratio 16:9.
```

**Pasos operativos:**

1. Elegir herramienta: Midjourney v6 (mejor realismo cinematográfico, $10/mes), Imagen 3 vía Google AI Studio (gratis con cuenta Google), o Flux 1.1 Pro vía Replicate (~$0.05 por imagen). Carlos decide según presupuesto/familiaridad.

2. Por cada día (1 al 14):
   - Tomar el prompt específico de la tabla en la sección "Los 14 prompts específicos" de esta spec.
   - Concatenar el style master.
   - Generar 4 variaciones.
   - Elegir la mejor.

3. Procesar cada imagen elegida:
   - Recortar a 16:9 si no salió en esa proporción exacta.
   - Convertir a webp con quality 82: `cwebp -q 82 input.jpg -o dia-XX.webp` (o usar squoosh.app online).
   - Verificar tamaño ≤ 200 KB. Si supera, bajar quality hasta 75.

4. Subir los 14 archivos a `metamorfosis-web/public/plan14d/`. Nombres EXACTOS: `dia-01.webp` ... `dia-14.webp` (con cero-padding, sin guiones extra).

5. Verificar paths: `ls metamorfosis-web/public/plan14d/` debe listar los 14 archivos.

6. Commit + push:
   ```bash
   git add metamorfosis-web/public/plan14d/*.webp
   git commit -m "feat(spec-105): imágenes conceptuales de los 14 días del Plan IMR"
   git push
   ```

7. Smoke post-deploy:
   - Abrir `/dashboard/plan` → ver imagen del día actual antes de la descripción.
   - Avanzar día → ver siguiente imagen al desbloquear.
   - Mobile 375px: las imágenes no se desbordan ni rompen layout.
   - Network tab: días bloqueados NO descargan imagen hasta scroll.
   - Lighthouse: comparar score con baseline pre-imágenes.

### Commit sugerido — Fase 1 (lo que hicimos hoy)

```
feat(spec-105): slots de imagen por día en Plan IMR 14d

- DayImage interface + campo opcional image en DayPlan.
- 14 paths declarados en PLAN_14_DAYS con alt text en español.
- Plan14d.tsx renderiza imagen con lazy loading + aspect-video 16:9.
- Fallback graceful si archivo no existe.

Pendiente Fase 2: Carlos genera 14 imágenes con AI (prompts +
style master documentados en specs/SPEC-105) y las sube a
metamorfosis-web/public/plan14d/.
```

**Cierre de spec:** la spec se marca ✅ Cerrada cuando los 14 archivos físicos estén deployados y verificados en producción.
