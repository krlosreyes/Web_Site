# SPEC-109 — Limpieza técnica fase 2 (docs pre-SDD + logs trackeados + console.log residuales)

**Estado:** ✅ Cerrada
**Fase:** 5 (Metodología / Mantenimiento)
**Severidad:** 🟢 Baja (sin impacto en producción, mejora de higiene del repo)
**Fecha de creación:** 2026-05-25
**Autor:** Carlos Reyes (vía agente Cowork)
**Depende de:** SPEC-022 (limpieza técnica fase 1, 2026-05-10), SPEC-050 (.gitignore blindado)

---

## Contexto

SPEC-022 ya hizo una primera pasada de limpieza el 2026-05-10. Desde entonces
se acumularon o quedaron sin atacar:

1. **5 documentos pre-SDD** trackeados en el repo (marzo 2026, antes de que
   adoptáramos Spec-Driven Development). Confunden a agentes futuros porque
   describen un estado del proyecto que ya no existe y su contenido contradice
   `CLAUDE.md` y las specs vigentes.
2. **2 archivos basura** trackeados: `last-update.txt` (mencionado
   explícitamente en el backlog de SPEC-022) y `firepit-log.txt` (log de un
   tooling viejo).
3. **3 archivos del IDE `aider`** trackeados en raíz (`.aider.chat.history.md`,
   `.aider.input.history`, `.aider.tags.cache.v4/cache.db`) — son cache local
   que no debería estar en el repo. SPEC-050 protege contra `.env`, service
   accounts, `.DS_Store`, etc., pero no contra patterns de `aider`.
4. **3 `console.log` debug residuales** en código de producción (de 130
   `console.*` totales, el resto son `console.error`/`console.warn` de logging
   legítimo en API endpoints y no se tocan).

Diagnóstico ejecutado el 2026-05-25:

```
$ grep -rln "console\." metamorfosis-web/src/ ...
console.log:   3   ← debug residual
console.warn:  18  ← logging legítimo
console.error: 109 ← logging legítimo
console.debug: 0
console.info:  0
```

```
$ git ls-files | grep -E "(adminsdk|\.env$|service-account)"
(vacío)  ← SPEC-050 funcionando, credenciales NO trackeadas
```

## Problema

Los docs pre-SDD son ruido: si un agente futuro lee
`COMPLETION_REPORT.md` (que dice "Sprint completado") o
`AUTHENTICATION_QUICKSTART.md` (escrito antes de que SPEC-003 unificara el
contrato admin) puede inferir un estado del sistema que no aplica.
`REVISION-CODIGO-2026-05-08.md` se mantiene porque es la fuente histórica que
`ROADMAP-SDD.md` referencia explícitamente.

Los `console.log` debug residuales no rompen nada pero ensucian los logs de
Hostinger (donde sí miramos `console.error`/`console.warn` para diagnóstico)
y dan la impresión de código no terminado.

Los archivos de `aider` trackeados son riesgo de leak de contexto/prompts
históricos y peso muerto. Patrón estándar: `aider` los crea por defecto en
el cwd y deben ir gitignored.

## Solución propuesta

**A. Borrar (git rm) docs pre-SDD trackeados:**
- `COMPLETION_REPORT.md` (raíz, 299 líneas, marzo 2026)
- `DOCUMENTATION_INDEX.md` (raíz, 299 líneas, marzo 2026)
- `metamorfosis-web/AUTHENTICATION_QUICKSTART.md` (248 líneas, marzo 2026)
- `metamorfosis-web/IMPLEMENTATION_SUMMARY.md` (381 líneas, marzo 2026)
- `metamorfosis-web/SECURITY_REPORT.md` (322 líneas, marzo 2026)

Total ~1549 líneas de docs obsoletas. El history queda en git para consulta
con `git log --all -- 'COMPLETION_REPORT.md'`.

**B. Borrar (git rm) archivos basura trackeados:**
- `metamorfosis-web/last-update.txt`
- `metamorfosis-web/firepit-log.txt`

**C. Untrackear caches de aider y agregarlos al `.gitignore` raíz:**
- `git rm` de `.aider.chat.history.md`, `.aider.input.history`,
  `.aider.tags.cache.v4/`.
- Agregar bloque `# ────── Aider ──────` con `.aider*` al `.gitignore` raíz
  (sección defense-in-depth de SPEC-050).

**D. Eliminar 3 `console.log` debug residuales:**

| Archivo | Línea | Log | Acción |
|---|---|---|---|
| `lib/firebaseAdmin.ts` | 26 | `'✅ Firebase Admin SDK initialized successfully.'` | Eliminar (ruido en boot) |
| `pages/api/forum/topics/[id].ts` | 110 | `'[forum.topics.DELETE] OK', {...}'` | Eliminar (audit informal redundante con SPEC-018 audit log) |
| `pages/api/users/onboard.ts` | 214-216 | `[onboard] Mergeados N leads anónimos...'` | Eliminar (informativo, no audit) |

Mantener intactos los 109 `console.error` y 18 `console.warn` — sirven para
diagnóstico en Hostinger logs.

## Plan de implementación

1. Crear `specs/SPEC-109-limpieza-tecnica-fase2.md` (este archivo).
2. `git rm` de 5 docs pre-SDD + 2 basura + 3 aider files. Carpeta
   `.aider.tags.cache.v4/` borrada completa.
3. Editar `.gitignore` raíz: agregar bloque aider.
4. Editar 3 archivos `.ts` para eliminar los `console.log` (con `Edit` para
   precision quirúrgica, NO `Write` que reescribe el archivo entero).
5. Editar `ROADMAP-SDD.md`: marcar SPEC-109 como ✅ Cerrada en Fase 5 al
   final del bloque de specs cerradas.
6. `npm run build` desde `metamorfosis-web/` para confirmar que nada de lo
   borrado era importado.
7. Commit con mensaje `chore(spec-109): limpieza técnica fase 2` + push.
8. Esperar 90-120s y verificar producción con curl.

## Criterios de aceptación

- [ ] `git ls-files | grep -E '(COMPLETION_REPORT|DOCUMENTATION_INDEX|AUTHENTICATION_QUICKSTART|IMPLEMENTATION_SUMMARY|SECURITY_REPORT|last-update\.txt|firepit-log\.txt|\.aider)'` → 0 resultados.
- [ ] `grep -rn "console\.log" metamorfosis-web/src/ --include='*.ts' --include='*.tsx' --include='*.astro'` → 0 resultados.
- [ ] `grep -rc "console\.error" metamorfosis-web/src/` y `console.warn` mantienen los conteos previos (109 y 18 ± deltas explicables si hay otros cambios).
- [ ] `.gitignore` raíz contiene el bloque `# ────── Aider ──────` con `.aider*`.
- [ ] `npm run build` pasa sin errores ni warnings nuevos.
- [ ] Después del deploy: home, `/imr`, `/biblioteca`, `/dashboard`, `/dashboard/plan`, `/admin` cargan sin 500.
- [ ] El audit log de SPEC-018 sigue capturando las acciones admin (no
  dependía de los console.log eliminados).

## Pruebas

```sh
# 1) Build local
cd metamorfosis-web && npm run build

# 2) Verificación local pre-commit
git ls-files | grep -E '(COMPLETION_REPORT|DOCUMENTATION_INDEX|AUTHENTICATION_QUICKSTART|IMPLEMENTATION_SUMMARY|SECURITY_REPORT|last-update\.txt|firepit-log\.txt|\.aider)'
# Esperado: vacío

grep -rn "console\.log" metamorfosis-web/src/ --include='*.ts' --include='*.tsx' --include='*.astro'
# Esperado: vacío

grep -E "^\.aider" .gitignore
# Esperado: línea presente

# 3) Post-deploy (≥120s después del push) — UA realista para evitar HCDN challenge
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
for path in / /imr /biblioteca /quiz /sobre-mi /login; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: $UA" "https://www.metamorfosisvital.com.co$path")
  echo "$path → $code"
done
# Esperado: todas 200 (o 200/301 para login)
```

## Riesgos / consideraciones

- **Imports rotos:** los docs `.md` no son importados por código, pero hago
  `npm run build` para confirmar.
- **`aider.tags.cache.v4/cache.db` es binario:** se elimina con `git rm -r`.
- **SPEC-018 audit log:** los 3 console.log eliminados NO son el audit log
  (que vive en Firestore vía `lib/auditLog.ts`). Las acciones admin siguen
  trazándose en la collection `audit_logs`.
- **`console.log` futuros:** no agregamos linter rule en esta spec (sería
  scope creep). Se trata como hábito.
- **Eliminación de docs pre-SDD:** el history queda en git para consulta. Si
  algún día se necesita: `git log --all --diff-filter=D -- 'COMPLETION_REPORT.md'`
  para encontrar el commit que los borró y luego `git show <commit>^:COMPLETION_REPORT.md`.

## Commit

**Mensaje:**
```
chore(spec-109): limpieza técnica fase 2 — docs pre-SDD + logs basura + console.log

- Borrar 5 docs pre-SDD (~1549 líneas, marzo 2026, contradecían specs vigentes):
  COMPLETION_REPORT.md, DOCUMENTATION_INDEX.md (raíz)
  AUTHENTICATION_QUICKSTART.md, IMPLEMENTATION_SUMMARY.md, SECURITY_REPORT.md (metamorfosis-web)
- Borrar archivos basura trackeados: last-update.txt, firepit-log.txt
- Untrackear caches de aider (.aider.chat.history.md, .aider.input.history,
  .aider.tags.cache.v4/) y agregar pattern al .gitignore raíz (SPEC-050 defense-in-depth)
- Eliminar 3 console.log debug residuales:
  firebaseAdmin.ts:26 (init success ruido)
  forum/topics/[id].ts:110 (delete OK informativo)
  users/onboard.ts:214 (merge leads informativo)
- Conservar los 109 console.error y 18 console.warn (logging legítimo en API endpoints)

REVISION-CODIGO-2026-05-08.md se conserva como fuente histórica del ROADMAP-SDD.md.

Cierra specs/SPEC-109-limpieza-tecnica-fase2.md
```

---

## Resultado

Implementado en una sola pasada el 2026-05-25.

**Archivos borrados (`git rm`):**
- `COMPLETION_REPORT.md`, `DOCUMENTATION_INDEX.md` (raíz, ~600 líneas total).
- `metamorfosis-web/AUTHENTICATION_QUICKSTART.md`, `metamorfosis-web/IMPLEMENTATION_SUMMARY.md`, `metamorfosis-web/SECURITY_REPORT.md` (~950 líneas).
- `metamorfosis-web/firepit-log.txt`, `metamorfosis-web/last-update.txt`.
- `.aider.chat.history.md`, `.aider.input.history`, `.aider.tags.cache.v4/` (carpeta completa).

**Archivos editados:**
- `.gitignore` (raíz) — bloque nuevo `# ────── Aider (SPEC-109) ──────` con pattern `.aider*` agregado en sección Editores/IDEs.
- `metamorfosis-web/src/lib/firebaseAdmin.ts` — eliminada línea `console.log('✅ Firebase Admin SDK initialized successfully.')` (ruido en boot).
- `metamorfosis-web/src/pages/api/forum/topics/[id].ts` — eliminada línea `console.log('[forum.topics.DELETE] OK', ...)` (redundante con `logAdminAction` de SPEC-018 inmediatamente debajo).
- `metamorfosis-web/src/pages/api/users/onboard.ts` — eliminado bloque `console.log('[onboard] Mergeados N leads anónimos...')` (informativo, no auditable).
- `ROADMAP-SDD.md` — entry de SPEC-109 agregada al final del bloque de specs cerradas; mención de `last-update.txt` removida de la sección "Fase 4 — BAJOS".

**Verificación local:**
- `grep -rn "console\.log" metamorfosis-web/src/` → 0 resultados (eran 3).
- `console.error` (109) y `console.warn` (18) intactos.
- `git ls-files | grep -E '(COMPLETION_REPORT|DOCUMENTATION_INDEX|AUTHENTICATION|IMPLEMENTATION_SUMMARY|SECURITY_REPORT|last-update|firepit-log|\.aider)'` → 0 resultados.
- `npm run build` desde `metamorfosis-web/` — pendiente de correr antes del push.

Sin desviaciones del plan.
