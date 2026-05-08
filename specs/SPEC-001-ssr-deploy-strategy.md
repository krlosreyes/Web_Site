# SPEC-001 — Resolver SSR + estrategia de deploy

**Estado:** 📝 Spec
**Fase:** 1
**Severidad:** CRÍTICO
**Fecha de creación:** 2026-05-08
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

- `package.json` no tiene ningún adaptador instalado (`@astrojs/vercel`, `@astrojs/node`, `@astrojs/cloudflare`, `@astrojs/netlify`, etc.). Astro 6 requiere adaptador para `output: 'server'`.
- `.github/workflows/deploy.yml` despliega `./dist/` por **FTP a Hostinger compartido**, que no ejecuta Node.

Resultado actual: o bien el build falla por falta de adaptador, o produce un bundle SSR que Hostinger no puede ejecutar. En cualquier caso, las rutas que dependen de SSR (`/api/*`, `/admin/*`, `/posts/[slug]`, `/biblioteca`, `/dashboard`, `/quiz` en parte) no están funcionando correctamente en producción.

## Problema

El sitio está desplegado en una infra que no soporta el modo de salida configurado, y no hay adaptador instalado. Hay que decidir el destino real y alinear `astro.config.mjs`, `package.json` y `deploy.yml`.

## Solución propuesta

**Opción recomendada: migrar a Vercel con `@astrojs/vercel`.**

Razones:
- Soporta SSR de Astro de forma nativa, sin servidor que mantener.
- Free tier suficiente para el tráfico actual del sitio.
- Variables de entorno (incluyendo `FIREBASE_PRIVATE_KEY` y `ADMIN_PASSWORD`) se manejan en el dashboard de Vercel — no hay que meterlas en GitHub Secrets.
- Despliegue automático por push a `main`; los previews en PR son útiles para futuras specs.
- ElenaApp ya está hosteado en `elena-app.vercel.app` (referencia en Navbar) — consolida el ecosistema en un solo proveedor.

**Alternativas consideradas y descartadas:**

| Opción | Por qué se descarta |
|---|---|
| Mantener Hostinger + `output: 'static'` | Habría que rehacer `/api/*` como Cloud Functions de Firebase y duplicar la lógica de auth. Las páginas con `prerender = false` que dependen de Firestore (`/biblioteca`, `/posts/[slug]`) tampoco quedan estáticas. Mucho retrabajo. |
| Hostinger Cloud / VPS + `@astrojs/node` | Tiene servidor Node, pero requiere mantener systemd/PM2, certificados, etc. Más operación de la que justifica el proyecto. |
| Netlify | Equivalente a Vercel; preferimos Vercel por consistencia con ElenaApp. |
| Cloudflare Pages | Funciona, pero el adaptador tiene limitaciones con Firebase Admin SDK (incompatibilidades con Workers runtime). Riesgo. |

## Plan de implementación

1. **Crear cuenta/proyecto en Vercel** vinculado al repo `krlosreyes2/Web_Site` (raíz: `metamorfosis-web/`).

2. **Instalar adaptador**:
   ```sh
   cd metamorfosis-web
   npx astro add vercel
   ```
   Esto agrega `@astrojs/vercel` a `package.json` y modifica `astro.config.mjs`.

3. **Verificar `astro.config.mjs`** quede así:
   ```js
   import { defineConfig } from 'astro/config';
   import tailwindcss from '@tailwindcss/vite';
   import react from '@astrojs/react';
   import vercel from '@astrojs/vercel';

   export default defineConfig({
     output: 'server',
     adapter: vercel({ /* webAnalytics opcional */ }),
     vite: { plugins: [tailwindcss()] },
     integrations: [react()],
   });
   ```
   Borrar el bloque `vite.server.fs.allow` (era para deps locales raros, no aplica en Vercel).

4. **Configurar variables de entorno en Vercel** (Settings → Environment Variables, scope Production + Preview):
   - `PUBLIC_FIREBASE_API_KEY`
   - `PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `PUBLIC_FIREBASE_PROJECT_ID`
   - `PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `PUBLIC_FIREBASE_APP_ID`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (con `\n` reales, Vercel preserva newlines)
   - `ADMIN_PASSWORD` (rotada antes de pegarla — ver SPEC de Fase 2)
   - `PUBLIC_CLOUD_FUNCTION_URL`

5. **Borrar `.github/workflows/deploy.yml`** (Vercel se ocupa del deploy; el workflow de FTP queda obsoleto).

6. **Configurar dominio**: si Hostinger sigue como DNS, apuntar el A/CNAME a Vercel. Si Hostinger es proveedor del dominio, dejar el DNS allí y solo apuntar a Vercel; si es solo hosting, mover el DNS también.

7. **Deploy de prueba** (preview en una rama):
   - Crear rama `chore/spec-001-vercel-migration` para no tocar main hasta que el preview funcione.
   - Push, esperar preview de Vercel.
   - Verificar criterios de aceptación contra la URL de preview.

8. **Merge a main** y promoción a producción.

9. **Cancelar/pausar plan de hosting Hostinger** (después de confirmar 1 semana de uptime en Vercel).

## Criterios de aceptación

- [ ] `npm run build` en local termina sin error.
- [ ] El preview de Vercel responde 200 en `/`, `/biblioteca`, `/quiz`, `/calculadora`, `/sobre-mi`, `/protocolo`.
- [ ] `GET /api/admin/posts` sin cookie devuelve 401 (no 404 ni 500).
- [ ] `GET /posts/<slug-existente>` renderiza el artículo con datos reales de Firestore.
- [ ] `/admin/login` carga, y un POST a `/api/admin/login` con password correcto setea cookie y redirige.
- [ ] `import.meta.env.MODE === 'production'` en preview.
- [ ] Logs de Vercel muestran "✅ Firebase Admin SDK initialized successfully." al primer request server-side.
- [ ] Tiempo de cold start aceptable (< 2s en preview).
- [ ] El workflow `.github/workflows/deploy.yml` ya no existe.

## Pruebas

```sh
# Local
cd metamorfosis-web
npm run build         # debe terminar sin error
npm run preview       # levanta servidor SSR local

# Contra preview en otra terminal
PREVIEW=https://metamorfosis-web-git-chore-spec-001-<...>.vercel.app
curl -sI $PREVIEW/                       # 200
curl -sI $PREVIEW/api/admin/posts        # 401
curl -sI $PREVIEW/biblioteca             # 200
curl -s $PREVIEW/api/calculate-imr -X POST -H 'Content-Type: application/json' \
    -d '{"heightCm":175,"currentWeightKg":75,"waistCircumferenceCm":85,"neckCircumferenceCm":38,"age":35,"gender":"male"}'
# Esperado: 200 con { success: true, result: {...}, metadata: {...} }
```

## Riesgos / consideraciones

- **`FIREBASE_PRIVATE_KEY` con newlines.** Vercel los preserva, pero si se pega como string-con-`\\n` el código de `firebaseAdmin.ts` ya hace `replace(/\\n/g, '\n')` así que ambos formatos funcionan. Verificar logs al primer request.
- **Cold starts.** Las APIs SSR en Vercel son serverless functions; primer hit puede ser lento. Si afecta UX, considerar `prerender = true` en páginas que no necesitan SSR (`/sobre-mi`, `/terminos`, `/privacidad`, `/quiz` parte estática) en una spec posterior.
- **DNS propagación.** Si se cambia DNS, dejar TTL bajo (300s) las 48h previas.
- **Costo.** Free tier de Vercel cubre ~100GB de bandwidth/mes y 100s de execution time. Suficiente para el sitio actual; revisar si tráfico crece.
- **Rollback.** Si algo falla en producción, basta con re-habilitar el workflow de FTP y forzar `output: 'static'`. Documentar este plan B en `docs/rollback.md` (futura spec).

## Commit

**Mensaje sugerido:**
```
feat(spec-001): migrar deploy a Vercel con adaptador SSR

- Instalar @astrojs/vercel y configurar adaptador en astro.config.mjs
- Eliminar .github/workflows/deploy.yml (FTP a Hostinger ya no aplica)
- Limpiar vite.server.fs.allow obsoleto
- Variables de entorno migradas al dashboard de Vercel

Cierra specs/SPEC-001-ssr-deploy-strategy.md
```

---

## Resultado

*(Pendiente de implementación.)*
