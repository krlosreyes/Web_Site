# SPEC-098 — Home: eliminar métricas inventadas del Hero

**Estado:** 🔨 En progreso (código listo, pendiente: env var en Hostinger + build local + commit + push)
**Fase:** Bloque A del plan estratégico 2026-05-19 (Limpieza y verdad)
**Severidad:** ALTA (riesgo de credibilidad + posible exposición regulatoria)
**Fecha de creación:** 2026-05-19
**Autor:** Carlos Reyes
**Depende de:** SPEC-053 (hero copy refresh — vigente, no se toca)

---

## Contexto

El Hero del home (`metamorfosis-web/src/components/Hero.astro`) exhibe en su
fila de stats (líneas 67-77) dos números sin respaldo:

- **"10K+ — Usuarios activos"** (línea 69-70)
- **"94% — Mejora metabólica"** (línea 74-75)

Ninguno corresponde a datos reales del producto. ElenaApp aún no tiene
users en producción (ver `CLAUDE.md` §1), y la web no ha publicado
metodología que sustente "94% de mejora metabólica". La cohorte fundadora
está abierta con cap 1000 y aún por debajo de esa cifra.

Estos números provienen del template de hero original y sobrevivieron al
refresh de copy de SPEC-053 porque esa spec atacaba el H1 y subtítulo, no
la fila de stats.

## Problema

Tres riesgos compuestos:

1. **Credibilidad** — cualquier visitante mínimamente experimentado
   identifica los números como infundados y descarta el resto del sitio
   (incluyendo el IMR y las referencias científicas reales).
2. **Regulatorio** — afirmar "94% de mejora metabólica" sin metodología
   publicada es claim de eficacia terapéutica. Riesgo de auditoría INVIMA
   o reclamo por publicidad engañosa.
3. **Disonancia con el resto del sitio** — SPEC-056 implementó cohorte
   fundadora con cap 1000 y badge "primeros N de 1000". El home dice
   "10K+ usuarios activos" mientras el dashboard del usuario dice
   "Eres fundador #N / 1000". Incongruencia visible.

## Solución propuesta (decisión Carlos 2026-05-19, refinada)

Reemplazar los dos tiles inventados por:

- **Tile 1 — Suscriptores YouTube reales** (link al canal,
  `target="_blank"`). Valor **hardcoded** en una constante del
  frontmatter (`YOUTUBE_SUBSCRIBERS`). Carlos actualiza esa línea
  cuando el canal crezca → commit + push → 90-120s de deploy.

  > **Refinamiento 2026-05-19:** la versión inicial proponía env var
  > `PUBLIC_YOUTUBE_SUBSCRIBERS` en Hostinger. Carlos prefirió
  > hardcoded por simplicidad operativa — sin pasos en Hostinger,
  > sin Restart manual, todo desde el editor.

- **Tile 2 — "BETA"** con copy "Cohorte 2026 activa". Sin
  número — statement honesto del estado del proyecto.
- **Tile 3 — IMR / Índice propio** (sin cambio, link a `/imr`).

Layout resultante:

```
┌──────────────────────────┬──────────────────────┬─────────────────────┐
│  N suscriptores en YT ↗  │  BETA PRIVADA        │  IMR                │
│  Canal de formación      │  Cohorte 2026 activa │  Índice propio  →   │
└──────────────────────────┴──────────────────────┴─────────────────────┘
```

Si `PUBLIC_YOUTUBE_SUBSCRIBERS` no está seteado:

```
┌──────────────────────┬─────────────────────┐
│  BETA PRIVADA        │  IMR                │
│  Cohorte 2026 activa │  Índice propio  →   │
└──────────────────────┴─────────────────────┘
```

URL del canal: `https://www.youtube.com/@Metamorfosisreal` (ya
hardcodeada en `Footer.astro:14` y `lib/email.ts:88`).

**Por qué env var en vez de hardcode en el código:** Carlos publica
video semanalmente y el conteo va a crecer. Una env var en Hostinger
permite actualizar el número sin commit + push + 90-120s de deploy.
Lectura runtime (no build-time) garantiza que el cambio en Hostinger
surte efecto inmediato (regla SPEC-028b).

**Por qué string libre y no número:** el formato "247", "1.2K" o "10K"
es decisión de presentación. Carlos elige el string que quiere mostrar.

## Plan

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1 | Definir constantes `YOUTUBE_SUBSCRIBERS` y `YOUTUBE_CHANNEL_URL` en frontmatter del Hero | `src/components/Hero.astro` | 5 min |
| 2 | Reemplazar tile 1 ("10K+ Usuarios activos") por tile YouTube linkeable | `src/components/Hero.astro` | 10 min |
| 3 | Reemplazar tile 2 ("94% Mejora metabólica") por tile "BETA / Cohorte 2026 activa" | `src/components/Hero.astro` | 5 min |
| 4 | Linkear tile 1 a `https://www.youtube.com/@Metamorfosisreal` con `target="_blank" rel="noopener"` y `data-umami-event="cta_youtube_hero"` | `src/components/Hero.astro` | 5 min |
| 5 | Eliminar `Hero.astro.bak` del repo | filesystem | 2 min |
| 6 | Verificación local: `npm run build` desde `metamorfosis-web/` | terminal | 5 min |
| 7 | Commit + push a `main` | git | 5 min |
| 8 | Verificación post-deploy (90-120s) | producción | 5 min |

**Esfuerzo total estimado:** ~45 min.

## Criterios de aceptación

- [ ] El home en producción NO muestra "10K+" ni "94%" en ningún lugar.
- [ ] Tile 1 muestra el valor de `YOUTUBE_SUBSCRIBERS` con label
      "Suscriptores en YouTube" y linkea al canal en nueva pestaña.
- [ ] Tile 2 muestra "BETA" / "Cohorte 2026 activa", sin número inventado.
- [ ] Tile 3 (IMR) se mantiene idéntico (link a `/imr`, copy y hover
      como antes).
- [ ] `Hero.astro.bak` eliminado del repo.
- [ ] `grep -r "10K+" metamorfosis-web/src/` y `grep -r "94%" metamorfosis-web/src/`
      retornan vacío (excepto comentarios explicando la remoción).
- [ ] Lighthouse mobile Performance no baja vs baseline (SPEC-030 dejó en 84).
- [ ] Build pasa sin errores: `npm run build` desde `metamorfosis-web/`.

## Pruebas manuales

1. Cargar el home en mobile (DevTools, 375px). Verificar que la fila de
   stats no se desborda con el copy nuevo.
2. Cargar el home en desktop. Verificar que los 3 tiles caben en una sola
   línea y el separador vertical entre ellos se mantiene.
3. Simular fallo del fetch del counter (apagar Firebase Admin
   temporalmente en dev): verificar que el layout no se rompe — debe
   mostrar fallback o eliminar el tile sin dejar hueco.
4. Verificar que el link "IMR → Índice propio" sigue funcionando como
   antes (hover, click → `/imr`).

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El read del counter agrega latencia al SSR del home (LCP) | Media | El counter es 1 doc Firestore; latencia esperada <50ms. Si supera 100ms, mover a `client:idle` y mostrar skeleton |
| Visitantes acostumbrados a la versión vieja notan el cambio negativo | Baja | El cambio elimina ruido, no agrega ruido. No requiere comunicación |
| El número real (N fundadores) es muy bajo aún y se ve menos impresionante que "10K+" | Alta | Es exactamente el punto de la spec. La honestidad construye foso defensible más sostenible que un número inventado. Si N es muy bajo, el copy "Beta privada activa" del tile 2 lo contextualiza |

## Fuera de scope (intencional)

- **NO se reescribe el H1 ni el subtítulo.** SPEC-053 ya estableció
  "Te damos las herramientas / Tú creas los hábitos." + "Vida solo hay
  una y todo cuenta." como decisión deliberada de Carlos. El análisis
  estratégico del 2026-05-19 sugirió que ese copy es "pasivo" y propone
  promesa de intervención activa. **Esa discusión se difiere a una spec
  futura (SPEC-099+) si Carlos decide retomarla** — no se mezcla con
  esta. Una spec, un problema.
- **NO se rediseña el output del quiz IMR.** Eso es Bloque B del plan
  estratégico, propia spec.
- **NO se agrega tropicalización LATAM al copy del home.** También Bloque
  B o C, propia spec.

## Commit

`fix(spec-098): eliminar métricas inventadas del Hero y reemplazar por contador real de fundadores`

Body sugerido:
```
- Hero.astro: elimina tiles "10K+ Usuarios activos" y "94% Mejora metabólica"
- Reemplaza por tile real basado en founderCount (SPEC-056)
- Mantiene tile IMR existente
- Elimina Hero.astro.bak con métricas inventadas residuales

Riesgo regulatorio (claim de eficacia "94%" sin metodología) y de credibilidad
mitigado. Foso defensible vía honestidad sustituye foso falso vía vanity number.
```

## Resultado

**Implementación 2026-05-19 — código aplicado:**

- `Hero.astro` actualizado:
  - Import de `Youtube` de lucide-astro (junto al `ArrowRight`
    existente). Patrón consistente con `Footer.astro:2`.
  - Frontmatter define dos constantes locales con comment claro
    sobre cuál actualizar:
    ```ts
    // ⬇ ACTUALIZAR AQUÍ cuando el canal de YouTube crezca.
    const YOUTUBE_SUBSCRIBERS = '4.5K';
    const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@Metamorfosisreal';
    ```
  - Tile 1 ("10K+ Usuarios activos") reemplazado por un `<a>` que
    linkea al canal con `target="_blank" rel="noopener noreferrer"`,
    `data-umami-event="cta_youtube_hero"` y arrow `↗` en hover. Tile
    siempre visible (no condicional). El número va precedido por el
    icono `<Youtube>` de lucide en color rojo brand (`#FF0000`) con
    `fill` para que se vea como el botón YouTube oficial — único
    color off-paleta del Hero, justificado por convención de
    industria (iconos de plataforma usan brand color en stat rows).
  - Tile 2 ("94% Mejora metabólica") reemplazado por copy estático
    "BETA" / "Cohorte 2026 activa". Sin número.
  - Tile 3 (IMR) intacto.

**Verificaciones pasadas en sandbox:**

- `grep -rE "10K\+|94%"` en `src/` retorna solo 1 match: el comentario
  explicativo del frontmatter (excepción documentada en criterios).
- Validación sintáctica del Hero: braces balanceadas, referencias a
  `YOUTUBE_SUBSCRIBERS` y `YOUTUBE_CHANNEL_URL` correctas.

**Pendiente para Carlos antes del commit:**

1. Eliminar `Hero.astro.bak` localmente (el sandbox no tiene permisos
   `rm` en el mount):
   ```bash
   rm metamorfosis-web/src/components/Hero.astro.bak
   ```
2. Build local:
   ```bash
   cd metamorfosis-web && npm run build
   ```
3. Commit + push:
   ```bash
   git add metamorfosis-web/src/components/Hero.astro \
           specs/SPEC-098-home-eliminar-metricas-inventadas.md
   git rm metamorfosis-web/src/components/Hero.astro.bak
   git commit -m "fix(spec-098): eliminar métricas inventadas del Hero, suscriptores YT + BETA"
   git push
   ```
4. Verificación post-deploy (90-120s):
   - Abrir el home en producción.
   - Confirmar que el row de stats muestra: `▶ 4.5K | Suscriptores
     en YouTube ↗  |  BETA Cohorte 2026 activa  |  IMR Índice propio →`
     donde `▶` es el icono YouTube en rojo brand.
   - Click en el tile YouTube debe abrir el canal en pestaña nueva.

**Cierre de spec:** al pasar las 4 verificaciones, cambiar Estado a
✅ Cerrada y agregar fecha de cierre arriba.

**Desviaciones del plan original (2):**

1. **Tile 1 cambió de `founderCount` (SPEC-056) a suscriptores
   YouTube** — decisión Carlos 2026-05-19. Racional: el número de
   fundadores aún es bajo; los suscriptores YouTube (4500) reflejan
   mejor el alcance editorial real del ecosistema.

2. **Tile 1 cambió de env var Hostinger a hardcoded** — decisión
   Carlos 2026-05-19 (segunda iteración). Racional: simplicidad
   operativa. Sin Restart de Hostinger ni pasos fuera del editor. El
   trade-off es que actualizar el número requiere commit + push +
   90-120s, pero ese trade-off es aceptable porque el conteo se
   actualiza ~mensualmente, no semanalmente.
