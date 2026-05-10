# Roadmap SDD — Metamorfosis Real

**Origen:** revisión de código del 2026-05-08 (`REVISION-CODIGO-2026-05-08.md`).
**Constitución del proyecto:** ver [`CLAUDE.md`](./CLAUDE.md) — scope, stack, reglas inquebrantables, mapa de archivos.
**Metodología:** Spec-Driven Development. Detalle en [`specs/000-METHODOLOGY-SDD.md`](./specs/000-METHODOLOGY-SDD.md). Cada problema se resuelve con una spec completa que vive en `specs/SPEC-NNN-*.md`. La spec define contexto, solución propuesta, plan, criterios de aceptación y pruebas; la implementación cierra contra esa spec.
**Flujo git:** un commit + push directo a `main` por cada spec resuelta. Mensaje: `feat(spec-NNN): resumen` o `fix(spec-NNN): resumen` según corresponda.

---

## Prioridades

Atacamos los **CRÍTICOS** en orden, después los **ALTOS**, después el resto. La numeración de specs (SPEC-NNN) refleja el orden de ejecución, no la severidad — todas las specs de esta primera fase son críticas.

### Fase 1 — CRÍTICOS (este roadmap)

**Ajuste 2026-05-09:** Carlos comunicó que el sitio web es la puerta de entrada al ecosistema Metamorfosis Real (web → ElenaApp), y que los users de la web deben quedar listos para usar ElenaApp sin re-onboarding. SPEC-004 y SPEC-005 fueron rescoped con láser de integración. Se agregó SPEC-006. Como ElenaApp aún no tiene users reales en producción, esta es la ventana ideal para definir el contrato canónico de datos.

**Orden de ejecución revisado:** SPEC-005 (schema) **antes** de SPEC-004 (motor), porque el motor escribe en el schema. SPEC-006 cierra el funnel.

| # | Spec | Estado | Problema | Archivo |
|---|---|---|---|---|
| 001 | Resolver SSR + deploy en Hostinger Node.js Apps | ✅ Cerrada (2026-05-09) | `output: 'server'` sin adaptador; reusar Hostinger Business (Node.js Apps disponible en plan actual) | [SPEC-001](specs/SPEC-001-ssr-deploy-strategy.md) |
| 002 | Auth en `/api/admin/cleanup` | ✅ Cerrada (2026-05-09) | Endpoint admin sin autenticación | [SPEC-002](specs/SPEC-002-cleanup-auth.md) |
| 003 | Unificar contrato de auth admin | ✅ Cerrada (2026-05-09) | 3 formas distintas de validar la cookie `admin_session` | [SPEC-003](specs/SPEC-003-admin-auth-contract.md) |
| 005 | Schema canónico de `users/{uid}` compartido Web ↔ ElenaApp | ✅ Cerrada (2026-05-09) | `profiles` vs `users` por email, sin schema versionado, sin contrato con ElenaApp; `'post'` singular en stats.ts | [SPEC-005](specs/SPEC-005-firestore-collections.md) |
| 004 | Motor IMR unificado web ↔ ElenaApp | ✅ Cerrada (2026-05-09) | 3 motores divergentes en la web; `calculateIMRv2` (CF GCP) sin estado claro; recordId habilita writes anónimos | [SPEC-004](specs/SPEC-004-calculate-imr-write.md) |
| 006 | Onboarding web crea user listo para ElenaApp | ✅ Cerrada (2026-05-09) | Registrarse en web no produce user válido para app; re-onboarding garantizado | [SPEC-006](specs/SPEC-006-onboarding-web-app.md) |

> **🎯 Fase 1 cerrada: 6/6 specs ✅** (2026-05-09). El sitio en producción tiene SSR funcionando, panel admin con auth unificada, motor IMR canónico, schema de Firestore versionado y compatible con ElenaApp, y onboarding sin re-fricción. Próximas fases: Fase 2 (rotación de credenciales, env vars en CI, links admin públicos), Fase 3 (UX, layouts, redes sociales reales), Fase 4 (limpieza).

### Fase 2 — ALTOS (seguridad operacional)

| # | Spec | Estado | Problema | Archivo |
|---|---|---|---|---|
| 007 | Esconder UI admin a visitantes anónimos | 📝 Spec | Navbar/Footer exponen `/admin` a todos los visitantes | [SPEC-007](specs/SPEC-007-hide-admin-ui.md) |
| 008 | Reglas de seguridad de Firestore | ✅ Cerrada (2026-05-09) | Sin rules explícitas, lectura/escritura libre desde el cliente | [SPEC-008](specs/SPEC-008-firestore-rules.md) |
| 009 | Auditar git history por credenciales filtradas | ✅ Cerrada (2026-05-09) | `.env` y service account JSON pudieron commitearse en WIP | [SPEC-009](specs/SPEC-009-git-history-audit.md) |
| 010 | Rotar `ADMIN_PASSWORD` | ✅ Cerrada (2026-05-09) | Password aparece en docs commiteados — confirmado por SPEC-009 | [SPEC-010](specs/SPEC-010-rotate-admin-password.md) |

> **🎯 Fase 2 cerrada: 4/4 specs ✅** (2026-05-09). El sitio tiene UI admin oculta a anónimos, reglas de Firestore explícitas, historial git auditado, y password admin rotado. Próxima fase: 3 (UX, layouts, calidad de código).

**Orden recomendado por riesgo creciente:** 007 (cero, UX) → 009 (research, no escribe) → 008 (medio, requiere testing) → 010 (medio, riesgo de bloqueo si algo va mal en hPanel).

### Fase 3 — MEDIOS (UX, consistencia, calidad)

| # | Spec | Estado | Problema | Archivo |
|---|---|---|---|---|
| 011 | Footer real (redes + link 404) | ✅ Cerrada (2026-05-09) | Redes apuntaban a homepages genéricas, `/posts` era 404, ícono TikTok placeholder | [SPEC-011](specs/SPEC-011-footer-navbar-real.md) |
| 012 | Limpiar duplicados en `posts/[slug]` | ✅ Cerrada (2026-05-09) | Comunidad CTA + back-link aparecen 2 veces, "1,240 biohackers" hardcoded | [SPEC-012](specs/SPEC-012-posts-slug-cleanup.md) |
| 013 | Layouts unificados (oscuro + footer único) | ✅ Cerrada (2026-05-09) | El sitio cambia bruscamente de tema al navegar; `style p { max-width: 65ch }` global | [SPEC-013](specs/SPEC-013-unified-layouts.md) |

### Fase 4 — ADMIN AUTOMATION (dashboard administrativo)

Decisión 2026-05-09: Carlos pidió "optimizar el dashboard administrativo" enfocando en automatizar publicación de artículos. Confirmó que **NO necesita Gemini API server-side** (descartado SPEC-020 original). El alcance se enfoca en mejorar el flow manual + pipeline de imágenes para sacar bottlenecks operativos.

| # | Spec | Estado | Problema | Archivo |
|---|---|---|---|---|
| 014 | Imágenes a Cloud Storage (no base64) | ✅ Cerrada (2026-05-09) | Imágenes guardadas como base64 dentro del doc Firestore — riesgo de pasar el límite de 1MB y perfomance lento | [SPEC-014](specs/SPEC-014-images-cloud-storage.md) |
| 015 | Drafts + preview en vivo + validación quiz | ✅ Cerrada (2026-05-09) | Sin drafts (cada save publica), sin preview del markdown renderizado, quiz puede publicarse vacío | [SPEC-015](specs/SPEC-015-drafts-preview-quiz-validation.md) |
| 016 | LeadList CRM funcional (status, notas, tags) | ✅ Cerrada (2026-05-09) | Tabla estática con export CSV — sin gestión de pipeline de leads | [SPEC-016](specs/SPEC-016-leadlist-crm.md) |
| 017 | Analítica IMR integrada al dashboard | ✅ Cerrada (2026-05-10) | Vive en página aparte, fricción de navegación | [SPEC-017](specs/SPEC-017-analitica-imr-en-dashboard.md) |
| 018 | Audit log de actividad admin | ✅ Cerrada (2026-05-10) | Sin trazabilidad de qué editó/borró cada admin | [SPEC-018](specs/SPEC-018-audit-log.md) |
| 019 | Stats con filtros temporales + tendencias | ✅ Cerrada (2026-05-10) | Solo totales fijos, sin rango ni evolución | [SPEC-019](specs/SPEC-019-stats-filtros-temporales.md) |

### Backlog (ex-Fase 3, postergado)

- Calidad de código (`console.log` en producción, tipos null-safe en scripts inline, README default)
- Endpoint PDF real (`generate-pdf-report.ts` es mockup con CDN play)
- Limpieza archivos obsoletos (`last-update.txt`, `propuesta-*.html`, `.quarantine_modules/`)

### Fase 5 — METODOLOGÍA (gobernanza SDD)

Decisión 2026-05-09: análisis del documento `Spec_Driven_Development.pdf` cruzado con la práctica real (ver `specs/000-METHODOLOGY-SDD.md`). Los items 1-6 del manifiesto ya estaban adoptados o se adoptaron al crear `CLAUDE.md`. Los siguientes quedan candidatos a SPEC dedicada cuando el ROI lo justifique:

| # | Spec | Estado | Problema | Trigger para abrir |
|---|---|---|---|---|
| 020 | Tests automatizados (motor IMR + auth) | ✅ Cerrada (2026-05-10) | Solo "pruebas manuales"; refactors grandes podrían introducir regresiones silenciosas | [SPEC-020](specs/SPEC-020-tests-automatizados.md) |
| 021 | Pre-commit hook anti-credenciales | 📝 Candidata | SPEC-009 detectó retroactivamente; un hook lo previene a futuro | Si se suma colaborador al repo |
| 022 | Limpieza técnica (console.log, mockup PDF, HTMLs obsoletos) | ✅ Cerrada (2026-05-10) | Restos de pre-proyecto y debug en el repo | [SPEC-022](specs/SPEC-022-limpieza-tecnica.md) |

### Fase 4 — BAJOS (limpieza)

`.quarantine_modules`, `last-update.txt`, `ArticleQuiz` duplicado, bundle Recharts.

---

## Estados de spec

- 📝 **Spec** — escrita, pendiente de implementación.
- 🔨 **En progreso** — implementación abierta.
- ✅ **Cerrada** — implementación mergeada y verificada contra los criterios de aceptación.
- ⏸️ **Pausada** — bloqueada por dependencia o decisión externa.
- ❌ **Descartada** — se decidió no implementar; razón anotada en la spec.

## Convenciones

- **Una spec = un commit + push.** Si la implementación rebalsa, se parte la spec (ej. SPEC-003a, SPEC-003b) antes de commitear.
- **Mensaje de commit:** `feat(spec-NNN): título corto` o `fix(spec-NNN): título corto`. Body con bullets de cambios y referencia al archivo de la spec.
- **Cierre de spec:** al final de la implementación, marcar la spec como ✅ y dejar al final una sección `## Resultado` con qué quedó hecho y cualquier desviación del plan.
- **No mezclar specs.** Si trabajando en una spec aparece un problema de otra, se anota en la spec relevante o se abre nueva spec — no se mete en el commit en curso.

## Dependencias entre specs de Fase 1

```
SPEC-001 (deploy) ✅
    └── habilita → SPEC-002 ✅, SPEC-003 ✅, SPEC-005, SPEC-004, SPEC-006

SPEC-005 (schema canónico)
    └── bloquea → SPEC-004 (motor escribe al schema), SPEC-006 (onboarding usa el schema)

SPEC-004 (motor IMR)
    └── habilita → SPEC-006 (onboarding persiste resultado del motor)

SPEC-006 (onboarding)
    └── cierre del funnel web → ElenaApp
```

Camino crítico de ejecución: 005 → 004 → 006.

**Nota sobre integración Web ↔ ElenaApp:** ElenaApp existe pero está en desarrollo, sin users reales en producción. Esa ventana se aprovecha en SPEC-005 para definir el schema canónico sin migración. El contrato (`src/lib/types/user.ts`) es el handover formal hacia el equipo de ElenaApp — debe respetarse cuando la app llegue a producción.
