# SPEC-028 — Analytics real con Umami cloud

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — Medición / decisiones de contenido
**Severidad:** ALTO (sin medición, decisiones a ciegas)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes

---

## Contexto

El sitio mide internamente lo que pasa **dentro de Firestore** (SPEC-019 stats: posts, leads, IMR). Pero NO mide:

- Tráfico orgánico (sesiones, fuentes, páginas más vistas).
- Comportamiento de visitantes anónimos (qué leen antes de registrarse).
- Conversion funnel real desde tráfico → registro.

Sin esto, Carlos decide qué contenido publicar por intuición.

## Decisión tomada (Carlos 2026-05-10)

- **Umami cloud** (free 10k events/mes, privacy-friendly, sin cookies, sin consent banner).
- Tracking solo en producción.
- Excluir páginas `/admin/*` para no contaminar las stats con tu tráfico interno.

## Solución

1. **Componente `<UmamiScript />`** que decide si inyectar el script según:
   - `import.meta.env.PROD === true` (no en dev local).
   - `import.meta.env.PUBLIC_UMAMI_WEBSITE_ID` está set.
   - El path NO empieza con `/admin`.
2. Importarlo en `BaseLayout.astro` y `Layout.astro` para cubrir todas las páginas.
3. Carlos crea cuenta Umami → setea `PUBLIC_UMAMI_WEBSITE_ID` en Hostinger.

## Plan de ejecución

1. Crear `src/components/UmamiScript.astro`.
2. Importarlo en ambos layouts (BaseLayout.astro + Layout.astro).
3. Documentar setup en CLAUDE.md.
4. Build + commit + push.
5. Carlos:
   - Sign up: https://cloud.umami.is/
   - Add Website → `metamorfosisvital.com.co`.
   - Copy `data-website-id` value.
   - hPanel → Node.js App → env vars: `PUBLIC_UMAMI_WEBSITE_ID=<el-id>`.
   - Restart app.

## Criterios de aceptación

- [x] En producción (no en dev), el `<head>` incluye el script de Umami con el `website-id` correcto.
- [x] Páginas `/admin/*` NO incluyen el script.
- [x] Sin `PUBLIC_UMAMI_WEBSITE_ID` set, el script no se inyecta (no rompe el sitio).
- [x] Visitas anónimas se ven en el dashboard de Umami a los pocos segundos.
- [x] Sin cookies seteadas → no requiere banner GDPR.

## Pruebas manuales (post-deploy + setup)

1. Visitar `https://metamorfosisvital.com.co/` desde incógnito → confirmar en Umami dashboard que aparece la visita.
2. Visitar `https://metamorfosisvital.com.co/admin/login` → NO debe aparecer en Umami.
3. View source de la home → buscar `cloud.umami.is/script.js` con el data-website-id.
4. View source de `/admin/login` → NO debe estar el script.

## Riesgos y trade-offs

- **Free tier 10k events/mes**: ~330/día. Si el sitio explota a >10k visitas/día, hay que pasar al plan pago de Umami ($9/mes) o hacer self-host. Documentado.
- **Sin custom events en v1**: solo page views. Eventos como "quiz completado" o "topic creado" se pueden agregar después con `umami.track('event_name')` desde el cliente. Out of scope hoy.
- **Si Carlos cambia de proveedor**: el componente `UmamiScript.astro` es reemplazable en una línea. Sin lock-in real (los datos viven en Umami).

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/components/UmamiScript.astro` — nuevo, decide si inyectar el script.
- `metamorfosis-web/src/layouts/BaseLayout.astro` — importa y renderiza el componente en `<head>`.
- `metamorfosis-web/src/layouts/Layout.astro` — idem.
- `CLAUDE.md` — sección "Reglas inquebrantables" agregada con la convención `PUBLIC_UMAMI_WEBSITE_ID`.

**Decisiones tomadas en la marcha:**
- **`PUBLIC_*` env var**: Astro requiere ese prefijo para variables accesibles en el cliente / inline en HTML.
- **Component approach**: en lugar de hardcodear el script en cada layout, un componente con la lógica centralizada. Si en el futuro queremos cambiar a Plausible o GA4, una sola línea afectada.

**Sin desviaciones del plan funcional.**
