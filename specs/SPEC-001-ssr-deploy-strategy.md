# SPEC-001 — Resolver SSR + estrategia de deploy

**Estado:** 📝 Spec
**Fase:** 1
**Severidad:** CRÍTICO
**Fecha de creación:** 2026-05-08
**Última revisión:** 2026-05-09 (cambio de proveedor: Vercel → Hostinger Node.js Apps)
**Autor:** Carlos Reyes
**Depende de:** ninguna (bloquea SPEC-002, 003, 004, 005)

---

## Contexto

`metamorfosis-web/astro.config.mjs:11` está configurado como:

```js
export default defineConfig({
  output: 'server',  // SSR
  vite: { plugins: [tailwindcss()], server: { fs: { allow: [...] } } },
  integrations: [react()]
});
```

Pero:

- `package.json` no tiene ningún adaptador instalado. Astro 6 requiere adaptador para `output: 'server'`.
- `.github/workflows/deploy.yml` despliega `./dist/` por **FTP a Hostinger**, modo estático.

Resultado actual: el build falla por falta de adaptador, o produce un bundle SSR que Hostinger no puede ejecutar como estático. En cualquier caso, las rutas que dependen de SSR (`/api/*`, `/admin/*`, `/posts/[slug]`, `/biblioteca`, `/dashboard`, `/quiz`) no están funcionando en producción.

**Restricciones del proyecto** (input del usuario, 2026-05-09):
- Hosting actual: **Hostinger Business Web Hosting** (plan ya pagado, `metamorfosisvital.com.co`).
- Prioridad: **quedarse en Hostinger sin gastar más**.

**Hallazgo decisivo:** Hostinger Business incluye **"Node.js Apps"** en hPanel desde 2025-2026. Permite deploy automático desde GitHub o subida ZIP, con detección automática de framework (Vite, Next.js, Vue, React; Astro funciona vía `@astrojs/node`). Verificado en panel del usuario el 2026-05-09.

## Problema

El sitio está configurado para SSR pero desplegado como estático. Hay que (a) instalar el adaptador correcto para correr Node.js, (b) usar el "Node.js Apps" de hPanel en lugar del flujo FTP, y (c) ajustar el workflow de GitHub para que no compita con el deploy nativo de Hostinger.

## Solución propuesta

**Migrar el sitio a Hostinger "Node.js Apps" (mismo plan Business actual) con `@astrojs/node` en modo standalone, deploy automático conectado al repo de GitHub.**

Razones:
- Plan ya pagado; cero costo adicional.
- Un solo proveedor para dominio, DNS, email, hosting → menos cuentas que mantener.
- Deploy auto-conectado a GitHub: push a `main` dispara build + deploy en hPanel sin GitHub Actions de por medio.
- `@astrojs/node` es portable: si más adelante decides salir de Hostinger (Vercel, VPS, etc.), el código no cambia, solo el adaptador.
- ElenaApp puede seguir donde esté; este sitio es independiente.

**Alternativas consideradas y descartadas:**

| Opción | Por qué se descarta |
|---|---|
| Vercel + `@astrojs/vercel` | Funciona perfecto, pero implica un segundo proveedor y cuenta. Para tu volumen actual el free tier alcanza, pero no compensa el costo cognitivo si Hostinger ya hace lo mismo. |
| Mantener Hostinger + `output: 'static'` | Habría que rehacer `/api/*` como Cloud Functions de Firebase y duplicar la lógica de auth. Páginas con `prerender = false` que dependen de Firestore tampoco quedan estáticas. Mucho retrabajo. |
| Hostinger VPS + `@astrojs/node` | Funciona, pero requiere upgrade de plan + mantener PM2/systemd/certificados. La "Node.js App" de Business hace lo mismo gestionado. |
| Cloudflare Pages + `@astrojs/cloudflare` | Workers runtime tiene incompatibilidades conocidas con `firebase-admin`. Riesgo. |
| Firebase Hosting + Cloud Functions | Coherente con el stack Firebase, pero adapter `@astrojs/firebase` no es oficial y el flujo de deploy es más complejo. |

## Plan de implementación

### Fase A — Preparar el repo

1. **Instalar `@astrojs/node`** en modo standalone:
   ```sh
   cd metamorfosis-web
   npx astro add node
   ```
   Cuando pregunte el modo, elegir **"standalone"**. Esto modifica `astro.config.mjs`.

2. **Verificar `astro.config.mjs`** quede así (limpiando además el `vite.server.fs.allow` obsoleto):
   ```js
   import { defineConfig } from 'astro/config';
   import tailwindcss from '@tailwindcss/vite';
   import react from '@astrojs/react';
   import node from '@astrojs/node';

   export default defineConfig({
     output: 'server',
     adapter: node({ mode: 'standalone' }),
     vite: { plugins: [tailwindcss()] },
     integrations: [react()],
   });
   ```

3. **Verificar `package.json`** tiene Node engine correcto y script de start:
   ```json
   {
     "engines": { "node": ">=20.0.0" },
     "scripts": {
       "dev": "astro dev",
       "build": "astro build",
       "preview": "astro preview",
       "start": "node ./dist/server/entry.mjs",
       "astro": "astro"
     }
   }
   ```
   El script `start` es lo que Hostinger ejecuta tras el build. Standalone genera `dist/server/entry.mjs` y respeta `process.env.PORT` (que Hostinger inyecta).

4. **Probar build local** antes de tocar Hostinger:
   ```sh
   cd metamorfosis-web
   npm install
   npm run build
   PORT=4321 npm start &
   sleep 2
   curl -sI http://localhost:4321/        # 200
   curl -sI http://localhost:4321/api/admin/posts   # 401 (auth) o 200/500 según estado actual
   kill %1
   ```
   Si el build falla, resolver antes de seguir.

5. **Eliminar `.github/workflows/deploy.yml`** — el deploy de Hostinger se gestiona desde hPanel, ya no por GitHub Actions.

6. **Commit + push** de los cambios anteriores.

### Fase B — Configurar Hostinger Node.js App

7. **En hPanel → Sitios web → "Despliega tu app web Node.js" → Empezar ya.**

8. **Conectar GitHub.** Autorizar la app de Hostinger sobre el repo `krlosreyes2/Web_Site` (idealmente solo ese repo, no la organización entera).

9. **Configurar la app Node:**
   - **Branch:** `main`
   - **Root directory / Path del proyecto:** `metamorfosis-web` (porque el `package.json` está en subdirectorio)
   - **Node version:** 20 LTS (o la más alta disponible compatible con Astro 6)
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start` (que es `node ./dist/server/entry.mjs`)
   - **Auto-deploy on push to main:** ON

10. **Variables de entorno** (en hPanel, no en `.env` ni en GitHub Secrets):
    - `PUBLIC_FIREBASE_API_KEY`
    - `PUBLIC_FIREBASE_AUTH_DOMAIN`
    - `PUBLIC_FIREBASE_PROJECT_ID`
    - `PUBLIC_FIREBASE_STORAGE_BUCKET`
    - `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
    - `PUBLIC_FIREBASE_APP_ID`
    - `FIREBASE_PROJECT_ID`
    - `FIREBASE_CLIENT_EMAIL`
    - `FIREBASE_PRIVATE_KEY` (con `\n` reales — pegar el bloque completo)
    - `ADMIN_PASSWORD` (rotada antes de pegarla — ver SPEC futura de Fase 2)
    - `PUBLIC_CLOUD_FUNCTION_URL`
    - `NODE_ENV=production`
    - **No setear `PORT`**: Hostinger lo inyecta.

11. **Asignar dominio.** En la sección de la app Node.js, asociar `metamorfosisvital.com.co`. Si el sitio estático actual está usando ese dominio, hay que des-asignarlo del sitio estático y asignarlo a la app Node. Esto puede tener unos minutos de downtime — agendar la migración a una hora de bajo tráfico.

12. **Primer deploy.** Hacer push del commit con los cambios (o disparar deploy manual desde hPanel). Ver los build logs en tiempo real.

### Fase C — Verificar y limpiar

13. **Probar contra el dominio real** (ver criterios de aceptación).

14. **Eliminar el "Sitio web estático" antiguo** desde hPanel una vez confirmado que el Node app funciona ≥ 24h.

15. **Anotar el dashboard de Node.js** (CPU, RAM, IO) para tener una baseline. Si la app excede consistentemente los recursos del plan Business, considerar el upgrade en una spec futura.

## Criterios de aceptación

- [ ] `npm run build` en local termina sin error.
- [ ] `npm start` en local sirve el sitio en `http://localhost:4321`.
- [ ] Hostinger Node.js App conectada al repo `krlosreyes2/Web_Site`, branch `main`, root `metamorfosis-web`.
- [ ] Push a `main` dispara build + deploy automático en hPanel; logs visibles.
- [ ] `https://metamorfosisvital.com.co/` responde 200 y renderiza la home.
- [ ] `https://metamorfosisvital.com.co/biblioteca` lista artículos reales desde Firestore (no página vacía).
- [ ] `https://metamorfosisvital.com.co/posts/<slug-real>` renderiza un artículo.
- [ ] `https://metamorfosisvital.com.co/api/admin/posts` sin cookie devuelve 401 (no 404 ni HTML).
- [ ] `https://metamorfosisvital.com.co/admin/login` carga el form.
- [ ] El log de Hostinger muestra "✅ Firebase Admin SDK initialized successfully." en el primer request server-side.
- [ ] El workflow `.github/workflows/deploy.yml` ya no existe.
- [ ] La app aparece en hPanel → Node.js dashboard con métricas vivas.

## Pruebas

```sh
# Local — pre-deploy
cd metamorfosis-web
npm install
npm run build
PORT=4321 npm start &
sleep 3
curl -sI http://localhost:4321/                     # 200
curl -sI http://localhost:4321/biblioteca           # 200
curl -sI http://localhost:4321/api/admin/posts      # 401
curl -s http://localhost:4321/api/calculate-imr -X POST \
    -H 'Content-Type: application/json' \
    -d '{"heightCm":175,"currentWeightKg":75,"waistCircumferenceCm":85,"neckCircumferenceCm":38,"age":35,"gender":"male"}' \
    | python3 -m json.tool
# Esperado: { success: true, result: {...}, metadata: {...} }
kill %1

# Producción — post-deploy
SITE=https://metamorfosisvital.com.co
curl -sI $SITE/                       # 200
curl -sI $SITE/biblioteca             # 200
curl -sI $SITE/api/admin/posts        # 401
curl -s $SITE/api/calculate-imr -X POST \
    -H 'Content-Type: application/json' \
    -d '{"heightCm":175,"currentWeightKg":75,"waistCircumferenceCm":85,"neckCircumferenceCm":38,"age":35,"gender":"male"}'
```

## Riesgos / consideraciones

- **Limites del plan Business.** Hostinger Business tiene cuotas de RAM/CPU/IO compartidas. Astro SSR + Firebase Admin no debería pasarse para tu volumen, pero hay que monitorear el dashboard de Node.js los primeros días. Si hay throttling, se evalúa upgrade a Cloud o VPS en spec aparte.
- **`FIREBASE_PRIVATE_KEY` con newlines.** Pegar el bloque completo (`-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----`) en hPanel respetando saltos de línea reales. El código en `firebaseAdmin.ts` ya hace `replace(/\\n/g, '\n')`, así que ambos formatos funcionan; preferible newlines reales.
- **Cold starts.** Hostinger gestiona el proceso Node como long-running (no serverless). En teoría no hay cold starts después del primer arranque, pero si el supervisor reinicia por inactividad o por límite de memoria, sí los habría. Monitorear.
- **Downtime durante el cambio de dominio.** Reasignar `metamorfosisvital.com.co` del sitio estático a la app Node puede tener 5-15 minutos de propagación interna en Hostinger. Comunicar antes y elegir horario tranquilo.
- **DNS.** El dominio ya está apuntando a Hostinger, así que el cambio de A/CNAME no es necesario. La reasignación interna basta.
- **Rollback.** Si el deploy nuevo falla, hPanel permite volver a un build anterior. El sitio estático se puede mantener "pausado" durante la primera semana como red de seguridad.
- **Logs y debugging.** Hostinger expone build logs y runtime logs en hPanel. Acceso vía SSH al filesystem de la app suele estar limitado en planes compartidos — confirmar al primer issue.
- **Watcher de archivos / hot reload.** Standalone modo no tiene hot reload en producción (esperado). En desarrollo se sigue usando `npm run dev`.

## Commit

**Mensaje sugerido:**
```
feat(spec-001): adaptador Node + deploy en Hostinger Node.js Apps

- Instalar @astrojs/node en modo standalone
- Limpiar vite.server.fs.allow obsoleto en astro.config.mjs
- Agregar engines.node y script start en package.json
- Eliminar .github/workflows/deploy.yml (ahora deploy gestionado por
  hPanel conectado a GitHub)

Variables de entorno migradas al panel de Hostinger; ya no se inyectan
desde GitHub Secrets.

Cierra specs/SPEC-001-ssr-deploy-strategy.md
```

---

## Resultado

*(Pendiente de implementación.)*
