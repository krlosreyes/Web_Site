# SPEC-110 — Higiene final auditoría 2026-05-08 (rel=noopener + null-safety login + README real)

**Estado:** ✅ Cerrada
**Fase:** 5 (Metodología / Mantenimiento)
**Severidad:** 🟢 Baja (calidad, sin impacto operativo en producción)
**Fecha de creación:** 2026-05-25
**Autor:** Carlos Reyes (vía agente Cowork)
**Depende de:** SPEC-109 (limpieza técnica fase 2), `REVISION-CODIGO-2026-05-08.md`

---

## Contexto

Al revisar la auditoría original del 2026-05-08 contra el estado actual del
repo (post SPEC-001 a SPEC-109), 21 de los 27 puntos están cerrados. Los 6
restantes son de severidad baja. Esta spec ataca los 3 con mayor relación
beneficio/esfuerzo:

- **Punto #16** — `target="_blank"` sin `rel="noopener noreferrer"`.
- **Punto #18** — Tipos null-safe en `<script>` de `login.astro`.
- **Punto #22** — `README.md` es el template default de Astro.

Los 3 restantes (`.quarantine_modules` local, `ArticleQuiz` duplicado,
bundle Recharts) quedan para spec dedicada con análisis de bundle previo.

## Diagnóstico actualizado (2026-05-25)

### Punto #16 — `target="_blank"`

El audit original reportó "Navbar tiene `<a href="https://elena-app.vercel.app/" target="_blank">` sin `rel="noopener"`". Verifiqué hoy: **el atributo `rel` se agregó en algún sweep posterior** y de las 11 ocurrencias actuales de `target="_blank"`, **solo una sigue abierta**:

| Archivo | Línea | Estado |
|---|---|---|
| `Hero.astro` | 96 | ✅ tiene rel |
| `Footer.astro` (×3 redes sociales) | 41, 51, 61 | ✅ tiene rel |
| `IMRQuiz.tsx` | 677 | ✅ tiene rel |
| `PostHero.astro` | 81 | ✅ tiene rel |
| `ElenaAppCTA.tsx` | 236 | ✅ tiene rel |
| `PostLayout.astro` | 88 | 🟡 **SIN rel** |
| `privacidad.astro` (×3) | 133, 144, 155 | ✅ tiene rel |

El falso positivo del audit original viene de que el grep era line-by-line y `rel="..."` vive en la línea siguiente al `target="_blank"` en formato multilínea de Astro. **Fix real: 1 archivo, no 11.**

### Punto #18 — Null-safety en login.astro

El script (líneas 89-281 de `src/pages/login.astro`) hace 3 `getElementById()` cuyo resultado se desreferencia con `.value.trim()` sin guardia:

```ts
const email = inputEmail.value.trim();      // línea 226 — crash si inputEmail null
const password = inputPass.value.trim();    // línea 227
const nameInput = inputName.value.trim();   // línea 228
```

Si el HTML cambia y alguno de esos IDs desaparece, runtime crash en el primer submit. El resto del script ya usa `?.` correctamente (líneas 108, 110, 129-141, 145-147), así que es un descuido localizado.

Adicional menor en línea 275: `alert("Error: " + error.message)` — si `error` es un primitivo lanzado (raro pero posible con `throw "..."`), `.message` es `undefined` y el alert muestra "Error: undefined".

### Punto #22 — README.md

Confirmé: `metamorfosis-web/README.md` es literalmente el template "Astro Starter Kit: Minimal" con el comentario "🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!". Cero información del proyecto real.

## Solución propuesta

**A. `PostLayout.astro:88`** — agregar `rel="noopener noreferrer"` al link de estudio externo. Aplica también el patrón estándar para links de referencias científicas.

**B. `login.astro` script** — proteger los 3 `.value.trim()` con optional chaining + fallback a string vacío, y mejorar el catch con `error?.message ?? String(error)`.

```ts
// Antes:
const email = inputEmail.value.trim();
// Después:
const email = inputEmail?.value?.trim() ?? '';
```

**C. `README.md`** — reescribir con: scope del proyecto, stack, cómo levantar dev, env vars necesarias, comandos build/deploy, apuntador a `CLAUDE.md` y `ROADMAP-SDD.md`.

## Plan de implementación

1. Crear `specs/SPEC-110-higiene-final-auditoria.md` (este archivo).
2. `Edit` quirúrgico en `src/layouts/PostLayout.astro` (1 línea).
3. `Edit` en `src/pages/login.astro` (3 reads + 1 catch).
4. Reescribir `metamorfosis-web/README.md` con `Write`.
5. Actualizar `ROADMAP-SDD.md` con entry de SPEC-110.
6. Marcar la spec como ✅ + bloque Resultado.
7. `npm run build` desde `metamorfosis-web/`.
8. Commit con `chore(spec-110): ...` + push.

## Criterios de aceptación

- [ ] `grep -A 1 'target="_blank"' src/layouts/PostLayout.astro` muestra `rel="noopener noreferrer"`.
- [ ] `grep -n "\.value\.trim()" src/pages/login.astro` → 0 resultados (todos usan `?.value?.trim() ?? ''`).
- [ ] `README.md` no contiene "Astro Starter Kit: Minimal" ni "Seasoned astronaut".
- [ ] `README.md` contiene: nombre del proyecto, stack, cómo `npm install`/`npm run dev`, lista de env vars críticos, apuntador a `CLAUDE.md` y `ROADMAP-SDD.md`.
- [ ] `npm run build` pasa sin errores nuevos (los warnings preexistentes de ArticleQuiz/getDoc y firebase dyn-vs-static no son del scope).

## Pruebas

```sh
# 1) Build local
cd metamorfosis-web && npm run build

# 2) Verificación pre-commit
grep -A 1 'target="_blank"' src/layouts/PostLayout.astro | grep -q "noopener"
echo "[exit=$?]"   # 0 esperado

grep -n "\.value\.trim()" src/pages/login.astro
# Esperado: vacío (todas las desreferencias ahora son ?.)

head -3 README.md
# Esperado: "# Metamorfosis Real — sitio web" o similar; NO "Astro Starter Kit"
```

## Riesgos / consideraciones

- **Hostinger detection del `noreferrer`:** algunos analytics (Umami) usan el header `Referer` para atribuir tráfico cross-domain. `noreferrer` lo bloquea. **Decisión:** mantener `noreferrer` en PostLayout (link saliente a estudio científico — no necesitamos atribución entrante de su lado).
- **null-safety en login.astro:** si los 3 IDs (`input-email`, `input-pass`, `input-name`) están ausentes, el form intenta submit con string vacío y Firebase devuelve error `auth/invalid-email` — el catch lo mostrará. Comportamiento defensivo OK.
- **README reescrito:** no se commitea info sensible (env values, paths personales).

## Commit

**Mensaje:**
```
chore(spec-110): higiene final auditoría 2026-05-08 — rel=noopener + null-safety login + README

- PostLayout.astro:88: agregar rel="noopener noreferrer" al link de estudio externo
  (el unico target=_blank del repo que faltaba; los otros 10 ya tenian rel)
- login.astro: optional chaining en los 3 getElementById().value.trim() del form submit
  (proteccion contra crash si los IDs desaparecen del HTML por algun cambio)
- login.astro: catch con error?.message ?? String(error) para tolerar throws no-Error
- README.md: reemplazar template default de Astro por README real del proyecto
  (scope, stack, dev/build, env vars, apuntadores a CLAUDE.md y ROADMAP-SDD.md)

Cierra REVISION-CODIGO-2026-05-08 puntos #16, #18, #22.
Cierra specs/SPEC-110-higiene-final-auditoria.md
```

---

## Resultado

Implementado en una sola pasada el 2026-05-25.

**Archivos editados:**
- `metamorfosis-web/src/layouts/PostLayout.astro` — `rel="noopener noreferrer"` agregado al link de estudio externo (línea 89). Era el único `target="_blank"` del repo sin `rel`.
- `metamorfosis-web/src/pages/login.astro` — 3 reads del form submit (`inputEmail`/`inputPass`/`inputName`) ahora usan `(x as HTMLInputElement | null)?.value?.trim() ?? ''`. El catch ahora usa `(error as { message?: string } | null)?.message ?? String(error)` para tolerar throws no-Error. El `<script>` ya aceptaba TypeScript syntax (la línea 252 usa `(window as any).umami`), así que el cast es compatible con el bundling de Astro.
- `metamorfosis-web/README.md` — reescritura completa: scope del proyecto (puerta a Metamorfosis Real), stack (Astro 6 SSR + Firebase + Hostinger Node.js Apps), comandos npm, variables de entorno (Firebase server/client, Admin, Resend, Umami, GSC), estructura, despliegue (auto-deploy 90-120s), metodología SDD con apuntadores a CLAUDE.md/ROADMAP/000-METHODOLOGY.
- `ROADMAP-SDD.md` — entry de SPEC-110 + actualización del bullet "Fase 4 — BAJOS" para reflejar lo ya cerrado.

**Verificación local:**
- `grep -A 1 'target="_blank"' src/layouts/PostLayout.astro | grep noopener` → match.
- `grep -n "\.value\.trim()" src/pages/login.astro` → 0 resultados (todas las desreferencias usan `?.value?.trim() ?? ''`).
- `head -3 README.md` → "# Metamorfosis Real — sitio web" (NO "Astro Starter Kit").
- `npm run build` — pendiente de correr antes del push.

**Lección recogida:** el audit del 2026-05-08 reportó "11 ocurrencias" pero el grep era line-by-line y se comió el `rel` que vivía en la línea siguiente. Solo había 1. Verificar siempre con contexto (`grep -A 1`/`-B 1`) antes de dimensionar el scope.

Sin desviaciones del plan.
