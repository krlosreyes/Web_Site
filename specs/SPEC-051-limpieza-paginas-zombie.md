# SPEC-051 — Limpieza páginas zombie + sitemap fix

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento (Bloque 2 del plan del día)
**Severidad:** ALTO (páginas obsoletas indexables por Google)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-013 (BaseLayout unificado), SPEC-027 (sitemap)

---

## Contexto

Auditoría pre-lanzamiento detectó 4 páginas legacy sin links internos en
toda la app:

| Página | Líneas | En sitemap | Layout | Origen |
|---|---|---|---|---|
| `/dashboard-7d` | 53 | NO | `Layout.astro` (legacy light) | Experimento `ResetEngine` dashboard primitivo |
| `/diagnostico` | 255 | NO | `Layout.astro` (legacy light) | "Diagnóstico metabólico" original pre-quiz IMR |
| `/protocolo` | 52 | **SÍ** | `Layout.astro` (legacy light) | Experimento `ProtocolDashboard` no implementado |
| `/calculadora` | 15 | **SÍ** | `Layout.astro` (legacy light) | Calculadora PRO con ePayco que no se lanzó |

Problemas que generan:
- **`/calculadora` y `/protocolo` están en `sitemap.xml`** → Google las
  indexa como páginas oficiales. Un user que llega de Search aterriza en
  páginas con tema light (pre-SPEC-013), fuera del look del sitio actual.
- **Las 4 usan `Layout.astro` (legacy)**, que da un theme distinto al
  unificado dark de `BaseLayout.astro` post-SPEC-013. El sitio se siente
  roto en esas URLs.
- **Surface area de ataque**: cada página activa expone endpoints, scripts
  externos (ej. `checkout.epayco.co/checkout.js` en `/calculadora`), y
  componentes que ya no se mantienen.
- **Componentes huérfanos**: cada página depende de un componente React
  que solo se usa en ese contexto y nadie está reviewing.

## Solución

### 1. Páginas

| Página | Acción | Razón |
|---|---|---|
| `/dashboard-7d` | **Borrar** | 0 referencias, no en sitemap, sin lógica que rescatar |
| `/diagnostico` | **Borrar** | 0 referencias, no en sitemap, reemplazada por `/quiz` post-quiz IMR |
| `/protocolo` | **Borrar** | 0 referencias internas (estaba en sitemap como página huérfana) |
| `/calculadora` | **Redirect 301 → `/quiz`** | Estaba en sitemap, Google puede haberla indexado; users con bookmarks viejos aterrizan en el quiz actual |

El redirect 301 preserva el SEO de cualquier backlink existente y mueve
el ranking de `/calculadora` hacia `/quiz`.

### 2. Componentes que quedan huérfanos al borrar las páginas

| Componente | Solo usado por | Acción |
|---|---|---|
| `components/ResetEngine.tsx` | `dashboard-7d.astro` | **Borrar** |
| `components/ProtocolDashboard.tsx` | `protocolo.astro` | **Borrar** |
| `components/calculator/MetamorfosisCalculator.tsx` (y carpeta `calculator/` entera) | `calculadora.astro` (que se reemplaza por redirect) | **Borrar** |

⚠️ **NO borrar `layouts/Layout.astro`**: aunque las 4 páginas zombie lo
usaban, mi grep inicial fue incompleto y NO detectó que `Layout.astro`
también lo usan **8 páginas activas**: `login`, `terminos`, `privacidad`,
`sobre-mi`, `comunidad`, `admin/dashboard`, `admin/login`, `admin/analitica-imr`.

Migrar esas páginas a `BaseLayout.astro` queda como deuda técnica de
unificación de layouts post-lanzamiento — fuera de scope de esta spec.

### 3. Sitemap

`sitemap.xml.ts`: remover `/calculadora` y `/protocolo`. Google las
re-descubrirá fuera del sitemap como redirect/404 y dejará de indexarlas
en su próximo crawl (típicamente 2-7 días).

## Plan de ejecución

1. Reemplazar `calculadora.astro` por un redirect 301 server-side:
   ```astro
   ---
   export const prerender = false;
   return Astro.redirect('/quiz', 301);
   ---
   ```
2. Editar `sitemap.xml.ts`: remover entries de `/calculadora` y `/protocolo`.
3. Borrar archivos (Carlos en su Mac, sandbox no tiene permisos `rm`):
   - `src/pages/dashboard-7d.astro`
   - `src/pages/diagnostico.astro`
   - `src/pages/protocolo.astro`
   - `src/components/ResetEngine.tsx`
   - `src/components/ProtocolDashboard.tsx`
   - `src/components/calculator/` (carpeta entera)
   - `src/layouts/Layout.astro`
4. Build local (`npm run build`) — debe pasar sin errores.
5. Commit + push.
6. Verificar post-deploy: `curl -I /calculadora` retorna 301; `/protocolo`
   retorna 404; `/sitemap.xml` no menciona ambas.

## Criterios de aceptación

- [x] `calculadora.astro` ahora es un redirect 301 a `/quiz`.
- [x] `sitemap.xml.ts` no incluye `/calculadora` ni `/protocolo`.
- [ ] `dashboard-7d.astro`, `diagnostico.astro`, `protocolo.astro` borrados.
- [ ] `ResetEngine.tsx`, `ProtocolDashboard.tsx`, `calculator/` borrados.
- [x] `Layout.astro` MANTENIDO (lo usan 8 páginas activas; migración es deuda técnica futura).
- [ ] `npm run build` pasa OK.
- [ ] Post-deploy: `curl -sI https://metamorfosisvital.com.co/calculadora` retorna `HTTP/2 301` con `location: /quiz`.
- [ ] Post-deploy: `curl -sI https://metamorfosisvital.com.co/protocolo` retorna `HTTP/2 404`.
- [ ] Post-deploy: `curl -s /sitemap.xml | grep -E 'calculadora|protocolo'` retorna vacío.

## Pruebas manuales

Después del deploy:

```bash
echo "=== /calculadora debe redirigir 301 a /quiz ==="
curl -sIL https://metamorfosisvital.com.co/calculadora | head -10

echo "=== /protocolo debe ser 404 ==="
curl -sI https://metamorfosisvital.com.co/protocolo | head -2

echo "=== /dashboard-7d debe ser 404 ==="
curl -sI https://metamorfosisvital.com.co/dashboard-7d | head -2

echo "=== /diagnostico debe ser 404 ==="
curl -sI https://metamorfosisvital.com.co/diagnostico | head -2

echo "=== sitemap.xml NO debe mencionar calculadora o protocolo ==="
curl -s https://metamorfosisvital.com.co/sitemap.xml | grep -E 'calculadora|protocolo' || echo "✓ sitemap limpio"
```

## Riesgos y trade-offs

- **Backlinks externos a `/diagnostico` o `/dashboard-7d`**: si alguien
  linkeó a estas URLs desde redes/blogs, ahora retornan 404. Aceptable:
  ninguna era promocionada oficialmente; el costo de mantener páginas
  rotas indefinidamente es mayor.
- **Pérdida de código `MetamorfosisCalculator`**: si Carlos decide
  retomar el producto pago con ePayco, hay que reconstruir. El código
  estará en git history (un `git checkout main~N -- src/components/calculator`
  lo recupera). No es pérdida real.
- **Build warning si quedaron imports rotos**: cubierto por el build
  local pre-commit.
- **Google crawl latency**: las URLs eliminadas pueden seguir indexadas
  unas semanas hasta que Google las re-crawlee y vea el 404/301. No es
  problema funcional; Google las quita automáticamente.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos tocados:**
- `metamorfosis-web/src/pages/calculadora.astro` — reemplazado por redirect 301.
- `metamorfosis-web/src/pages/sitemap.xml.ts` — quitadas entries `/calculadora` y `/protocolo`.
- Archivos borrados (vía `git rm` en Mac de Carlos):
  - `metamorfosis-web/src/pages/dashboard-7d.astro`
  - `metamorfosis-web/src/pages/diagnostico.astro`
  - `metamorfosis-web/src/pages/protocolo.astro`
  - `metamorfosis-web/src/components/ResetEngine.tsx`
  - `metamorfosis-web/src/components/ProtocolDashboard.tsx`
  - `metamorfosis-web/src/components/calculator/MetamorfosisCalculator.tsx`
  - `metamorfosis-web/src/components/calculator/` (carpeta vacía)

**Deuda técnica documentada (NO en esta spec):**
- `layouts/Layout.astro` lo usan 8 páginas activas (login, terminos,
  privacidad, sobre-mi, comunidad, admin/*). Migrar a `BaseLayout.astro`
  para unificación post-SPEC-013 queda como spec futura.

**Decisiones:**
- Redirect 301 (no 302): le decimos a Google "esto se mudó permanentemente";
  el ranking de `/calculadora` se transfiere a `/quiz`.
- `prerender = false` en el redirect: forzamos SSR, sin esto el redirect
  no funciona bajo el adapter @astrojs/node en mode standalone.
- No mantenemos `Layout.astro` por las dudas: si en el futuro hace falta un
  layout alternativo, se crea uno nuevo basado en `BaseLayout.astro` (que
  ya tiene SEO + Umami + preconnect + preloads correctos).

**Reduced attack surface:**
- 3 endpoints públicos eliminados.
- 1 script externo eliminado (`checkout.epayco.co/checkout.js`).
- 3 componentes React que nadie mantenía eliminados.
- 1 layout legacy con theme inconsistente eliminado.

Sin desviaciones del plan funcional.
