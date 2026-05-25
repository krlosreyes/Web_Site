# Metamorfosis Real — sitio web

Puerta de entrada al ecosistema **Metamorfosis Real**: optimización de salud
metabólica vía ayuno, nutrición, ejercicio, hidratación y sueño. El sitio
captura leads vía el quiz IMR, sirve la biblioteca editorial, expone el panel
admin y comparte el contrato canónico de `users/{uid}` con la app móvil
**ElenaApp**.

Producción: <https://www.metamorfosisvital.com.co/>

---

## Stack

- **Frontend / SSR:** Astro 6 (`output: 'server'`) + React 19 + Tailwind 4.
- **Adapter de runtime:** `@astrojs/node` modo `standalone`.
- **Datos:** Firebase Firestore (Admin SDK en server, Web SDK en cliente).
- **Auth de usuarios:** Firebase Auth.
- **Auth de admin:** cookie `admin_session` HttpOnly + Secure + SameSite=Strict
  validada con `isValidSessionValue` (constant-time compare).
- **Storage:** Firebase Cloud Storage para imágenes de blog.
- **Emails:** Resend (welcome + notificaciones).
- **Analytics:** Umami cloud.
- **Hosting:** Hostinger Node.js Apps (plan Business). Auto-deploy desde GitHub
  → `main` → ~90-120 s.

Detalle completo del stack y reglas inquebrantables en
[`../CLAUDE.md`](../CLAUDE.md) (constitución del repo).

---

## Levantar el proyecto en local

```sh
npm install
npm run dev      # http://localhost:4321
```

Comandos útiles:

| Comando | Acción |
|---|---|
| `npm run dev` | Dev server con HMR |
| `npm run build` | Build SSR a `./dist/` (entry: `dist/server/entry.mjs`) |
| `npm run preview` | Preview del build SSR localmente |
| `npm test` | Vitest (specs en `src/**/__tests__/`) |
| `npm run astro -- --help` | CLI de Astro |

> **Build:** corre desde `metamorfosis-web/`, no desde la raíz del repo.

---

## Variables de entorno

Crear `metamorfosis-web/.env` (no se commitea — protegido por `.gitignore`).
Mismo set de variables en Hostinger → hPanel → Node.js App → Environment.

### Firebase (server, Admin SDK)

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (con `\n` literales escapados)

### Firebase (cliente, Web SDK)

- `PUBLIC_FIREBASE_API_KEY`
- `PUBLIC_FIREBASE_AUTH_DOMAIN`
- `PUBLIC_FIREBASE_PROJECT_ID`
- `PUBLIC_FIREBASE_STORAGE_BUCKET`
- `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `PUBLIC_FIREBASE_APP_ID`

### Admin / sesión

- `ADMIN_PASSWORD` (rotada en SPEC-010; rotar tras cualquier exposición)

### Servicios externos

- `RESEND_API_KEY` (welcome emails — SPEC-029)
- `PUBLIC_UMAMI_WEBSITE_ID` (analytics — SPEC-028)
- `PUBLIC_GSC_VERIFICATION` (token de Google Search Console — opcional;
  hay fallback hardcoded en `BaseLayout.astro` por SPEC-108b)

> **Importante (SPEC-028b):** las `PUBLIC_*` que deben respetar cambios runtime
> en Hostinger se leen con `process.env.PUBLIC_*` en el frontmatter del `.astro`,
> NO con `import.meta.env.PUBLIC_*` (que se inlinea en build-time).

---

## Estructura

```
metamorfosis-web/
├── src/
│   ├── pages/          # Rutas Astro (.astro) + endpoints API (.ts)
│   │   ├── api/        # SSR endpoints (admin/, users/, forum/, etc.)
│   │   └── admin/      # Panel admin (login, dashboard, founders, etc.)
│   ├── components/     # Astro + React (Hero, Navbar, IMRQuiz, BioDashboard…)
│   ├── layouts/        # BaseLayout (oscuro, default) + Layout
│   ├── lib/            # auth, firebaseAdmin, IMR engine, utils
│   ├── data/           # Plan IMR 14 días, fixtures editoriales
│   └── constants/      # firestore (SCHEMA_VERSION, COLLECTIONS)
├── public/             # Assets estáticos (imágenes webp + originales para OG)
├── scripts/            # CLI helpers (verify, dev tooling)
└── dist/               # Build SSR (no commit)
```

---

## Despliegue

`main` → push → Hostinger Auto-Deploy ejecuta `npm ci && npm run build` →
arranca `dist/server/entry.mjs` con Node.

- **Tiempo total post-push:** ~90-120 s.
- **Hostinger no notifica errores de build.** Verificar visualmente la home
  tras 2 minutos.
- **Rollback:** revertir el commit en GitHub. Hostinger redeploya.

Reglas de Firestore (`firebase/firestore.rules`) **no se deployan con el push**.
Publicar manualmente desde Firebase Console o con
`firebase deploy --only firestore:rules`.

---

## Metodología

Spec-Driven Development. Cada cambio significativo nace como spec en
`../specs/SPEC-NNN-*.md`. Una spec = un commit + push directo a `main`.

Lectura obligatoria al inicio de sesión:

1. [`../CLAUDE.md`](../CLAUDE.md) — constitución del repo, reglas
   inquebrantables, gotchas conocidos.
2. [`../ROADMAP-SDD.md`](../ROADMAP-SDD.md) — índice de specs.
3. [`../specs/000-METHODOLOGY-SDD.md`](../specs/000-METHODOLOGY-SDD.md) —
   metodología completa.

---

## Contacto

Único admin: **Carlos Reyes** — krlosreyes2@gmail.com
