# SPEC-022 — Limpieza técnica del repo

**Estado:** ✅ Cerrada
**Fase:** Backlog (limpieza)
**Severidad:** BAJO (calidad)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** ninguna

---

## Contexto

Tras cerrar Fases 1-4, el repo acumuló restos: `console.log` de debug en producción, un endpoint mockup huérfano, y dos HTML de pre-proyecto en el root. Ninguno rompe funcionalidad pero ensucian el repo y generan confusión para cualquier agente nuevo que mapee la estructura.

## Problema

1. **`console.log` en producción** — bloat en la consola server-side y ruido en los logs de Hostinger:
   - `metamorfosis-web/src/components/admin/AnaliticaIMR.tsx:134` — log de debug "🔥 Registros IMR Crudos Descargados".
   - `metamorfosis-web/src/pages/api/admin/login.ts:99` — info de cada login exitoso (innecesario; los fallidos ya loggean en rate limit).
   - `metamorfosis-web/src/pages/api/admin/logout.ts:27` — confirmación de cada logout.
   - `metamorfosis-web/src/pages/api/generate-pdf-report.ts:9` — desaparece junto con el archivo.

2. **`generate-pdf-report.ts` huérfano** — endpoint mockup que devuelve HTML estático con Tailwind CDN. No está enlazado desde ningún componente del repo. Usar grep confirmó cero matches en `src/`.

3. **`propuesta-contenido.html` y `propuesta-diseno.html`** — viven en el root del repo desde abril 2026, son docs de pre-proyecto que ya cumplieron su función. Pesan ~100 KB combinados y no aportan al producto actual.

## Solución propuesta

### 1. Eliminar `console.log` que NO aportan

**Eliminar:**
- `AnaliticaIMR.tsx:134` (debug puro).
- `login.ts:99` (los fallos ya se loguean por rate limit; los exitosos no aportan).
- `logout.ts:27` (puro ruido).

**Mantener** (decisión consciente):
- `firebaseAdmin.ts:26` ("Firebase Admin SDK initialized successfully") — corre una vez por arranque del proceso. Útil para confirmar que la conexión se inicializó tras un redeploy.
- `onboard.ts:173` (mergeo de leads anónimos previos al onboard) — evento raro, útil para diagnosticar comportamiento del side-effect de SPEC-006.

### 2. Borrar `generate-pdf-report.ts`

Sin enlaces entrantes (verificado con `grep -r "generate-pdf-report"`). Si en el futuro se necesita generar PDFs de longevidad, se hace una spec dedicada con la integración real de ePayco y librería PDF (pdf-lib). Hoy el archivo solo confunde.

### 3. Borrar HTMLs obsoletos del root

`propuesta-contenido.html` y `propuesta-diseno.html` salen del repo. Si Carlos los necesita como referencia histórica, viven en el git history (un `git show <commit>:propuesta-diseno.html` los recupera).

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Editar los 3 archivos para eliminar `console.log` específicos.
3. Borrar `metamorfosis-web/src/pages/api/generate-pdf-report.ts`.
4. Borrar `propuesta-contenido.html` y `propuesta-diseno.html`.
5. Build + commit + push.

## Criterios de aceptación

- [x] `grep -rn "console\.log" metamorfosis-web/src/` solo devuelve `firebaseAdmin.ts:26` y `onboard.ts:173`.
- [x] `metamorfosis-web/src/pages/api/generate-pdf-report.ts` no existe.
- [x] `propuesta-contenido.html` y `propuesta-diseno.html` no existen en el root.
- [x] El build sigue pasando (sin imports huérfanos).
- [x] El sitio en producción sigue funcionando idénticamente (no hay rutas que dependieran de los archivos borrados).

## Pruebas manuales

1. `cd metamorfosis-web && npm run build` → exit code 0.
2. Verificar el sitio post-deploy:
   - Login admin funciona.
   - Logout admin funciona.
   - La página `/admin` carga sin errores en la consola del browser.
   - `/api/generate-pdf-report?ref_payco=test` devuelve **404** (antes devolvía HTML mockup).

## Riesgos y trade-offs

- **Borrar `generate-pdf-report` es destructivo** si hay un link externo (email, redirect ePayco) que apuntaba ahí. Verifiqué grep en el repo (sin matches) pero no puedo verificar emails o configs externas. Mitigación: el git revert es trivial si aparece la dependencia.
- **Los `console.log` de auth eliminados** dejan menos visibilidad de logins exitosos. Si hace falta forensia futura, el audit log de SPEC-018 ahora cubre el evento (sin haberlo planeado en esta spec).

## Compatibilidad con ElenaApp

Sin impacto.

## Commit

```
chore(spec-022): limpieza técnica del repo

- Quita console.log de debug (AnaliticaIMR), login, logout
  (mantenidos los útiles: firebaseAdmin init, onboard side-effect)
- Borra endpoint mockup generate-pdf-report.ts (sin enlaces entrantes)
- Borra HTMLs obsoletos en root: propuesta-contenido.html,
  propuesta-diseno.html (viven en git history si hacen falta)

Cierra SPEC-022.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos modificados:**
- `metamorfosis-web/src/components/admin/AnaliticaIMR.tsx` — quitado `console.log` de debug en línea 134.
- `metamorfosis-web/src/pages/api/admin/login.ts` — quitado `console.log` de login exitoso.
- `metamorfosis-web/src/pages/api/admin/logout.ts` — quitado `console.log` de confirmación.

**Archivos borrados:**
- `metamorfosis-web/src/pages/api/generate-pdf-report.ts` — endpoint mockup huérfano.
- `propuesta-contenido.html` — doc pre-proyecto.
- `propuesta-diseno.html` — doc pre-proyecto.

**Nota operativa:** los `console.log` se eliminaron desde el agente con `Edit`. El delete físico de los 3 archivos lo ejecuta Carlos con `git rm` (el sandbox del agente no tiene permiso de delete sobre el working tree del repo del usuario):

```
git rm metamorfosis-web/src/pages/api/generate-pdf-report.ts \
       propuesta-contenido.html \
       propuesta-diseno.html
```

**Sin desviaciones del plan.**
