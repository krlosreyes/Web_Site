# SPEC-111 — Migración de dominio: `metamorfosisvital.com.co` → `metamorfosisreal.org`

**Estado:** 🔨 En progreso (Fase A iniciada 2026-05-25)
**Fase:** 4 (Operación / Crecimiento)
**Severidad:** 🟡 Alta operativa (downtime/SEO si se ejecuta mal; reversible)
**Fecha de creación:** 2026-05-25
**Autor:** Carlos Reyes (vía agente Cowork)
**Depende de:** SPEC-027 (SEO técnico), SPEC-029 (Resend), SPEC-052b (Astro.site), SPEC-108 (canonical/OG correctos + GSC verification), SPEC-110 (README real)

---

## Contexto

El producto se llama **Metamorfosis Real**: nombre que comparten el canal de
YouTube, ElenaApp, la copy del sitio, y la presencia en redes. El dominio
actual `metamorfosisvital.com.co` es un mismatch heredado: tiene "vital" en
lugar de "real" y carga el TLD `.com.co` (Colombia-coded) cuando la
audiencia objetivo es hispanoamericana completa.

Carlos compró el 2026-05-25 el dominio **`metamorfosisreal.org`** vía
Hostinger. `.org` matchea el brand exacto, es voice-friendly (sin guión, sin
sufijo defensivo "oficial"), y suma credibilidad para un proyecto con fuerte
componente educacional (YouTube + biblioteca de artículos científicos basados
en literatura revisada). El dominio actual `.com.co` se mantiene activo hasta
**julio 2026** (fin del plan) como redirector 301.

## Problema

Migrar un sitio en producción significa coordinar cambios entre **código
del repo** (paths absolutos, sender de emails, sitemap, schema.org, token
GSC) y **6 servicios externos** (Hostinger Node.js App, Hostinger DNS,
Firebase Auth, Resend, Umami, Google Search Console). Si la coordinación
falla:

- Login con Firebase rompe al no autorizar el dominio nuevo.
- Resend rechaza envíos del welcome email por DKIM/SPF no verificado.
- Google ve dos URLs canonical distintas y penaliza por contenido duplicado.
- Backlinks externos (descripciones de YouTube, redes, conversaciones) se
  rompen sin redirect 301.
- Cookies de admin (`admin_session`) emitidas por el `.com.co` no aplican al
  `.org` por restricción de Domain attribute.
- Previews OG en redes sociales muestran caché del dominio viejo.

## Solución propuesta — Migración en 2 fases

### Fase A — Preparación (sin afectar producción)

**Por el agente (commits LOCALES, sin push):**
- `astro.config.mjs`: `site: 'https://www.metamorfosisreal.org'`.
- `public/robots.txt`: `Sitemap: https://www.metamorfosisreal.org/sitemap.xml`.
- `src/pages/sitemap.xml.ts`: `BASE_URL = 'https://www.metamorfosisreal.org'`.
- `src/pages/posts/[slug].astro:164`: `url: 'https://www.metamorfosisreal.org'`
  en el JSON-LD del publisher.
- `src/lib/email.ts:16`: `FROM = 'Metamorfosis Real <hola@metamorfosisreal.org>'`.
- `src/lib/email.ts`: 7 URLs absolutas (`/dashboard`, `/biblioteca`,
  `/comunidad`, `/dashboard/plan`, footer disclaimer) al `.org`.
- `src/layouts/BaseLayout.astro`: comentarios actualizados (líneas 71-93).
- `src/pages/terminos.astro:33`: "metamorfosisvital.com.co" → "metamorfosisreal.org".
- `src/pages/api/admin/diagnose-click.ts:18`: comentario con URL de curl ejemplo.
- `scripts/verify-spec-108.sh`: `BASE` al `.org` (más rename del script a
  `verify-prod.sh` para que no quede atado a una sola spec).
- `metamorfosis-web/README.md`: URL de producción al `.org`.

**Por Carlos (en paralelo, paneles externos):**
1. **Hostinger hPanel:** agregar `metamorfosisreal.org` como dominio del
   Node.js App existente. NO crear app nueva. Activar SSL (Let's Encrypt
   automático cuando detecta DNS).
2. **Resend:** agregar dominio `metamorfosisreal.org`, copiar los DNS records
   DKIM/SPF que Resend genera, pegarlos en el panel de DNS de Hostinger.
   **Esperar verificación (~24-48h).**
3. **Firebase Console:** Authentication → Settings → Authorized domains →
   agregar `metamorfosisreal.org` y `www.metamorfosisreal.org`. Instantáneo.
4. **Umami cloud:** Settings del website → agregar dominio nuevo
   (o crear nuevo site si la versión del plan lo requiere).
5. **Google Search Console:** crear nueva propiedad con el dominio
   `https://www.metamorfosisreal.org/`, obtener el token de verificación
   método "Meta tag" y compartirlo conmigo para hardcodearlo (SPEC-108b
   pattern). Verificación se completa una vez deployado el código en Fase B.

### Fase B — Cutover (cuando Resend confirme verificación)

1. **[ME]** Reemplazar el token GSC en `BaseLayout.astro` por el nuevo de la
   propiedad del `.org`.
2. **[ME]** Commit final + dejarle a Carlos las instrucciones de push.
3. **[CARLOS]** `git push origin main` → Hostinger auto-deploy ~90-120s.
4. **[ME]** Verificar producción con curl:
   - `curl https://www.metamorfosisreal.org/ → 200`
   - `canonical/og:url/sitemap` muestran `.org` (no `.com.co`)
   - `<meta google-site-verification>` con token nuevo
5. **[CARLOS]** GSC nueva propiedad: completar verificación → submit
   `sitemap.xml` → request indexing de 5 URLs (`/`, `/imr`, `/biblioteca`,
   `/quiz`, `/sobre-mi`).
6. **[CARLOS]** Hostinger hPanel del dominio `.com.co`: configurar
   **redirect 301 permanente** a `https://www.metamorfosisreal.org/$1`
   preservando path. Esto vive en el panel de Hostinger, NO en código —
   mantiene el redirect aún si el `.com.co` deja de servir el Node.js App.
7. **[CARLOS]** Re-scrape OG: Facebook Sharing Debugger + LinkedIn Post
   Inspector + Twitter Card Validator para forzar refresh del cache del
   dominio nuevo.

### Post-cutover (1-2 semanas)

- Monitorear GSC cobertura del `.org` — confirmar que las 5 URLs pasan a
  "Indexada".
- Monitorear Umami para confirmar tráfico se ve en el nuevo dominio.
- Spam check de Resend logs: confirmar que welcomes salen sin bounces.
- Sub-spec opcional para sweep de docs internos (`docs/PI-STRATEGY.md`,
  `docs/LEGAL-CHECKLIST.md`, `docs/ACQUISITION-FIRST-100.md`,
  `docs/PLAN-2026-05-12.md`) — NO afectan al sitio, son notas internas.

### Julio 2026 (fin del plan `.com.co`)

- El dominio `.com.co` expira. El redirect 301 en Hostinger panel deja de
  funcionar. Backlinks externos al `.com.co` rompen.
- Para entonces, el grueso del SEO del `.org` ya debería estar consolidado
  (Google sigue 301s y traspasa autoridad).
- Si querés extender el `.com.co` un año más por seguridad, costo bajo
  (~$25 USD).

## Criterios de aceptación

**Código:**
- [ ] `grep -rIn "metamorfosisvital" metamorfosis-web/src/ metamorfosis-web/public/ metamorfosis-web/scripts/` → 0 resultados.
- [ ] `grep -rIn "metamorfosisvital" specs/` → solo las refs históricas de specs cerradas (no se tocan).
- [ ] `npm run build` desde `metamorfosis-web/` pasa sin errores nuevos.

**Post-deploy:**
- [ ] `curl -H "User-Agent: Chrome..." https://www.metamorfosisreal.org/` → 200.
- [ ] `curl https://www.metamorfosisreal.org/ | grep -oE '(canonical|og:url)[^"]*"[^"]+"'` muestra `.org`.
- [ ] `curl https://www.metamorfosisreal.org/sitemap.xml | head` muestra URLs del `.org`.
- [ ] `curl -I https://www.metamorfosisvital.com.co/` → `301 Moved Permanently`, `Location: https://www.metamorfosisreal.org/`.
- [ ] `curl -I https://www.metamorfosisvital.com.co/quiz` → `301`, `Location: https://www.metamorfosisreal.org/quiz` (path preservation).
- [ ] Login con Firebase en `.org` funciona end-to-end.
- [ ] Registro disparar welcome email desde `hola@metamorfosisreal.org` sin caer en spam.
- [ ] Umami captura visita en el dominio nuevo.

**Validación externa (1-7 días):**
- [ ] GSC: 5 URLs pasan a "Indexada".
- [ ] Facebook Sharing Debugger: preview del `.org` con OG image correcta.

## Riesgos / consideraciones

- **DNS propagation:** desde que se configura el DNS hasta que resuelve
  globalmente puede tardar 2-24h. Hostinger suele propagar rápido si el
  dominio está registrado con ellos (≈1h).
- **SSL Let's Encrypt:** se emite automáticamente después de DNS, ~5-15 min.
  Hasta entonces el sitio en `.org` da error SSL.
- **Resend verification:** los DNS records DKIM/SPF tardan más en propagar
  (TXT records). Plan: **NO** cambiar el `FROM` del email hasta que Resend
  marque el dominio como "Verified". El sender del `.com.co` sigue válido
  durante la espera porque ese dominio sigue verificado en Resend.
  
  **Detalle de la coordinación:** el commit que cambia `FROM` se hace en
  Fase A pero NO se pushea hasta Fase B (post-verificación). Si por
  apuro se pushea antes, los welcomes rebotan y los users nuevos no
  reciben el email — bug silencioso porque el sistema no tira excepción.
- **Cookies admin:** `admin_session` actual sólo aplica al `.com.co`. Tras
  cutover, las sesiones admin abiertas se invalidan (Carlos debe re-login
  en el `.org`). Esperado y aceptable.
- **Cache del browser/CDN:** Hostinger HCDN puede servir caché del
  `.com.co` por un rato. Force-refresh + DevTools sin caché para verificar.
- **Email `metamorfosisvitaloficial@gmail.com`:** decisión pendiente de
  Carlos (ver sección "Pendientes de decisión").

## Pendientes de decisión

**Email personal de soporte (Gmail, no Resend):**

7 referencias en footer + terminos + privacidad + disclaimer-medico. Si
Carlos crea `metamorfosisrealoficial@gmail.com`, hacemos el sweep en este
mismo commit. Si lo deja como está, queda pendiente para sub-spec con
fecha futura (sin costo SEO ni operativo — es solo cosmético/branding).

## Plan de implementación de Fase A (HOY)

1. Crear `specs/SPEC-111-migracion-dominio-metamorfosisreal-org.md`
   (este archivo).
2. Sweep + edits en código (lista en sección Fase A arriba).
3. `npm run build` desde `metamorfosis-web/` — confirmar limpio.
4. Commit local con mensaje
   `feat(spec-111-fase-a): migracion dominio — bundle de cambios de codigo`.
   **NO push** hasta Fase B.
5. Entregar a Carlos el checklist de tareas externas.

## Commit Fase A (sugerido)

```
feat(spec-111-fase-a): migracion dominio metamorfosisreal.org — bundle codigo

Fase A de la migracion del dominio. Cambios de codigo listos para deploy
pero NO se pushea hasta que Carlos confirme:
- DNS del .org propagado y SSL activo en Hostinger
- Resend dominio metamorfosisreal.org verificado (DKIM/SPF OK)
- Firebase Authorized domains incluye el .org
- GSC nueva propiedad creada con token disponible

Archivos modificados:
- astro.config.mjs: site al .org
- public/robots.txt: sitemap al .org
- src/pages/sitemap.xml.ts: BASE_URL al .org
- src/pages/posts/[slug].astro: schema.org url al .org
- src/lib/email.ts: FROM + 7 links absolutos al .org
- src/layouts/BaseLayout.astro: comentarios actualizados
- src/pages/terminos.astro: 1 mencion del dominio
- src/pages/api/admin/diagnose-click.ts: comentario curl example
- scripts/verify-spec-108.sh: renombrado a verify-prod.sh + BASE al .org
- README.md: URL de produccion al .org

Token GSC del .org se actualizara en commit separado de Fase B
una vez Carlos comparta el token de la nueva propiedad.

Pendiente sub-spec: sweep de docs/ internos (PI-STRATEGY, LEGAL,
ACQUISITION, PLAN) — no afectan al sitio.

Cierra Fase A de specs/SPEC-111-migracion-dominio-metamorfosisreal-org.md
```

---

## Resultado

Fase A: 🔨 en progreso 2026-05-25.
Fase B: pendiente.
