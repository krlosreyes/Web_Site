# CLAUDE.md — Archivo Maestro del Proyecto

> **Archivo maestro / "constitución" del repositorio Web_Site.** Cualquier
> agente de IA (Cowork, Claude Code, futuros) que opere sobre este repo debe
> leer este archivo PRIMERO. Define scope, reglas inquebrantables, apuntadores
> a la memoria del proyecto y comportamiento esperado.
>
> Inspirado en el patrón "Archivo Maestro" del manifiesto Spec-Driven
> Development (ver `specs/000-METHODOLOGY-SDD.md`).

---

## 1. Scope del proyecto

**Metamorfosis Real** es un ecosistema de optimización de salud metabólica
compuesto por tres piezas:

1. **Sitio web** (este repo, `metamorfosis-web/`) — Astro 6 SSR + React 19 +
   Firebase. Puerta de entrada al ecosistema. Captura de leads vía quiz IMR,
   biblioteca editorial, panel admin.
2. **ElenaApp** — app móvil (repo separado, en desarrollo, sin users en
   producción). Optimización diaria de hábitos. Comparte Firestore + Firebase
   Auth con la web; el contrato canónico vive en
   `metamorfosis-web/src/lib/types/user.ts`.
3. **Canal de YouTube** — formación. No tiene código en este repo.

Este repo cubre **únicamente la pieza web**. Cuando una decisión afecta el
contrato compartido con ElenaApp, anotar en la spec correspondiente y
respetar el schema versionado (`SCHEMA_VERSION` en
`src/lib/constants/firestore.ts`).

## 2. Stack obligatorio (NO cambiar sin spec dedicada)

- **Frontend:** Astro 6 (SSR mode `output: 'server'`) + React 19 + Tailwind.
- **Backend / API routes:** Astro endpoints (`src/pages/api/**.ts`) corriendo
  sobre Node 18+ con `@astrojs/node` adapter en modo `standalone`.
- **Datos:** Firebase Firestore (Admin SDK en server, Web SDK en cliente).
- **Auth de usuarios:** Firebase Auth.
- **Auth de admin:** cookie `admin_session` HttpOnly + Secure + SameSite=Strict,
  validada con `isValidSessionValue` (constant-time compare).
- **Storage:** Firebase Cloud Storage para imágenes de blog (NO base64 en
  Firestore).
- **Deploy:** Hostinger Node.js Apps (plan Business). Auto-deploy desde GitHub
  → main → ~90-120s para que se aplique. Entry file:
  `metamorfosis-web/server/entry.mjs`.
- **Reglas de Firestore:** vivien en `firebase/firestore.rules`. NO se deployan
  con el push: hay que publicarlas manualmente desde Firebase Console o con
  `firebase deploy --only firestore:rules`.
- **Analytics:** Umami cloud (SPEC-028 + SPEC-028b). Variable
  `PUBLIC_UMAMI_WEBSITE_ID` en Hostinger env vars. El componente
  `UmamiScript.astro` excluye `/admin/*` y solo se inyecta en producción.
  IMPORTANTE: leer la env var con `process.env.PUBLIC_UMAMI_WEBSITE_ID`
  (runtime SSR), no con `import.meta.env.*` (build-time inlining) — si no,
  hay que rebuildear cada vez que la env var cambia en Hostinger.

**Prohibido sin spec previa:**
- Cambiar de Hostinger a otro hosting (Vercel/Netlify/etc.).
- Cambiar de Firebase a otro backend (Supabase/etc.).
- Mezclar la collection `users` con `waitlist_leads` (ver SPEC-016b).
- Escribir desde el cliente en `users/{uid}.app.*` o `users/{uid}.crm.*`
  (rules lo bloquean — son campos protegidos del Admin SDK / ElenaApp).
- Commitear `.env`, service-account JSON, o cualquier credencial.

## 3. Metodología — Spec-Driven Development (SDD)

Toda mejora pasa por una spec en `specs/SPEC-NNN-*.md`. Reglas:

- **Una spec = un commit + push directo a `main`.** Si la implementación
  rebalsa, partir la spec (`SPEC-NNN-a`, `SPEC-NNN-b`) antes de commitear.
- **Mensaje de commit:** `feat(spec-NNN): título corto` o
  `fix(spec-NNN): título corto`. Body con bullets de cambios.
- **Estructura mínima de cada spec:** Contexto / Problema / Solución
  propuesta / Plan / Criterios de aceptación / Pruebas manuales / Riesgos /
  Commit / Resultado.
- **Cierre de spec:** marcarla ✅ y dejar sección `## Resultado` con qué
  quedó hecho y desviaciones del plan.
- **No mezclar specs.** Si trabajando en una aparece otro problema, se anota
  en la spec relevante o se abre nueva — nunca se mete en el commit en curso.

Ver `specs/000-METHODOLOGY-SDD.md` para la versión larga.

## 4. Reglas inquebrantables (anti-loops conocidos)

Estas son lecciones de cuestiones que ya nos costaron tiempo. Aplicarlas
SIEMPRE en una sola pasada para no entrar en loops "probá esto, ah otro bug,
probá esto otro":

- **Astro 6 + POST/PUT a `/api/*` desde JS:** SIEMPRE incluir
  `Content-Type: application/json` en el header. Sin él, Astro 6 lo rechaza
  con 403 CSRF antes del handler, y `fetch` con 4xx no lanza excepción —
  el `catch` no se entera.
- **Cookies de invalidación:** SIEMPRE replicar Secure/HttpOnly/SameSite/Path
  exactos de la cookie original, o el browser la ignora silenciosamente.
- **`fetch` con respuesta 4xx/5xx:** SIEMPRE chequear `res.ok` explícitamente
  y loguear; nunca asumir que `await fetch(...)` sin error = éxito.
- **Páginas internas con tema oscuro (post-SPEC-013):** NO usar `bg-white` ni
  `bg-gray-50` que pisen el body oscuro. Usar `bg-[#0c1422]`,
  `bg-white/5 border-white/10`, `text-white`/`text-gray-300`.
- **`grep -c` sobre HTML SSR minified** cuenta líneas, no matches; usar
  `grep -oE | wc -l` para contar ocurrencias reales.
- **Build:** correr `npm run build` desde `metamorfosis-web/`, NO desde el
  root del repo.
- **Env vars `PUBLIC_*` en SSR (post-SPEC-028b):** `import.meta.env.PUBLIC_*`
  se inlinea en el bundle al `astro build` — un cambio de env var en
  Hostinger NO surte efecto sin rebuild. Para variables que deben respetar
  cambios runtime, usar `process.env.PUBLIC_X` en el frontmatter de `.astro`
  (con fallback `|| import.meta.env.PUBLIC_X` para `astro dev`). Detectado
  con Umami: dashboard vacío hasta cambiar el patrón a runtime-first.
- **Imágenes en `/public` (post-SPEC-030):** NO commitear PNG/JPG >500 KB sin
  generar `.webp` paralelo y usar el `.webp` para in-page render. El original
  pesado se mantiene SOLO para OG/schema (scrapers FB/LinkedIn no parsean
  webp confiable). Pipeline: `convert orig.png -quality 82 -define
  webp:method=6 orig.webp`. Pruebas con header-bg: 2 MB → 141 KB (-93%).
  Imágenes con LCP: declarar `preloadImage` en `BaseLayout` props para
  inyectar `<link rel="preload" as="image" fetchpriority="high">`.
- **Fonts (post-SPEC-030c REVERTIDA):** Inter y Space Grotesk cargan desde
  `fonts.googleapis.com` con pattern non-blocking (preload as=style +
  media=print + noscript). Intentamos self-hostear (SPEC-030c) y bajó
  Performance de 84 → 63 por error en el script de descarga (WOFF2 de
  range wrong). Si en el futuro se retoma self-hosting: usar Google
  Webfonts Helper manual (gwfh.mranftl.com), NO Python script, y verificar
  visualmente + Lighthouse antes de declarar la spec cerrada.
- **Copy en español neutro (post-SPEC-054):** El sitio se dirige a audiencia
  hispanoamericana completa (México, Colombia, España, Chile, Perú, Argentina,
  Uruguay). NO usar voseo (`sos`, `tenés`, `podés`, `querés`, `sabés`, `creés`,
  `necesitás`, `acabás`, etc.) ni imperativos rioplatenses con tilde final
  (`Mirá`, `Hacé`, `Decí`, `Reservá`, `Iniciá`, `Probá`, `Descubrí`, `Recibí`,
  `Obtené`, `Registrate`, etc.) en NINGÚN copy del sitio: components, pages,
  emails transaccionales, mensajes de error, prompts, modals, notificaciones.
  Usar tuteo neutro: `eres`, `tienes`, `puedes`, `mira`, `haz`, `di`, `reserva`,
  `inicia`, `intenta`, `descubre`, `recibe`, `regístrate`. Excepción válida:
  pretérito 1ra persona ("yo descubrí") cuando es narrativa de Carlos en
  primera persona (ej. `sobre-mi.astro`). Aplica también a samples/ejemplos
  de copy en conversación con Carlos — no solo al código fuente.
- **Páginas con `BaseLayout` deben reservar ≥80px de padding-top** en su
  primer wrapper (`pt-24` o `pt-28` según diseño). El Navbar es `fixed
  top-0 h-20` y NO empuja contenido. Excepción: páginas con hero a viewport
  completo (`h-[60vh]+`) que esperan transparencia sobre la imagen. Si
  agregás una página y olvidás esto, el primer renglón queda tapado por el
  menú — no es bug del navbar, es contrato del layout.
- **Headings con texto dinámico** (saludo `Hola, {userName}`, título de
  artículo, tópico de foro) DEBEN ser responsive con al menos
  `text-3xl sm:text-Nxl md:text-Mxl` y llevar `break-words`. Su flex parent
  necesita `min-w-0 flex-1` para permitir shrink. Sin esto, un nombre largo
  (>10 chars) en `text-6xl` desborda el viewport mobile. Hay defensa global
  en `global.css` (`overflow-wrap: anywhere` para h1-h6) pero esa es solo
  red de seguridad — el responsive correcto se hace en el componente.

## 5. Mapa de archivos clave

Apuntadores para no inflar el contexto:

| Tema | Archivo |
|---|---|
| Roadmap maestro de specs | [`ROADMAP-SDD.md`](./ROADMAP-SDD.md) |
| Metodología SDD del proyecto | [`specs/000-METHODOLOGY-SDD.md`](./specs/000-METHODOLOGY-SDD.md) |
| Schema canónico de usuario (compartido con ElenaApp) | `metamorfosis-web/src/lib/types/user.ts` |
| Constantes de Firestore | `metamorfosis-web/src/lib/constants/firestore.ts` |
| Auth admin (constant-time, cookies) | `metamorfosis-web/src/lib/auth.ts` |
| Firebase Admin SDK init | `metamorfosis-web/src/lib/firebaseAdmin.ts` |
| Motor IMR (SPEC-70.5) | `metamorfosis-web/src/lib/imr/engine.ts` |
| Reglas de Firestore | `firebase/firestore.rules` |
| Reglas de Storage | `firebase/storage.rules` |
| Navbar (logout, menú móvil) | `metamorfosis-web/src/components/Navbar.astro` |

## 6. Comportamiento esperado del agente

- **Leer este archivo y `ROADMAP-SDD.md` al inicio de cada sesión** para
  recuperar contexto. Las memorias auto-cargadas (`feedback_*.md`,
  `project_*.md`) complementan, no reemplazan.
- **Nunca proponer cambios fuera de scope** sin discutirlos primero. Si una
  pregunta del usuario implica una nueva spec, ofrecer escribirla.
- **Implementar fixes completos en una sola pasada.** Anticipar gotchas
  conocidos (sección 4) ANTES de pedir verificación. Carlos valora su tiempo
  y el loop iterativo lo costó horas en el pasado.
- **Verificar antes de afirmar.** Si una claim depende de un archivo o de
  estado del repo, abrirlo/grepearlo. No responder de memoria.
- **Si el agente borra trabajo del usuario por error,** decirlo de inmediato
  con la línea exacta y el commit/diff afectado, en lugar de inventar la
  recuperación.
- **Sources al final** cuando la respuesta venga de archivos del repo o tools
  externos linkeables.

## 7. Operación

- **Único admin:** Carlos Reyes (krlosreyes2@gmail.com), single-factor
  (password). Rotación de credenciales: ver SPEC-010.
- **Branch única:** `main`. Sin PRs. Push directo + auto-deploy.
- **Verificación post-deploy:** esperar 90-120s, abrir el sitio, confirmar
  visualmente. Hostinger no notifica errores de build.
- **Rollback:** revertir el commit y push. Hostinger redeploya en ~120s.

## 8. Cómo extender este archivo

Cuando aparezca una nueva regla inquebrantable, una nueva pieza del stack, o
un nuevo gotcha repetido, agregarlo acá en la sección apropiada (4 o 5).
Mantenerlo bajo ~250 líneas para que entre completo en cualquier contexto.
Si un tema se hace largo, moverlo a su propio archivo y dejar acá solo el
apuntador.
