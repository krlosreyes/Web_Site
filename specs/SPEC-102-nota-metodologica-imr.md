# SPEC-102 — Nota Metodológica IMR pública

**Estado:** 🔨 En progreso (código listo, pendiente: `npm run build` + commit + push)
**Fase:** Bloque B del plan estratégico 2026-05-19 (cierre — pieza de credibilidad)
**Severidad:** ALTO (foso defensible: transparencia controlada que ningún competidor en español tiene)
**Fecha de creación:** 2026-05-19
**Autor:** Carlos Reyes
**Depende de:** SPEC-081 (página /imr existente), SPEC-004 (motor IMR), SPEC-099 (pilar débil)

---

## Contexto

El plan estratégico 2026-05-19 propuso publicar un *whitepaper IMR v1.0* con la fórmula completa — equivalente al "Bitcoin whitepaper" del producto. La página `/imr` actual (SPEC-081) cubre bien el QUÉ y el POR QUÉ del IMR pero declara explícitamente que el algoritmo es propietario:

> *"El algoritmo específico del IMR (cómo se ponderan los inputs, qué fórmulas se aplican, cómo se normalizan los valores en un puntaje 0-100) es propiedad intelectual de Metamorfosis Real y no se publica."*
> — `/src/pages/imr.astro:143`

Esta es una **decisión de IP previa de Carlos**. Esta spec NO la revierte. En su lugar documenta hasta el límite que respeta esa decisión:

- Pesos del nivel superior (E=50%, M=25%, C=25% → IMR final).
- Fórmulas estándar de la literatura científica usadas (Navy, Mifflin, Katch-McArdle, edad metabólica empírica de SPEC-004).
- Rangos y zonas precisas (OPTIMIZADO/EFICIENTE/FUNCIONAL/INESTABLE/DETERIORADO).
- Versionado del motor (`spec-70.5-v1`).
- Validación interna (casos canónicos: atleta 30a → ~21 años metabólicos; sobrepeso 50a → ~63).
- Limitaciones técnicas detalladas.

Lo que NO se revela: los coeficientes internos de los sub-bloques E, M, C (ej. 0.70, 0.30, 0.38, 0.20, 0.20, 0.12, 0.10 que ponderan los inputs de cada bloque en `utils/imr-engine.ts`). Eso es el IP que Carlos quiere proteger.

## Problema

Aunque `/imr` cubre QUÉ y POR QUÉ con buen nivel de detalle, falta una pieza de credibilidad técnica para el visitante sofisticado:

1. **No se ven las fórmulas estándar** (Navy, Mifflin, Katch-McArdle) que SÍ son públicas y vienen de literatura citable.
2. **No se ven los pesos macro** del IMR final (E=50%, M=25%, C=25%) — saberlos no compromete IP y aclara prioridad.
3. **La fórmula de edad metabólica** ya está documentada en el código (`metabolicAge` JSDoc) pero no se expone al usuario.
4. **El versionado del motor** existe (`ENGINE_VERSION = 'spec-70.5-v1'`) pero el usuario no sabe que el algoritmo está versionado.
5. **Las zonas precisas** (OPTIMIZADO 90+, EFICIENTE 75-89, FUNCIONAL 60-74, INESTABLE 40-59, DETERIORADO <40) están en código pero `/imr` solo dice "0-39, 40-59, 60-100" simplificado.

## Solución propuesta

Crear página nueva **`/imr/metodologia`** como complemento técnico de `/imr`. Estructura:

1. **Resumen ejecutivo** (1 párrafo + tabla de versiones).
2. **Inputs que captura el motor** (biométricos + hábitos auto-reportados + derivados).
3. **Fórmulas estándar de la literatura** que el motor usa:
   - Body Fat % por método Navy (Hodgdon & Beckett 1984)
   - TMB por Mifflin-St Jeor (1990) — usada en bloque E para BMR de referencia
   - TMB por Katch-McArdle (1983) — usada para LBM y validación cruzada
   - BMI y derivados (ICA, WHtR, FFMI)
   - Edad metabólica (fórmula empírica original, ya documentada en código)
4. **Pesos del nivel superior** (E=50%, M=25%, C=25% al IMR final). Explicación de por qué E pesa el doble (composición corporal es resultado de meses, no de la decisión de hoy).
5. **Zonas precisas con corte numérico exacto**: 5 zonas (no 3 como en `/imr` simplificado).
6. **Validación interna**: 3 casos canónicos calibrados con outputs esperados (atleta 30a/bf=10/BMI=23 → metAge ~21; promedio 35a/bf=18/BMI=24 → metAge ~36; sobrepeso 50a/bf=30/BMI=31 → metAge ~63).
7. **Limitaciones técnicas detalladas**: edge cases, contextos donde el IMR no aplica bien, qué NO sustituye.
8. **Roadmap de versiones** del motor: qué necesitaría el próximo `spec-70.6-v1`.
9. **Referencias** (completar las que ya están en `/imr` con las específicas de fórmulas).

Estilo:
- Tono científico pero accesible (no académico árido).
- Tuteo neutro (cumpliendo SPEC-054).
- Tablas y bloques formula-style para facilitar lectura.
- Disclaimer médico al final (compact).

## Plan de implementación

| # | Tarea | Archivo | Esfuerzo |
|---|-------|---------|----------|
| 1 | Crear `src/pages/imr/metodologia.astro` con 9 secciones | nuevo | 2.5 h |
| 2 | Linkear desde `/imr` a `/imr/metodologia` con CTA destacado al final de la sección "Respaldo científico" | mod `pages/imr.astro` | 15 min |
| 3 | Agregar entrada en `metodologia` al sitemap (SPEC-027) | revisar config sitemap | 15 min |
| 4 | Verificación final (grep, build, mobile) | sandbox | 15 min |
| 5 | Commit + push | git | 5 min |
| 6 | Smoke post-deploy (90-120s) | producción | 10 min |

**Esfuerzo total estimado:** ~3.5 horas.

## Criterios de aceptación

- [ ] `/imr/metodologia` accesible públicamente sin auth (es contenido educativo).
- [ ] 9 secciones presentes con tablas o blocks de fórmula donde corresponda.
- [ ] Fórmulas Navy, Mifflin, Katch-McArdle, edad metabólica documentadas con su cita correspondiente.
- [ ] Pesos macro (E=50%, M=25%, C=25%) visibles y justificados con racional.
- [ ] Zonas con 5 cortes precisos (no 3 simplificados).
- [ ] 3 casos canónicos de validación con números exactos del motor.
- [ ] Versión del motor visible (`spec-70.5-v1`).
- [ ] Página enlazada desde `/imr` con CTA visible.
- [ ] NO se publican los coeficientes internos de los sub-bloques E, M, C (`0.70`, `0.30`, `0.38`, etc.).
- [ ] Disclaimer médico al final (variant=compact).
- [ ] Copy en tuteo neutro (sin voseo).
- [ ] Build limpio (`npm run build`).
- [ ] Lighthouse mobile Performance no baja vs baseline.

## Pruebas manuales

```sh
cd metamorfosis-web && npm run build
```

**Smoke post-deploy:**

1. Anónimo visita `https://[dominio]/imr/metodologia` → carga sin auth, contenido visible, sin errores.
2. Logueado visita `/imr` → CTA "Ver metodología completa" visible y linkea correctamente.
3. Mobile 375px: tablas no se desbordan (overflow-x-auto), fórmulas legibles.
4. Verificar `grep -E "0\.70|0\.30|0\.38|0\.20|0\.12|0\.10" pages/imr/metodologia.astro` retorna VACÍO (no se filtraron coeficientes IP).
5. Verificar que las 3 fórmulas de edad metabólica del JSDoc de `engine.ts` (`deltaBf`, `deltaBmi`, `offset`) están en la nota — son la única fórmula "propia" que sí publicamos porque ya está en código abierto.

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Filtrar accidentalmente algún coeficiente IP en la redacción | Media | Grep automático en el smoke + revisión visual antes del commit. Lista de coeficientes a NO publicar documentada en esta spec |
| El nivel de detalle abrume al usuario y no atraiga sino que confunda | Baja | La página es "para los técnicos" — link voluntario desde `/imr`. El usuario casual no entra y no se ve afectado |
| Algún académico cuestione la fórmula empírica de edad metabólica | Media | El JSDoc de `engine.ts` ya reconoce que es empírica y explica el racional. La nota replica ese disclaimer. Argumento de defensa: produce resultados clínicamente coherentes en los 3 casos canónicos publicados |
| Voseo residual en `/imr` actual contamina la consistencia | Detectado | SPEC-095 cerró voseo pero `/imr` tiene 6 instancias residuales (líneas ~195, 210, 219, 238, 248, 258). **Fuera de scope de SPEC-102** pero documentado para abrir SPEC-103-cleanup si Carlos lo prioriza |

## Fuera de scope (intencional)

- **Limpieza de voseo residual en `/imr`**: detectado durante la auditoría (6 instancias). Abrir SPEC-103 si vale.
- **PDF descargable**: HTML primero; si llega demanda real (usuarios pidiendo "lo quiero guardar"), agregar generación PDF en SPEC-104.
- **Publicar coeficientes de los sub-bloques E/M/C**: posición de IP de Carlos. Si cambia, se hace en SPEC dedicada.
- **Validación clínica externa con cohorte**: roadmap del producto, no de la nota. La nota documenta que es educativa, no validada clínicamente.

## Commit sugerido

```
feat(spec-102): Nota Metodológica IMR pública en /imr/metodologia

- Página nueva con 9 secciones: resumen, inputs, fórmulas estándar
  (Navy, Mifflin, Katch-McArdle, edad metabólica empírica), pesos macro
  E=50%/M=25%/C=25%, zonas precisas (5), casos canónicos de validación,
  limitaciones, roadmap de versiones, referencias.
- CTA "Ver metodología completa" agregado a /imr (sección Respaldo).
- Tuteo neutro, sin voseo. Disclaimer médico compact al final.

Decisión documentada: NO se publican coeficientes internos de los
sub-bloques (IP de Carlos preservado). Sí se publican fórmulas
estándar de la literatura ya citables.

Cierra specs/SPEC-102-nota-metodologica-imr.md
```

## Resultado

**Implementación 2026-05-19 — código aplicado en una pasada:**

### Archivos nuevos (1)

- **`src/pages/imr/metodologia.astro`** (~470 líneas)
  - 9 secciones: resumen ejecutivo, inputs del motor (tabla 16 filas),
    fórmulas estándar (Navy + Mifflin + Katch-McArdle + edad metabólica
    empírica + derivados), pesos del nivel superior 50/25/25,
    zonas precisas (5 cortes), casos canónicos de validación (3 perfiles),
    limitaciones técnicas, roadmap de versiones del motor, referencias
    complementarias.
  - Header con versión del motor (`spec-70.5-v1`) visible.
  - Tono científico accesible. Tuteo neutro estricto.
  - Disclaimer médico variant=compact al final.
  - Footer con links a `/`, `/imr`, `/biblioteca`, `/disclaimer-medico`.

### Archivos modificados (1)

- **`src/pages/imr.astro`**
  - CTA destacado "¿Quieres ver las fórmulas exactas...?" agregado al
    final de la sección "Respaldo científico" con link a
    `/imr/metodologia` y tracking `cta_imr_metodologia`.
  - Link "Metodología" agregado al footer (entre Biblioteca y Aviso
    médico).

### Verificaciones pasadas en sandbox

- Braces balanceados en ambos archivos (metodologia.astro 17/17,
  imr.astro 12/12).
- **Cero filtración de coeficientes IP**: grep de `0.70|0.30|0.38|
  0.20|0.12|0.10|qsw|etrf` retorna vacío en metodologia.astro.
- Cero voseo en metodologia.astro (regla SPEC-054).
- Links bidireccionales: `/imr` → `/imr/metodologia` (CTA + footer),
  `/imr/metodologia` → `/imr` (CTA + footer).

### Pendiente para Carlos antes del commit

1. Build local:
   ```bash
   cd metamorfosis-web && npm run build
   ```

2. Commit + push:
   ```bash
   git add metamorfosis-web/src/pages/imr/metodologia.astro \
           metamorfosis-web/src/pages/imr.astro \
           specs/SPEC-102-nota-metodologica-imr.md
   git commit -m "feat(spec-102): Nota Metodológica IMR pública en /imr/metodologia"
   git push
   ```

3. Smoke post-deploy (90-120s):
   - Anónimo visita `/imr/metodologia` → carga sin auth, 9 secciones
     visibles, tablas no se desbordan en mobile 375px.
   - Visita `/imr` → CTA "Ver metodología →" visible al final de la
     sección Respaldo científico + link "Metodología" en el footer.
   - Click en cualquiera de los dos lleva correctamente a la nota.
   - Verificar en producción: la cita "spec-70.5-v1" se ve en el
     header de la nota.
   - Verificar que ningún número como `0.70` o `0.38` aparece en la
     página renderizada (preservación de IP).

**Cierre de spec:** al pasar las 3 verificaciones, cambiar Estado a
✅ Cerrada y agregar fecha de cierre.

### Observación documentada (fuera de scope)

- **Voseo residual en `/imr` existente**: detectado en líneas
  aproximadas 195, 210, 219, 238, 248, 258 ("Podés estar mejorando…",
  "trackeás", "Trabajálo", "Recalculá", etc.). SPEC-095 cerró voseo
  pero `/imr` tiene instancias que se pasaron. **No se tocan en esta
  spec** (regla SDD: una spec, un problema). Si Carlos quiere
  limpieza, abrir SPEC-103-cleanup-imr-voseo (2-3 ediciones, ~15 min).
