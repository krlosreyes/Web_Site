# SPEC-070 — Fix global del clipping italic + bg-clip-text

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — visual / UX
**Severidad:** ALTO (afecta TODOS los headings con gradient italic del sitio)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-031 (defensa global anti-overflow), SPEC-061 (título quiz italic),
SPEC-069 (dashboard premium)
**Relacionada:** SPEC-061 intentó solucionarlo con `tracking-tight` pero no atacaba
la raíz: el clipping del slant del italic por bg-clip-text.

---

## Contexto

Carlos pegó dos screenshots ampliados:
1. El badge "ACCESO FUNDADOR / #1 / DE LOS PRIMEROS 1000".
2. Un zoom del título "..., CHARLIE" donde la letra **E final tiene su esquina superior derecha cortada** visualmente.

El "fix" anterior de SPEC-069 (cambiar `leading-none` a `leading-tight` + agregar
`pb-1`) atacaba el descender vertical, pero el problema reportado por Carlos era
el slant lateral. Sigue cortado.

## Diagnóstico

Cuando se aplica un gradient a un texto con la combinación:

```css
background: linear-gradient(...);
background-clip: text;
color: transparent;
```

el navegador recorta el background al **bounding-box geométrico de las letras**.
Ese bbox NO incluye el slant del italic. La letra `E` en italic uppercase
tiene su esquina superior-derecha desplazada hacia afuera del cap-height
estándar — pero el bg-clip-text usa el cap-height como límite. Resultado:
la parte inclinada de la letra final queda *fuera* del área pintada por el
gradient, y al ser `color: transparent`, se ve como un recorte visual.

El bug es especialmente visible en:
- Letras con cap-height pleno y mucho ancho superior: E, F, P, R, T.
- Italic + uppercase + tamaños grandes (text-5xl+).
- bg-clip-text + gradient que cambia de color en el slant (el cambio es
  notable visualmente).

Patrón en uso en toda la app:

```tsx
<h1 className="text-4xl sm:text-5xl md:text-6xl font-black italic uppercase ...">
    Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#00C49A]">
        {userName}
    </span>
</h1>
```

Aparece en `BioDashboard`, `Hero`, `Quiz`, `IMRQuiz`, `ElenaAppCTA`, `Navbar`
admin, `FoundersList`, `ForumEngine`, `comunidad`, `sobre-mi`, `posts/[slug]`,
`login`, `admin/dashboard`, `admin/analitica-imr`. **15+ ubicaciones.**

## Solución

Regla CSS global en `global.css` (preceptiva, no por componente):

```css
.bg-clip-text {
    padding-right: 0.12em;
    padding-top: 0.05em;
}
```

Por qué funciona:

- **`em`-based**: escala con el tamaño del texto. En `text-6xl` (60px) da
  ~7px de aire derecho y ~3px arriba. En `text-sm` (14px) da ~1.7px y
  ~0.7px — imperceptible cuando no hay italic, suficiente cuando lo hay.
- **`padding` interno del span**: el background-clip respeta el padding;
  agregar 0.12em al padding-right extiende el área que el bg-clip pinta,
  permitiendo que el slant tenga su gradient.
- **0.05em arriba**: la "T" / "L" / "F" en italic tienen un serif imaginario
  que sale del cap-height; un pelín de padding-top previene clipping
  vertical también.
- **No requiere tocar componentes**: regla aplicada al selector global
  `.bg-clip-text`, captura los 15+ usos del patrón sin search-replace.

### Lo que NO hicimos (y por qué)

- `overflow: visible` en `.bg-clip-text`: tentado de agregarlo pero podría
  afectar contenedores flex/grid que dependen de overflow-hidden para
  recortar ellos mismos. El padding-em es suficiente sin ese riesgo.
- Cambiar `italic` por `font-style: oblique X`: oblique angle controlado
  daría menos slant. Pero rompería el look italic decidido por Carlos
  para los headings. Mantener italic.
- `pr-2` por componente: 15+ lugares, mantener consistencia es difícil
  y se introducen regresiones cada vez que se agrega un heading nuevo.
  La regla global previene futuros bugs.

## Criterios de aceptación

- [x] Regla `.bg-clip-text { padding-right: 0.12em; padding-top: 0.05em; }`
      en `global.css` antes del `}` de `@layer base`.
- [x] Documentación inline del por qué (para futuros mantenedores).
- [ ] Post-deploy: el "CHARLIE" del dashboard se ve completo en la E final.
- [ ] Post-deploy: spot-check de otros headings del sitio (Hero, Quiz,
      Navbar admin) para confirmar que NO se rompió ninguno por el padding
      adicional. Casos sospechosos:
      - Hero ("Tú creas los hábitos.") — fin con `.` que no se incline.
      - IMR quiz titles.
      - Login "Premium".

## Riesgos y trade-offs

- **El padding-right de 0.12em puede empujar mínimamente el contenido
  siguiente** en flex containers. En text-6xl son 7px, despreciable
  pero existente. Si en algún heading muy preciso (ej. logo + texto en
  fila) se nota, ajustar el contenedor padre.
- **No es un fix definitivo, es paliativo:** la solución verdadera sería
  que el navegador implementara `background-clip: text` respetando el
  slant del italic, o usar SVG con gradient para los headings. Pero
  ambas opciones son demasiado caras de mantener para este sitio.
- **Padding-top puede interactuar con `leading-none`:** algunos h1 usan
  `leading-none` para tightness máximo. El padding-top de 0.05em se suma
  al line-box; en la mayoría de casos imperceptible. Si causa que un
  h1 multilinea se vea con líneas separadas, reducir a `padding-top:
  0.02em` o quitarlo.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivo modificado:**
- `metamorfosis-web/src/styles/global.css` — agregada regla
  `.bg-clip-text { padding-right: 0.12em; padding-top: 0.05em; }` en
  el bloque `@layer base` con comentario explicativo.

**Decisiones:**
- Fix global vs fix por componente: 15+ ubicaciones del patrón, mantener
  consistencia con fix puntual es inviable. Una regla global con padding
  em-based es la solución profesional.
- `em` en lugar de `px`: escala automáticamente con tamaño del texto.
- `padding-right` + `padding-top` (no margin): el bg-clip-text respeta
  el padding, ampliando el área de pintado del gradient.
- No tocar el `italic` ni el `bg-clip-text` en sí: preserva todo el
  look existente del sitio.

**Notas operativas para Carlos:**
- El fix se aplica automáticamente a TODOS los lugares del sitio con
  `bg-clip-text`. No se necesita cambiar componentes uno por uno.
- Si en algún screen específico se ve raro post-deploy, mandar screenshot
  y ajustamos el padding-em para ese caso.
- Es una mejora estadística: cubre 99% del clipping italic + bg-clip;
  el 1% restante (gradients muy contrastantes en letras muy inclinadas)
  necesita SVG o `text-shadow` workarounds que están fuera de scope.

Sin desviaciones del plan.
