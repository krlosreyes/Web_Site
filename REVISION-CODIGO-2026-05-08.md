# Revisión de Código — Metamorfosis Real (sitio web)

**Fecha:** 8 de mayo de 2026
**Alcance:** Auditoría general de código y calidad de `metamorfosis-web` (Astro 6 + React 19 + Firebase + Tailwind 4)
**Revisor:** Claude (Cowork)

---

## Resumen ejecutivo

El proyecto tiene una arquitectura interesante (Astro SSR + Firebase Admin + paneles admin), pero hay **un problema de despliegue que probablemente está rompiendo el sitio en producción** y **varios bugs de seguridad y consistencia** que conviene resolver antes de seguir agregando features.

El más urgente: el sitio está configurado como `output: 'server'` (SSR) pero se despliega por FTP a Hostinger sin adaptador Node — esa combinación no funciona. Cualquier ruta dinámica (`/biblioteca`, `/posts/[slug]`, todo `/api/*`, todo `/admin/*`) deja de servirse correctamente.

A continuación, el detalle agrupado por severidad.

---

## CRÍTICO (rompen funcionalidad o exponen datos)

### 1. SSR sin adaptador + deploy a hosting estático
- `astro.config.mjs` define `output: 'server'` (con un comentario que menciona Vercel SSR).
- `package.json` **no incluye ningún adaptador** (`@astrojs/vercel`, `@astrojs/node`, `@astrojs/cloudflare`, etc.).
- `.github/workflows/deploy.yml` despliega `./dist/` por FTP a Hostinger compartido — un servidor que no ejecuta Node.
- Esta combinación no es viable: con `output: 'server'` Astro genera un server entry point (`dist/server/entry.mjs`) que requiere un runtime Node corriendo. Hostinger compartido vía FTP solo sirve archivos estáticos. Resultado: las rutas SSR (`/api/*`, `/admin/*`, `/posts/[slug]`, `/biblioteca`, `/dashboard`) no funcionan, o el build directamente falla por falta de adaptador.

**Decisión a tomar (una de tres):**
- (a) Migrar a Vercel/Netlify con `@astrojs/vercel` y mover el deploy ahí.
- (b) Migrar a un VPS/servidor Node y agregar `@astrojs/node`.
- (c) Cambiar a `output: 'static'` y rehacer las rutas que requieren SSR como funciones Firebase Cloud Functions o como JS cliente con Firebase directo.

### 2. Endpoint admin sin autenticación
- `src/pages/api/admin/cleanup.ts` borra documentos de `metamorfosis_posts` (cualquiera con `slug.length > 200`) y **no verifica autenticación**. Cualquier visitante puede llamar `GET /api/admin/cleanup` y disparar borrados.
- Hay que envolverlo igual que `posts.ts`/`leads.ts`/`stats.ts` con `enforceProductionSecurity()` + `isAuthenticatedFromCookie(parseCookies(request))`.

### 3. Flujo de autenticación admin roto e inconsistente
Hay tres rutas que validan la sesión admin de forma distinta y no compatibles entre sí:

| Lugar | Cookie esperada |
|---|---|
| `src/pages/admin/login.astro` | `value === ADMIN_PASSWORD` (string raw) |
| `src/pages/admin/dashboard.astro` | `value === ADMIN_PASSWORD` (string raw) |
| `src/components/Footer.astro` | `value === 'firebase_auth' \|\| value === ADMIN_PASSWORD` |
| `src/lib/auth.ts → isAuthenticatedFromCookie` (usado por todos los `/api/admin/*`) | constant-time vs `ADMIN_PASSWORD` |
| `src/pages/api/admin/login.ts` (POST) | **emite cookie con valor `firebase_auth`** vía `createSecureSessionCookie('firebase_auth')` |
| `src/components/admin/AdminLogin.tsx` | hace login Firebase en cliente y luego setea `document.cookie = admin_session=<adminCode>` con el valor que el usuario tipea en el form |

Consecuencia: el endpoint `/api/admin/login` emite una cookie `firebase_auth` que **ningún consumidor server-side acepta** (las APIs admin esperan `ADMIN_PASSWORD`, no `firebase_auth`). El componente `AdminLogin` del frontend ni siquiera llama al endpoint — guarda la cookie del lado cliente sin `HttpOnly`, sin `Secure`, sin `SameSite`, y sin rate limit.

**Recomendación:** decidir un único contrato (sugerido: el del `auth.ts` con cookie `HttpOnly` emitida por servidor). Cambiar `AdminLogin.tsx` para llamar a `POST /api/admin/login`, y unificar todas las verificaciones server-side a `isAuthenticatedFromCookie`. Eliminar la comparación raw `=== ADMIN_PASSWORD` en `admin/login.astro`, `admin/dashboard.astro` y `Footer.astro`.

### 4. `/api/calculate-imr` permite escribir en posts arbitrarios sin auth
```ts
if (data.recordId) {
  const docRef = db.collection('metamorfosis_posts').doc(data.recordId);
  await docRef.set({ metadata, imr_report, last_calculation_type: 'IMR_V01' }, { merge: true });
}
```
El endpoint es público (no hay auth). Un atacante puede mandar `recordId` con cualquier ID y escribir `metadata` arbitraria sobre cualquier post existente. Hay que (a) eliminar esa rama, (b) restringir escritura a una colección separada (`imr_calculations`), o (c) requerir auth.

### 5. Inconsistencia de colecciones de Firestore
La aplicación lee/escribe perfiles en **dos colecciones distintas** y no está claro cuál es la canónica:

- `profiles` → `login.astro`, `BioDashboard.tsx`
- `users` → `IMRQuiz.tsx`, `BioDashboard.tsx` (sí, lee de las dos y mergea), `ArticleQuiz.tsx`

Además hay un bug claro en `src/pages/api/admin/stats.ts:21`:
```ts
const postsRef = db.collection('post');   // singular
```
Todo el resto del código usa `'metamorfosis_posts'`, así que `totalPosts` siempre devuelve 0.

**Recomendación:** decidir colección canónica de perfil (`users` parece más estándar), migrar datos legacy de `profiles`, y corregir `stats.ts` a `'metamorfosis_posts'`.

---

## ALTO (seguridad / despliegue)

### 6. Variables de entorno faltantes en CI
`.github/workflows/deploy.yml` solo pasa las `PUBLIC_FIREBASE_*` al build. **No pasa** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` ni `ADMIN_PASSWORD`. Esto significa que:
- `Footer.astro`, `admin/login.astro` y `admin/dashboard.astro` lanzan `Error('ADMIN_PASSWORD must be set in production')` durante el build, o
- Si el throw se silencia, todo el panel admin queda inaccesible.

Hay que agregar esos secrets al workflow (y resolver primero el problema de SSR del punto 1).

### 7. Service-account de Firebase en el directorio del proyecto
`metamorfosis-web/elena-app-2026-v1-firebase-adminsdk-fbsvc-70d769aff1.json` está en el filesystem local del proyecto. Está correctamente ignorado por `.gitignore` (`*-adminsdk-*.json`), así que no debería estar en GitHub — **conviene verificarlo**:
```sh
cd /Users/carlosreyes/Proyectos/Web_Site/metamorfosis-web
git log --all --diff-filter=A -- "elena-app-2026-v1-firebase-adminsdk-fbsvc-70d769aff1.json"
```
Si aparece en el historial, hay que **rotar la service account** en GCP (descargar nueva clave, eliminar la comprometida) y limpiar el historial con `git filter-repo`. La clave nunca se usa en código (el server lee desde `.env` con `FIREBASE_PRIVATE_KEY`), así que se puede borrar del directorio sin riesgo funcional.

### 8. `.env` con secretos en disco (recordatorio)
`.env` contiene `FIREBASE_PRIVATE_KEY` y `ADMIN_PASSWORD="Metamorfosis2026*"`. Está en `.gitignore` (correcto). Recomendación operativa: rotar `ADMIN_PASSWORD` después de cualquier paso por máquina compartida y usar un manager (1Password, Bitwarden) en lugar del `.env` plano para el equipo.

### 9. `AdminLogin.tsx` setea cookie del lado cliente sin flags de seguridad
```ts
document.cookie = `admin_session=${encodeURIComponent(adminCode)}; path=/; max-age=86400`;
```
- Falta `HttpOnly` (no es posible setearlo desde JS por diseño — más razón para mover esto al servidor).
- Falta `Secure` y `SameSite`.
- El "código admin" se compara contra `ADMIN_PASSWORD` raw en `admin/dashboard.astro`, sin constant-time → susceptible a timing.
- No hay rate limit (el rate limit del endpoint `/api/admin/login.ts` no se usa porque el componente no llama a ese endpoint).

Solución: que el componente haga `fetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: adminCode }) })` y deje al server emitir la cookie segura.

### 10. Link "Admin" público en navbar y footer
- `Navbar.astro` muestra siempre un enlace `/admin` (con `opacity-30`).
- `Footer.astro` muestra siempre un enlace `/admin`.

Aunque `/admin` redirige a `/admin/login`, exponer la URL públicamente facilita ataques de fuerza bruta. Idealmente, mostrar el link solo si `isAdmin === true` (cookie ya validada).

---

## MEDIO (calidad / consistencia / UX)

### 11. Dos layouts conviviendo con estilos opuestos
- `Layout.astro` → fondo claro (`bg-gradient-to-br from-gray-50 via-white`), incluye `<Navbar />` y `<Footer />`.
- `BaseLayout.astro` → fondo oscuro (`html.dark`, `bg-base text-primary`), incluye `<Navbar />` pero **un footer inline distinto al componente**.

Distribución actual:
- Usan `Layout` (claro): `terminos`, `privacidad`, `sobre-mi`, `protocolo`, `dashboard-7d`, `comunidad`, `diagnostico`, `calculadora`, `login`, `admin/*`.
- Usan `BaseLayout` (oscuro): `index`, `quiz`, `dashboard`, `biblioteca`, `posts/[slug]`.

El usuario percibe un cambio de tema fuerte al navegar de la home (oscura) a "Sobre mí" o "Calculadora" (claras). Hay que decidir un solo tema, o consolidar a un layout que reciba `theme` como prop.

### 12. Footer duplicado en `BaseLayout`
`BaseLayout.astro` define un `<footer>` inline con copyright, en vez de usar `<Footer />` (el componente). Las páginas que usan `BaseLayout` no muestran las tres columnas (Brand/Navegación/Legal) ni los íconos sociales — y si arreglamos `BaseLayout` para usar `Footer.astro`, hay que asegurar que `Footer.astro` no rompa por falta de `ADMIN_PASSWORD` cuando se renderiza fuera de admin.

### 13. Bloques duplicados literalmente en `posts/[slug].astro`
- Sección "Comunidad CTA" aparece dos veces (líneas 230–266 y 275–312) — código exacto.
- Botón "Volver a la Biblioteca" aparece dos veces (líneas 268–274 y 336–342).
- "1,240 biohackers" hardcoded → cuando crezca la comunidad o quede vacío se ve mal.
- Tiempo de lectura "8 min" hardcoded → debería calcularse del contenido.
- Fecha fallback `"7 de mayo de 2026"` hardcoded.
- Bloque `<script>` con tracking de scroll está dentro del JSX al final del article — funciona, pero por orden conviene moverlo fuera del `<article>`.

### 14. Redes sociales del footer apuntan a la home de cada plataforma
`Footer.astro` tiene `href="https://youtube.com"`, `https://facebook.com`, `https://instagram.com`, `https://tiktok.com` — placeholders. Hay que reemplazarlos por las URLs reales de Metamorfosis Real (el proyecto explícitamente menciona el canal de YouTube como pilar).

### 15. Navbar: enlace `/posts` no existe
`Footer.astro` linkea a `/posts` (lista de artículos). Esa ruta no existe — la lista está en `/biblioteca`. Cambiar a `/biblioteca`.

### 16. `target="_blank"` sin `rel="noopener noreferrer"`
Navbar tiene `<a href="https://elena-app.vercel.app/" target="_blank">` sin `rel="noopener"`. Riesgo menor de tab-napping, pero es estándar agregarlo.

### 17. `BaseLayout.astro` define `style is:global` con `p { max-width: 65ch }`
Esto fuerza un ancho a TODOS los `<p>` del sitio. En Hero, tarjetas y CTAs puede recortar texto inesperadamente. Mejor convertirlo en una clase utilitaria (`.content-reading p`) o aplicar solo dentro de `prose`.

### 18. Tipos React en `<script>` de `login.astro`
El script al final de `login.astro` no es TypeScript (es JS implícito) y hace cosas como:
```js
const inputName = document.getElementById('input-name');
// ...
const nameInput = inputName.value.trim(); // ← si inputName es null, crash
```
y
```js
sessionStorage.setItem('imr_score', data.imr.toString()); // ← si data.imr es undefined, crash
```
Toleran null/undefined porque "casi nunca pasa", pero conviene optar por `inputName?.value?.trim() ?? ''` y similar.

### 19. `console.log` en producción (17 ocurrencias en 9 archivos)
`logout.ts`, `login.ts`, `firebaseAdmin.ts`, `posts/[slug].astro`, `auth.ts`, `ProtocolDashboard.tsx`, `ArticleEditor.tsx`, `AnaliticaIMR.tsx`, `generate-pdf-report.ts`. No es crítico, pero algunos imprimen IPs y datos de auth. Recomiendo un wrapper `log.debug()` que solo emita en `import.meta.env.DEV`.

### 20. `vite.server.fs.allow` con paths macOS específicos
```js
vite: { server: { fs: { allow: ['/private/tmp/deps-install', '/tmp/deps-install', './'] } } }
```
Eso parece haberse agregado durante alguna instalación rara (¿pnpm + caché temporal?). En producción no causa daño, pero mete ruido.

### 21. `generate-pdf-report.ts` es un mockup
- No verifica `ref_payco` contra ePayco.
- No genera un PDF (devuelve HTML que carga `cdn.tailwindcss.com` — el script Play CDN, prohibido en prod por su propia documentación).
- Mensaje "(Demostración)" en el HTML.

Si la calculadora ya cobra por ePayco, esto está aceptando pagos sin entregar nada verificable. Hay que (a) llamar al endpoint de validación de ePayco con `ref_payco`, (b) generar el PDF real (con `pdf-lib`, `pdfkit` o equivalente), y (c) entregar al usuario.

### 22. README.md es el del template de Astro
Recomendación: un README mínimo con cómo levantar el proyecto, cómo configurar `.env`, qué adaptador usa y dónde se despliega. Útil para tu yo del futuro.

### 23. `metamorfosis-web/.ai-rules` y `Web_Site/.antigravityrules` sin contenido visible en lectura
Si tienen reglas para asistentes IA, conviene asegurarse de que estén consolidadas (CLAUDE.md o similar) y no en formato de un editor específico.

---

## BAJO (limpieza)

### 24. Carpetas `.quarantine_modules`, `.bad_modules2`, `.bad_modules3`
`.gitignore` las menciona, así que no entran al repo, pero localmente pueden ocupar GB de disco. Borrarlas si ya no se usan (`rm -rf .quarantine_modules .bad_modules2 .bad_modules3`).

### 25. `last-update.txt` en raíz del proyecto
Parece un artefacto del flujo de generación de posts. Si ya no se usa, removerlo.

### 26. Componente `ArticleQuiz` en dos rutas
Hay `src/components/ArticleQuiz.tsx` y `src/components/blog/ArticleQuiz.tsx`. Verificar cuál se usa y eliminar el otro.

### 27. Bundle Chart/Recharts pesado para una sola página
Si Recharts solo se usa en `AnaliticaIMR.tsx` (admin), considerar `client:only="react"` con import dinámico para no afectar el bundle público.

---

## Recomendación de orden para atacarlo

1. **Decidir el modelo de despliegue** (Vercel vs estático). Es el bloqueador raíz; sin él los puntos 6 y 9 no se pueden resolver bien. (CRÍTICO #1)
2. **Cerrar `cleanup.ts`** con auth — son 5 líneas de código y elimina un riesgo real. (CRÍTICO #2)
3. **Unificar el contrato de auth admin** (CRÍTICO #3 + ALTO #9). Decidir si la cookie es `firebase_auth` o el password raw, y arreglar todos los lectores.
4. **Quitar el `recordId` de `/api/calculate-imr`** o moverlo a colección dedicada. (CRÍTICO #4)
5. **Arreglar `stats.ts: 'post'` → `'metamorfosis_posts'`** y unificar `profiles`/`users`. (CRÍTICO #5)
6. **Agregar los secrets faltantes al workflow** y verificar el historial git por la service account. (ALTO #6, #7)
7. Limpieza del resto (UX, layouts, duplicados).

---

## Lo que está bien (vale la pena anotarlo)

- `auth.ts` está bien escrito: constant-time compare, rate limiting, validación de password, sanitización, cookies HttpOnly+SameSite. El problema es que el frontend no lo usa.
- `generate-from-youtube.ts` correctamente deshabilitado con HTTP 410 y comentario explicativo.
- `.gitignore` cubre las service accounts de Firebase de forma específica (`*-adminsdk-*.json`).
- `tsconfig.json` extiende `astro/tsconfigs/strict` — bueno, mantenerlo.
- Validadores en `src/lib/validators/` y sanitizers de JSON existen (no los abrí en detalle, pero la presencia es buena señal).
- El uso de `prerender = false` en cada API es explícito y consistente.
