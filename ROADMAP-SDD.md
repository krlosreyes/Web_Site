# Roadmap SDD — Metamorfosis Real

**Origen:** revisión de código del 2026-05-08 (`REVISION-CODIGO-2026-05-08.md`).
**Metodología:** Spec-Driven Development. Cada problema se resuelve con una spec completa que vive en `specs/SPEC-NNN-*.md`. La spec define contexto, solución propuesta, plan, criterios de aceptación y pruebas; la implementación cierra contra esa spec.
**Flujo git:** un commit + push directo a `main` por cada spec resuelta. Mensaje: `feat(spec-NNN): resumen` o `fix(spec-NNN): resumen` según corresponda.

---

## Prioridades

Atacamos los **CRÍTICOS** en orden, después los **ALTOS**, después el resto. La numeración de specs (SPEC-NNN) refleja el orden de ejecución, no la severidad — todas las specs de esta primera fase son críticas.

### Fase 1 — CRÍTICOS (este roadmap)

| # | Spec | Estado | Problema | Archivo |
|---|---|---|---|---|
| 001 | Resolver SSR + deploy | 📝 Spec | `output: 'server'` sin adaptador, deploy FTP a Hostinger | [SPEC-001](specs/SPEC-001-ssr-deploy-strategy.md) |
| 002 | Auth en `/api/admin/cleanup` | 📝 Spec | Endpoint admin sin autenticación | [SPEC-002](specs/SPEC-002-cleanup-auth.md) |
| 003 | Unificar contrato de auth admin | 📝 Spec | 3 formas distintas de validar la cookie `admin_session` | [SPEC-003](specs/SPEC-003-admin-auth-contract.md) |
| 004 | Cerrar write arbitrario en `/api/calculate-imr` | 📝 Spec | `recordId` permite escribir a posts sin auth | [SPEC-004](specs/SPEC-004-calculate-imr-write.md) |
| 005 | Unificar colecciones Firestore | 📝 Spec | `'post'` vs `'metamorfosis_posts'` y `profiles` vs `users` | [SPEC-005](specs/SPEC-005-firestore-collections.md) |

### Fase 2 — ALTOS (próxima tanda, una vez cerrada la Fase 1)

- Variables de entorno faltantes en CI (`FIREBASE_*`, `ADMIN_PASSWORD`)
- Verificar historial git por la service account
- Quitar enlace `/admin` público de Navbar/Footer
- Rotar `ADMIN_PASSWORD`

### Fase 3 — MEDIOS (UX, consistencia, calidad)

Layouts unificados, footer único, duplicados en `posts/[slug]`, redes sociales reales, links rotos, `target="_blank"` con rel, tipos en scripts, console.log en producción, `vite.server.fs.allow`, `generate-pdf-report` real, README, etc.

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
SPEC-001 (deploy)
    └── habilita → SPEC-002, SPEC-003, SPEC-004, SPEC-005
                   (estas tienen sentido solo si las APIs SSR efectivamente
                    se ejecutan en el servidor)
```

SPEC-001 es bloqueante real para el resto. Las specs 002–005 se pueden escribir y revisar en paralelo, pero la verificación E2E ("se llamó al endpoint y devolvió 401") requiere que el deploy funcione primero.

Si por algo SPEC-001 demora, podemos resolver 002–005 en local (con `npm run dev`) y dejar la verificación productiva para después.
