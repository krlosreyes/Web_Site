# Roadmap SDD — Metamorfosis Real

**Origen:** revisión de código del 2026-05-08 (`REVISION-CODIGO-2026-05-08.md`).
**Metodología:** Spec-Driven Development. Cada problema se resuelve con una spec completa que vive en `specs/SPEC-NNN-*.md`. La spec define contexto, solución propuesta, plan, criterios de aceptación y pruebas; la implementación cierra contra esa spec.
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
| 013 | Layouts unificados (Layout claro vs BaseLayout oscuro) | 📝 Pendiente | El sitio cambia bruscamente de tema al navegar; `style p { max-width: 65ch }` global | — |
| 014 | Calidad de código y tipos en scripts | 📝 Pendiente | `console.log` en 17 archivos prod, tipos null-safe, README template default | — |
| 015 | Endpoint PDF real o disabled explicit | 📝 Pendiente | `generate-pdf-report.ts` es mockup con CDN play | — |
| 016 | Limpieza archivos obsoletos | 📝 Pendiente | `last-update.txt`, `propuesta-*.html` en raíz, `.quarantine_modules/` | — |

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
