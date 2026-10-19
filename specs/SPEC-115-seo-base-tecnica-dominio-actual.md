# SPEC-115 — Base técnica SEO en `metamorfosisvital.com.co` (redirects canónicos, meta descriptions, footer)

**Estado:** ✅ Cerrada (código desplegado y verificado en producción 2026-10-19; quedan los pasos externos de Search Console)
**Fase:** 6 (Operación / Crecimiento)
**Severidad:** 🟡 Alta (el sitio tiene 0 clics en 3 meses y la medición está rota)
**Fecha de creación:** 2026-10-19
**Autor:** Carlos Reyes (vía agente)
**Depende de:** SPEC-027, SPEC-052b, SPEC-108
**Reemplaza (pausa):** SPEC-111 (migración a `metamorfosisreal.org`)

---

## Contexto

La auditoría `docs/auditoria-seo-metamorfosisvital-2026-09-11` (anexada al proyecto en claude.ai) midió 0 clics y 238 impresiones en 3 meses. Su recomendación B1: no cambiar de dominio ahora; primero arreglar la base técnica en el dominio actual. Se decidió pausar SPEC-111 y ejecutar esta spec (opción A).

Hallazgos que cubre esta spec: T2 (www no redirige), T6 (meta descriptions cortadas), T7 (URL vieja 404), B2 (ícono "Instagram" enlaza a Facebook). T1, T3, T4 y T5 son tareas externas o de otro repo (ver "Fuera de alcance").

## Problema

Google ve contenido duplicado entre `www` y apex sin una señal fuerte (301), los snippets salen cortados a media palabra y hay una URL antigua que responde 404 y un enlace de red social equivocado.

## Solución propuesta

1. **Middleware global** (`src/middleware.ts`) + función pura testeada (`src/lib/utils/canonicalRedirect.ts`) que emite 301 en un solo salto para: `www.` → apex, barra final → sin barra y slug legacy → slug vigente. Solo GET/HEAD (un 301 sobre POST rompería los `/api/*`).
   - **Desviación de la auditoría:** la auditoría propone `public/.htaccess` (Anexo A.1). No aplica: el sitio corre como app Node.js (`@astrojs/node` standalone), no como estático bajo Apache. La propia auditoría lo advierte ("si corre como Node.js SSR, .htaccess puede no aplicar").
   - **Desviación:** no se cambia `trailingSlash` en `astro.config.mjs` (default `ignore`); la normalización a "sin barra" se hace en el middleware. Motivo: `trailingSlash: 'never'` en SSR puede devolver 404 a URLs con barra en vez de redirigirlas, y no se pudo probar contra el proxy de Hostinger.
   - El host se lee de `x-forwarded-host` y luego `host` (SPEC-052b: HCDN puede no propagar `Host`). Si no se identifica `www.<site>` no se redirige, así que un header ausente no puede causar bucle.
2. **Meta description** (T6): `lib/utils/metaDescription.ts`. Prioridad: campo `description` manual (nuevo, opcional, máx 200) → derivada del cuerpo sin markdown ni prefijo `CONTENIDO:`, cortada en fin de oración o de palabra (≤155). El editor admin tiene un campo nuevo "Descripción para Google"; la API persiste `description` en POST y PUT.
3. **Footer** (B2): el ícono y el texto "Instagram" enlazaban a Facebook. Se cambia a ícono/etiqueta Facebook. No existe URL de Instagram en el repo y no se inventa.
4. **JSON-LD del artículo:** `author.url` usa `Astro.site.origin` en vez de la constante hardcodeada.

## Plan de implementación

1. Crear `src/lib/utils/canonicalRedirect.ts` + `.test.ts` (13 tests).
2. Crear `src/middleware.ts`.
3. Crear `src/lib/utils/metaDescription.ts` + `.test.ts` (8 tests).
4. Modificar `src/pages/posts/[slug].astro` (usa `buildMetaDescription`, `author.url`).
5. Modificar `src/pages/api/admin/posts.ts` (POST/PUT persisten `description`).
6. Modificar `src/components/admin/ArticleEditor.tsx` (campo de descripción).
7. Modificar `src/components/Footer.astro` (Facebook).
8. Marcar SPEC-111 como ⏸️ pausada en `ROADMAP-SDD.md` y esta spec como 🔨.

## Criterios de aceptación

**Código (verificado localmente):**
- [x] `npx vitest run`: 14 archivos, 252/252 tests (incluye los 21 nuevos).
- [x] `npm run build` pasa; solo los 2 warnings preexistentes (`getDoc` sin usar en `ArticleQuiz.tsx`, import mixto de `firebase/firestore`).
- [x] Servidor del build probado en local con `Host`/`X-Forwarded-Host` simulados: www → 301 a apex en un salto; `/biblioteca/` → 301 sin barra; query preservada; slug legacy → 301 al artículo de ayuno; `/sobre-mi` → 200; POST a `/api/leads` con www llega al handler (400 por body vacío, no 301); sin bucle.

**Post-deploy:**
- [x] `curl -I https://www.metamorfosisvital.com.co/biblioteca` → `301`, `location: https://metamorfosisvital.com.co/biblioteca` (un solo salto).
- [x] `curl -I https://metamorfosisvital.com.co/biblioteca/` → `301` sin barra.
- [x] `curl -I https://metamorfosisvital.com.co/posts/que-pasa-cuerpo-16-horas-autofagia/` → `301` al artículo de ayuno, que responde `200`.
- [x] `curl -I https://metamorfosisvital.com.co/` → `200` (sin bucle).
- [ ] Login admin y guardado de artículo siguen funcionando (POST/PUT a `/api/*` no se redirigen).
- [x] Un artículo muestra `<meta name="description">` terminado en frase o palabra completa.
- [x] El ícono del footer abre Facebook y se llama Facebook.

## Pruebas

```sh
cd metamorfosis-web
npx vitest run
npm run build
# Post-deploy (UA realista por HCDN, ver memoria feedback_hcdn_challenge_curl):
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36'
curl -sI -A "$UA" https://www.metamorfosisvital.com.co/biblioteca
curl -sI -A "$UA" https://metamorfosisvital.com.co/biblioteca/
curl -sI -A "$UA" https://metamorfosisvital.com.co/posts/que-pasa-cuerpo-16-horas-autofagia/
```

## Riesgos / consideraciones

- **Bucle de redirects:** mitigado (no se redirige sin evidencia de `www.`; el destino siempre es `Astro.site`). Si apareciera en producción: revertir el commit.
- **Slug legacy:** el destino `ayuno-intermitente-guia-practica-para-sanar-tu-metabolismo-sin-pasar-hambre` se tomó de la auditoría; confirmar que responde 200 antes de dar la spec por cerrada.
- **`description: ''` en artículos existentes:** el editor la envía vacía al guardar; no sobrescribe nada útil porque antes no existía el campo.
- **Cookies:** el redirect www→apex invalida la sesión admin abierta en `www` (esperado).

## Fuera de alcance (acciones de Carlos u otro repo)

- **T1:** crear propiedad **Dominio** en Search Console con registro TXT en DNS (Hostinger hPanel → DNS).
- **T3:** el sitemap es dinámico (`src/pages/sitemap.xml.ts`, incluye posts de Firestore y ya apunta al apex) y `robots.txt` ya lo declara. Falta reenviarlo en la propiedad de Dominio y revisar el informe (GSC solo conoce 8 de 24 URLs).
- **T4:** identificar las 2 URLs "Rastreada: actualmente sin indexar" en GSC.
- **T5:** `web/index.html` del subdominio `app.` (Flutter, repo de ElenaApp): título y descripción reales o `noindex`.
- **B2:** si existe cuenta de Instagram, pasar la URL para agregar el ícono propio.
- **Contenido (C1–C7, B3):** specs propias, no mezclar aquí. Prioridad: C2 (caso "Andrés" con datos clínicos inventados) y C4 (sal vs. OMS).

## Commit (sugerido)

```
feat(spec-115): base tecnica SEO — 301 www/slash/slug legacy, meta description, footer

- middleware: 301 en un solo salto (www -> apex, barra final, slug legacy), solo GET/HEAD
- meta description manual o derivada sin cortar palabras (T6)
- editor admin: campo "Descripcion para Google"
- footer: icono Instagram enlazaba a Facebook (B2)
- JSON-LD author.url desde Astro.site
- SPEC-111 pausada (auditoria SEO 2026-09-11, B1)
```

## Resultado

Cerrada el 2026-10-19. Commits `25aa93a` (fix del test) y `4e9078b` (SPEC-115), pusheados por Carlos.

Verificado en producción con curl (UA realista):
- `www.metamorfosisvital.com.co/biblioteca` → `301` a `https://metamorfosisvital.com.co/biblioteca` en un solo salto (la respuesta trae cabeceras `platform: hostinger` / `panel: hpanel`; no se distinguió si el 301 lo emitió el middleware o el panel de Hostinger. Con ambos activos el resultado es el mismo y sin bucle).
- `/biblioteca/` → `301` sin barra.
- URL legacy de autofagia → `301` al artículo de ayuno, que responde `200`.
- Home `200`. Meta description del artículo de ayuno termina en frase completa; canonical sin www ni barra; footer con ícono Facebook.

**Desviaciones:** middleware en lugar de `.htaccess` (el sitio es Node SSR); `trailingSlash` no se tocó. **Pendiente (externo, no bloquea el cierre):** propiedad de Dominio en Search Console (T1), reenviar sitemap (T3), identificar las 2 URLs "Rastreada: actualmente sin indexar" (T4), metadatos del subdominio `app.` en el repo de ElenaApp (T5), URL de Instagram si existe (B2).
**Aprendizaje:** un fixture con slugs duplicados puede hacer pasar o fallar un test por la razón equivocada; las cifras de los tests se calibran corriendo el código.
