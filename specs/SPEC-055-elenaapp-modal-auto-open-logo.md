# SPEC-055 — ElenaApp modal auto-open + logo branded

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — captación
**Severidad:** ALTO (conversion al funnel ElenaApp)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-048 (modal CTA), SPEC-049 (portal centrado)

---

## Contexto

Tres cambios al `ElenaAppCTA`:

### Cambio 1: imagen del modal

El modal mostraba `/elena-mockup.webp` (foto del teléfono con UI mockup,
64 KB). El logo real branded de Elena (DNA verde + texto "ELENA") es más
reconocible y simbólico — comunica la identidad sin necesidad de mostrar
una UI placeholder que aún no existe en prod.

### Cambio 2: auto-open al entrar al sitio

Hoy el modal solo abre si el user clickea el botón "ElenaApp Early" del
navbar. Conversión a la waitlist depende de que el user explore el sitio
y NOTE el botón. Para subir conversion, queremos que el modal aparezca
automáticamente cuando un user nuevo entra a la home — pero **sin ser
intrusivo**: respetar a quien ya está logueado, a quien ya descartó el
popup, y a quien navegó a páginas internas.

## Solución

### Imagen

Logo `/elena-logo.webp` (512×512, 23.5 KB webp) reemplaza al mockup.
Generado del PNG fuente 640×640 (42 KB) que Carlos subió a `/public/`:

- Resize 640 → 512 (cubre retina 3x para display de 160px).
- WebP quality 88, method 6.
- `drop-shadow` ajustado de azul a verde (`rgba(0,196,154,0.45)`) para
  matchear el glow del logo.
- `loading="eager"` (era `lazy`): cuando el modal se auto-abre, no
  queremos que la imagen aparezca después de fade-in.

### Auto-open (Opción A aprobada por Carlos)

| Condición | Comportamiento |
|---|---|
| Path actual | Solo abre en `/` (home) |
| Delay | 3 segundos después de mount (deja ver el hero) |
| User logueado | NO abre (ya está en el ecosistema) |
| User descartó antes (`localStorage.elenaapp_cta_dismissed = '1'`) | NO abre |
| Dos instancias del componente (desktop + mobile menu) | Sentinel `sessionStorage.elenaapp_cta_auto_opened_session` impide doble modal |

Cuando el user **cierra el modal** (ESC, ✕, click-outside), se marca
`localStorage.elenaapp_cta_dismissed = '1'` → nunca vuelve a auto-abrir.
Si después clickea el botón del navbar, sí abre (acción intencional).
Si lo cierra otra vez, marca dismissed igual (idempotent).

### Cambio 3: copy del título del modal en 2 líneas

El título original era `Sé de los primeros 1000` en una sola línea con
`text-2xl sm:text-3xl tracking-tighter font-black`. En viewports angostos
(iPhone SE, modal con padding) el número de 4 chars con tracking apretado
se cortaba — el `0` final salía del container.

Solución: dos líneas con jerarquía clara.

| Línea | Tamaño | Color | Texto |
|---|---|---|---|
| 1 | `text-3xl sm:text-4xl` font-black italic | blanco | **"Sé fundador"** |
| 2 | `text-sm sm:text-base` font-bold tracking-wide | gradient azul→teal | "Uno de los primeros 1000" |

Beneficios:
- **"Sé fundador"** (11 chars) cabe en cualquier viewport sin tracking apretado.
- Posiciona al user como protagonista activo.
- La segunda línea **"Uno de los primeros 1000"** preserva el sentido de
  escasez con el número y refuerza la identidad de pertenencia.
- Consistencia cross-canal: email dice "Eres fundador #N", badge dashboard
  dice "Eres fundador #42 de los primeros 1000". Ahora el modal dice "Sé
  fundador / Uno de los primeros 1000" — mismo lenguaje en todos los puntos.

### Persistencia: localStorage vs sessionStorage

- **`localStorage`** para el dismissed flag: sobrevive cierres del browser.
  Si descartó hace una semana, no le mostramos el popup de nuevo hoy.
- **`sessionStorage`** para el race-condition sentinel: dura solo la
  sesión; en la siguiente visita, ambas instancias pueden volver a
  intentar (pero el dismissed flag igual gana).

## Plan de ejecución

1. Optimizar logo: `elena-logo-source.png` 640×640 → `elena-logo.webp` 512×512 (23.5 KB).
2. Editar `ElenaAppCTA.tsx`:
   - `src="/elena-mockup.webp"` → `src="/elena-logo.webp"` con drop-shadow verde.
   - Agregar `authReady` state al `onAuthStateChanged` callback.
   - Agregar `useEffect` de auto-open con todos los guards.
   - Constante `DISMISSED_KEY` (localStorage) y `AUTO_OPENED_KEY` (sessionStorage).
   - Función `dismissAndClose()` reemplaza `setOpen(false)` en los 3 handlers de cierre (ESC, click-outside, botón ✕).
3. Build local + commit + push.

## Criterios de aceptación

- [x] `/public/elena-logo.webp` existe, 512×512, <30 KB.
- [x] Modal usa `/elena-logo.webp` (no `/elena-mockup.webp`).
- [x] Auto-open dispara solo en `/`, después de 3s, si no logueado y no descartado.
- [x] Sentinel sessionStorage previene doble modal cuando hay 2 instancias.
- [x] Cualquier cierre (ESC/✕/backdrop) persiste dismissed.
- [x] Botón del navbar sigue abriendo manualmente (independiente del dismissed).
- [ ] Post-deploy: en incógnito, visitar home y esperar 3s → modal abre. Cerrar → recargar home → no abre.
- [ ] Visitar `/biblioteca` desde la home dismissed → no abre. Volver a `/` → no abre.
- [ ] Logueado: visitar `/` → modal NO abre nunca (verificación visual).

## Pruebas manuales

Para resetear el dismissed en dev/staging:
```javascript
// En la consola del browser
localStorage.removeItem('elenaapp_cta_dismissed');
sessionStorage.removeItem('elenaapp_cta_auto_opened_session');
```

Después recargar `/` y esperar 3s.

## Riesgos y trade-offs

- **3s puede ser molesto si el user está leyendo el hero**: aceptable
  porque el modal aparece con animación slide-in-from-bottom y no
  oscurece todo de golpe. Y el user puede cerrarlo con ESC inmediato.
- **`client:idle` retrasa la hidratación**: en mobile lento, la
  hidratación tarda ~1-2s extra → delay efectivo de auto-open puede ser
  4-5s. Aceptable, sigue siendo razonable y deja ver el hero.
- **localStorage no disponible (private mode)**: el componente no auto-abre
  silenciosamente. Trade-off correcto: prefiero no abrir que rompar UX.
- **User cambia de browser / borra cookies**: vuelve a ver el popup. Esperado.
- **No A/B testing del timing**: 3s fue elegido a ojo. Si la métrica de
  conversión queda baja, ajustar a 5s o 10s en otra spec.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos tocados:**
- `metamorfosis-web/public/elena-logo.webp` — NEW, 512×512, 23.5 KB.
- `metamorfosis-web/public/elena-logo-source.png` — opcional, source original; puede borrarse del repo si se quiere ahorrar bytes.
- `metamorfosis-web/src/components/ElenaAppCTA.tsx`:
  - `<img src>` cambiado + drop-shadow ajustada.
  - `useEffect` de auto-open agregado con guards.
  - `dismissAndClose()` helper que persiste dismissed.
  - 3 reemplazos de `setOpen(false)` → `dismissAndClose()` en handlers de cierre.
  - `authReady` state para esperar a que Firebase resuelva auth antes de decidir auto-open.

**Decisiones:**
- 3s delay (no inmediato ni 5s): da tiempo a ver el hero sin perder al
  user que rebota rápido.
- `dismissAndClose()` aplica también cuando se cierra modal abierto manualmente.
  Simplifica la lógica; el user puede reabrir via botón del navbar siempre.
- `loading="eager"` en el `<img>` del logo: el modal auto-abre con un slide-in,
  no queremos que la imagen llegue tarde.
- NO trackeo del origen "auto-open vs manual" en el dismissed flag.
  Mantiene el comportamiento simple y predecible.

**Pendientes:**
- Borrar `elena-logo-source.png` del repo (es solo el source, 42 KB).
- Trackear con Umami el "modal auto-opened" y "modal dismissed" para
  medir conversion rate del auto-open vs trigger manual del navbar.

Sin desviaciones del plan.
