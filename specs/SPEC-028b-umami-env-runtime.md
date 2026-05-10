# SPEC-028b — Umami env var en runtime (fix dashboard vacío)

**Estado:** ✅ Cerrada
**Fase:** Post-Fase 4 — fix sobre SPEC-028
**Severidad:** ALTO (analytics no funcionaba en prod)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-028 (analytics Umami)

---

## Contexto

Después de implementar SPEC-028, configurar Umami cloud y setear
`PUBLIC_UMAMI_WEBSITE_ID` en Hostinger, el dashboard de Umami seguía vacío.
View-source del sitio NO mostraba el `<script>` de Umami en `<head>`.

## Causa raíz

`UmamiScript.astro` leía la env var con `import.meta.env.PUBLIC_UMAMI_WEBSITE_ID`.

**Gotcha de Astro:** las variables `import.meta.env.PUBLIC_*` se reemplazan
estáticamente **en tiempo de build** (`astro build`), no en tiempo de request.
Si la env var no estaba presente cuando Hostinger compiló el bundle (el push
inicial corrió antes de que estuviera seteada en Hostinger), el bundle
compilado contiene `websiteId = undefined` y reiniciar el server NO cambia
nada — la única forma de recuperar es disparar un rebuild completo.

Este es un patrón frágil porque depende de un orden estricto:
1. Setear env var en Hostinger
2. Recién después, hacer push para que el build use la env var

Si el orden se invierte una sola vez, hay que acordarse de redeploy manual.

## Solución

Bajo SSR (`output: 'server'`), el frontmatter de los `.astro` corre en el
server Node en cada request. Eso significa que `process.env.X` se evalúa
en **runtime**, no en build, y refleja el estado actual de las env vars de
Hostinger.

Cambio: leer `process.env.PUBLIC_UMAMI_WEBSITE_ID` primero, con fallback
a `import.meta.env.PUBLIC_UMAMI_WEBSITE_ID` para escenarios build-time-only
(ej. `astro dev` local donde `process.env` puede no tener `PUBLIC_*` cargado
si dotenv no corre).

Misma lógica para `import.meta.env.PROD`: agregamos fallback a
`process.env.NODE_ENV === 'production'` para que el guard de "solo prod"
siga funcionando aunque Astro inline una versión vieja.

## Plan de ejecución

1. Editar `metamorfosis-web/src/components/UmamiScript.astro`:
   - `websiteId = process.env.PUBLIC_UMAMI_WEBSITE_ID || import.meta.env.PUBLIC_UMAMI_WEBSITE_ID`
   - `isProd = process.env.NODE_ENV === 'production' || import.meta.env.PROD`
   - Comentar el porqué con referencia a esta SPEC.
2. Actualizar nota en `CLAUDE.md` mencionando este gotcha.
3. Build + commit + push.
4. Verificar post-deploy con `curl https://metamorfosisvital.com.co/ | grep umami`.

## Criterios de aceptación

- [x] `UmamiScript.astro` lee la env var primero con `process.env.*`.
- [x] Fallback a `import.meta.env.*` para entornos sin runtime env.
- [x] Mismo guard de `isProd` con fallback runtime.
- [x] Comentario en el componente explica el por qué.
- [x] Build local pasa sin errores.
- [x] CLAUDE.md actualizado con el gotcha.

## Pruebas manuales

1. Después del push y deploy (~90-120s):
   ```bash
   curl -s https://metamorfosisvital.com.co/ | grep -o 'cloud.umami.is/script.js'
   ```
   Debe imprimir la URL del script.
2. View-source en navegador → `<head>` contiene `<script ... data-website-id="...">`.
3. Visita en incógnito → en Umami dashboard aparece el hit en ~30s.
4. Visitar `/admin/login` → NO debe inyectar el script (el guard isAdminPath
   sigue funcionando porque corre en runtime también).

## Riesgos y trade-offs

- **`process.env` no está tipado en TS para keys arbitrarias**: aceptable,
  retorna `string | undefined` y nuestro `||` lo maneja.
- **Si Hostinger no expone la env var al runtime de Node**: dudaríamos, pero
  por defecto Node lee `process.env` desde el entorno del proceso, que es
  exactamente lo que Hostinger inyecta. Confirmado funcionar con otras envs
  (FIREBASE_*, SESSION_*).
- **Fallback a `import.meta.env`**: si en algún build futuro alguien setea
  la env var solo en build y no en runtime, el fallback sigue funcionando.
  No hay downside.

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/components/UmamiScript.astro` — patrón
  `process.env || import.meta.env` para `websiteId` y `isProd`.
- `CLAUDE.md` — nota actualizada sobre el gotcha runtime vs build-time.

**Decisión:** patrón híbrido (runtime preferido, build-time fallback) en vez
de runtime puro. Esto cubre tanto SSR en Hostinger como `astro dev` local,
sin requerir cambios en el flujo de desarrollo.

Sin desviaciones del plan.
