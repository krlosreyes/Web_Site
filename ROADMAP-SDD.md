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
| 007 | Esconder UI admin a visitantes anónimos | ✅ Cerrada (2026-05-10) | Verificada de facto: Navbar y Footer ya gateaban con `{isAdmin && ...}` desde SPEC-003 | [SPEC-007](specs/SPEC-007-hide-admin-ui.md) |
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
| 023 | PostList con orden + filtro + fecha de publicación editable | ✅ Cerrada (2026-05-10) | Sin orden por fecha, sin filtros, sin forma de backdatear publishedAt | [SPEC-023](specs/SPEC-023-postlist-orden-y-fecha-manual.md) |
| 024 | ArticleQuiz: gating de score + CTA registro para anónimos | ✅ Cerrada (2026-05-10) | Anónimos veían botón "dashboard" sin auth y perdían el score al cerrar el browser | [SPEC-024](specs/SPEC-024-article-quiz-anonimo-cta-registro.md) |
| 025 | Fecha pública del artículo refleja `publishedAt` | ✅ Cerrada (2026-05-10) | El frontend público mostraba `createdAt` y biblioteca ordenaba por `createdAt`, ignorando la fecha editable de SPEC-023 | [SPEC-025](specs/SPEC-025-fecha-publicacion-publica.md) |
| 026 | Navbar no tapa contenido (dashboard + defensa global) | ✅ Cerrada (2026-05-10) | `dashboard.astro` con `pt-8` insuficiente; navbar de 80px tapaba el título del user | [SPEC-026](specs/SPEC-026-navbar-no-tapa-contenido.md) |
| 027 | SEO técnico (sitemap, robots, OG dinámicas, schema.org) | ✅ Cerrada (2026-05-10) | Sin sitemap, sin robots, OG image rota (default a `/og-image.jpg` inexistente) | [SPEC-027](specs/SPEC-027-seo-tecnico.md) |
| 028 | Analytics real con Umami cloud | ✅ Cerrada (2026-05-10) | Sin medición de tráfico orgánico → decisiones a ciegas | [SPEC-028](specs/SPEC-028-analytics-umami.md) |
| 028b | Fix Umami: leer env var en runtime, no build-time | ✅ Cerrada (2026-05-10) | Dashboard vacío post-deploy: `import.meta.env.PUBLIC_*` se inlinea al build; cambio en Hostinger no surtía efecto | [SPEC-028b](specs/SPEC-028b-umami-env-runtime.md) |
| 029 | Email transaccional de bienvenida (Resend) | ✅ Cerrada (2026-05-10) | Tras registro no llegaba ningún email; promesa de "lista de espera ElenaApp" sin confirmación | [SPEC-029](specs/SPEC-029-email-transaccional-bienvenida.md) |
| 030 | Performance home: webp + fonts async + preload LCP | ✅ Cerrada (2026-05-10) | Lighthouse mobile Performance 62 (LCP 6.7s) por imágenes de 5.5MB y Google Fonts bloqueando render | [SPEC-030](specs/SPEC-030-lighthouse-performance-home.md) |
| 030b | Diferir Firebase Auth del critical path + a11y footer | ✅ Cerrada (2026-05-10) | Post-SPEC-030 el score seguía en 62: NotificationBell + ElenaAppCTA con `client:load` arrastraban Firebase SDK + iframe Auth al critical path (1.3s) | [SPEC-030b](specs/SPEC-030b-firebase-out-of-critical-path.md) |
| 030c | Self-host Google Fonts (Inter + Space Grotesk) | ❌ REVERTIDA (2026-05-10) | Intentamos self-hostear para subir 84 → 90+, pero el script Python descargó WOFF2 del unicode-range wrong; bajó Performance a 63. Revertida a Google Fonts non-blocking (SPEC-030). | [SPEC-030c](specs/SPEC-030c-self-host-fonts.md) |
| 031 | Headings responsive sin desborde (audit completo) | ✅ Cerrada (2026-05-10) | "HOLA, METAMORFOSIS" se cortaba en mobile por `text-6xl` sin breakpoints; otros lugares con texto dinámico tenían riesgo similar | [SPEC-031](specs/SPEC-031-headings-responsive-no-desborde.md) |
| 032 | Likes/Dislikes en artículos | ✅ Cerrada (2026-05-10) | Cero feedback estructurado del lector; sin proxies de calidad por artículo | [SPEC-032](specs/SPEC-032-likes-articulos.md) |
| 033 | Foro funcional con persistencia (La Tribu) | ✅ Cerrada (2026-05-10) | El foro era 100% mock: topics hardcoded, replies sin enviar, likes estáticos, todo se perdía al refresh | [SPEC-033](specs/SPEC-033-foro-funcional.md) |
| 034 | Login con onboarding amigable y preciso | ✅ Cerrada (2026-05-10) | Copy decía "leer un artículo" pero solo leer no daba elegibilidad; tono rojo agresivo sin guía a la acción | [SPEC-034](specs/SPEC-034-login-onboarding-amigable.md) |
| 035 | PostReactions con CTA al test (no a registro directo) | ✅ Cerrada (2026-05-10) | Anónimo veía "Registrate para reaccionar" → /login; saca al user del flow del artículo | [SPEC-035](specs/SPEC-035-postreactions-cta-test.md) |
| 036 | Foro: nombre real del autor + delete topic + likes en replies | ✅ Cerrada (2026-05-10) | 3 bugs visibles del foro recién deployado | [SPEC-036](specs/SPEC-036-foro-fixes-y-likes-replies.md) |
| 037 | Reacciones instant feedback + diagnóstico delete topic | ✅ Cerrada (2026-05-10) | Reacciones lentas (esperaban round-trip antes del próximo click); delete topic seguía sin funcionar y el alert era opaco | [SPEC-037](specs/SPEC-037-reacciones-instant-y-delete-debug.md) |
| 038 | Foro: replies anidadas (cascada 1.1.1) + delete topic solo admin | ✅ Cerrada (2026-05-10) | Replies eran flat (sin árbol); botón Eliminar del topic seguía sin funcionar | [SPEC-038](specs/SPEC-038-foro-replies-anidadas-y-delete-solo-admin.md) |
| 039 | Foro: replies estilo Instagram (2 niveles + @autor, sin numeración) | ✅ Cerrada (2026-05-10) | Numeración 1.1.1.1 era solo referencia conceptual, no debía mostrarse; el árbol se veía plano por cap=2 | [SPEC-039](specs/SPEC-039-foro-replies-instagram-style.md) |
| 040 | Foro: vincular topic ↔ artículo | ✅ Cerrada (2026-05-10) | Foro y artículos vivían aislados; sin puente para discutir contenido específico | [SPEC-040](specs/SPEC-040-foro-vincular-topic-articulo.md) |
| 041 | Foro: pin / destacar topics (admin) | ✅ Cerrada (2026-05-10) | Admin no podía anclar topics importantes ni curar "Pregunta de la semana" | [SPEC-041](specs/SPEC-041-foro-pin-destacar.md) |
| 042 | Foro: save / bookmark topics | ✅ Cerrada (2026-05-10) | Topics interesantes se perdían en el scroll, sin forma de volver a ellos | [SPEC-042](specs/SPEC-042-foro-save-bookmark.md) |
| 045 | Footer del artículo: espaciado y peso visual coherentes | ✅ Cerrada (2026-05-10) | PostReactions / La Tribu CTA / Quiz se veían amontonados con pesos visuales distintos | [SPEC-045](specs/SPEC-045-articulo-footer-respiracion.md) |
| 046 | Pilares como taxonomía unificada (foro + artículos) | ✅ Cerrada (2026-05-10) | Foro tenía categorías inventadas; artículos sin categoría formal | [SPEC-046](specs/SPEC-046-pilares-categorias-unificadas.md) |
| 047 | Landing del quiz: copy que invita | ✅ Cerrada (2026-05-10) | "PROTOCOLO SPEC-70.5" era jerga interna sin invitación al user | [SPEC-047](specs/SPEC-047-quiz-landing-copy.md) |
| 048 | ElenaApp CTA con modal de waitlist (primeros 1000) | ✅ Cerrada (2026-05-10) | Botón "Abrir App" sacaba al user del sitio sin convertirlo a la waitlist | [SPEC-048](specs/SPEC-048-elenaapp-cta-waitlist-modal.md) |
| 049 | Modal ElenaApp con Portal + centrado robusto | ✅ Cerrada (2026-05-10) | Modal SPEC-048 quedaba atrapado dentro del navbar (containing block del fixed roto) | [SPEC-049](specs/SPEC-049-elenaapp-modal-portal-centrado.md) |
| 043 | Notificaciones in-app del foro | ✅ Cerrada (2026-05-10) | Sin notif, los users no volvían al sitio cuando alguien les respondía | [SPEC-043](specs/SPEC-043-notificaciones-foro.md) |
| 044 | Mentions @usuario en el foro | ✅ Cerrada (2026-05-10) | No se podía invocar a un user específico a una conversación | [SPEC-044](specs/SPEC-044-mentions-foro.md) |

### Fase 6 — PRE-LANZAMIENTO (2026-05-11)

| # | Spec | Estado | Problema | Archivo |
|---|---|---|---|---|
| 050 | `.gitignore` blindado (defense in depth) | ✅ Cerrada (2026-05-11) | Root del repo sin `.gitignore` (el real vive en `metamorfosis-web/`) y `.DS_Store` del root quedó trackeado | [SPEC-050](specs/SPEC-050-gitignore-blindado.md) |
| 051 | Limpieza páginas zombie + sitemap fix | ✅ Cerrada (2026-05-11) | 4 páginas legacy (`/dashboard-7d`, `/diagnostico`, `/protocolo`, `/calculadora`) sin links internos, 2 en sitemap → Google las indexaba como entry points obsoletos con tema light pre-SPEC-013 | [SPEC-051](specs/SPEC-051-limpieza-paginas-zombie.md) |
| 052 | OG image branded dedicada | ✅ Cerrada (2026-05-11) | Default OG era `header-bg.jpg` (2 MB) — scrapers de LinkedIn/FB legacy fallaban o tardaban; ningún branding visible en el preview de redes | [SPEC-052](specs/SPEC-052-og-image-branded.md) |
| 052b | Fix OG URLs absolutas (Astro.site, no Astro.url) | ✅ Cerrada (2026-05-11) | og:image/url se renderizaban con `http://localhost:4321/` en prod porque astro.config.mjs no tenía `site:` — Astro.url cae a localhost cuando reverse proxy de Hostinger no propaga Host header. Rompía TODOS los previews de redes | [SPEC-052b](specs/SPEC-052b-fix-og-urls-absolutas.md) |
| 053 | Hero copy refresh (vos diseñás tu salud) | ✅ Cerrada (2026-05-11) | Copy "Transforma tu Metabolismo con Ciencia Real" + descripción técnica → tono más empoderador donde el user es protagonista | [SPEC-053](specs/SPEC-053-hero-copy-refresh.md) |
| 054 | Neutralizar tono argentino en copy | ✅ Cerrada (2026-05-11) | El sitio mezclaba voseo (tenés, podés, Reservá, Iniciá) que limita conexión con audiencia hispanoamericana general (México, Colombia, España, etc.). Sweep + reemplazo a español neutro en 10 archivos | [SPEC-054](specs/SPEC-054-neutralizar-tono-argentino.md) |
| 055 | ElenaApp modal: auto-open + logo branded | ✅ Cerrada (2026-05-11) | Modal solo abría con click manual (conversion baja). Imagen era mockup genérico. Implementar auto-open respetuoso (Opción A: home + 3s + no logged + no dismissed) + reemplazar mockup por logo real DNA verde | [SPEC-055](specs/SPEC-055-elenaapp-modal-auto-open-logo.md) |
| 056 | Cohorte fundadores: schema + counter atómico | ✅ Cerrada (2026-05-11) | El sitio prometía beneficios a "primeros 1000" sin respaldo técnico. Schema `users/{uid}.founder` + counter atómico `system/counters.founderCount` + integración en onboard via runTransaction (cap firme 1000). Sin código de validación — Firebase Auth compartido con ElenaApp es suficiente. | [SPEC-056](specs/SPEC-056-cohorte-fundadores.md) |
| 057 | Email fundador diferenciado + badge en dashboard | ✅ Cerrada (2026-05-11) | Comunicar al fundador su número + 2 beneficios por dos canales redundantes. Email "Eres fundador #N" vs estándar (post-1000 sin mención de beneficios). Badge amber en `BioDashboard` como fallback si el email no llega (filtro spam, typo, etc.). | [SPEC-057](specs/SPEC-057-email-fundador-y-badge-dashboard.md) |
| 058 | Dashboard admin: tab Fundadores + polling 30s | ✅ Cerrada (2026-05-11) | Carlos necesita ver el cohorte en tiempo real durante el lanzamiento. Endpoint `GET /api/admin/founders` + componente con header XXX/1000, progress bar, búsqueda, export CSV, polling 30s. Tab amber en AdminApp con su propio header (oculta StatsGrid). | [SPEC-058](specs/SPEC-058-admin-tab-fundadores.md) |
| 059 | Pillars cards centradas + linkeables a biblioteca filtrada | ✅ Cerrada (2026-05-11) | Las cards de la home eran decorativas (sin acción) y los iconos quedaban a la izquierda. Convertidas en `<a href="/biblioteca?pilar={id}">` con icon centrado (`mx-auto`). Biblioteca lee el query param y aplica filtro server-side (sin flicker). Sync de history API al toggle. | [SPEC-059](specs/SPEC-059-pillars-clickeables-y-iconos-centrados.md) |

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
