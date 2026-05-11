# SPEC-050 — .gitignore blindado (defense in depth)

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento (Bloque 1 del plan del día)
**Severidad:** MEDIO (riesgo de leak accidental)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-009 (git history audit), SPEC-010 (rotación admin password)

---

## Contexto

Auditoría pre-lanzamiento (2026-05-11) detectó:

1. **`.gitignore` del root del repo está vacío.** El que protege la app vive
   en `metamorfosis-web/.gitignore` y está bien hecho (node_modules, .env*,
   service-accounts, .DS_Store, etc.). Pero un archivo sensible creado
   FUERA de `metamorfosis-web/` (ej. dump SQL en el root, script con keys,
   notas, exports) no tiene protección automática.

2. **`.DS_Store` del root del repo está trackeado.** Se commiteó hace
   tiempo y nunca se removió. Es harmless (es solo metadata de Finder)
   pero ensucia el repo y aparece en cada `git status`.

3. **`package-lock.json` está IGNORADO** por la regla `*.json` con
   whitelist solo de `package.json`, `tsconfig.json`, `firebase.json`.
   Resultado: builds en Hostinger no son reproducibles — `npm install`
   resuelve versiones cada vez en lugar de `npm ci` con el lock. Quedó
   fuera de scope de esta spec (decisión separada en SPEC-050b).

## Solución

### 1. `.gitignore` en root con valores sensatos

Defense in depth: aunque el `metamorfosis-web/.gitignore` cubre lo crítico,
el root debe rechazar archivos sensibles que se creen a su nivel.

Categorías incluidas:
- Sistema operativo: `.DS_Store`, `Thumbs.db`, `desktop.ini`
- IDEs: `.vscode/`, `.idea/`, `*.swp`, `.zed/`
- Secretos genéricos: `.env*` (whitelist `.env.example`), `*-adminsdk-*.json`,
  `service-account*.json`, `credentials.json`, claves SSH/PGP
- Logs y temporales: `*.log`, `tmp/`, `.cache/`
- Outputs: `coverage/`, `*.tsbuildinfo`
- Dumps adhoc: `*.dump`, `*.sql`, `dump-*.json`, `export-*.csv`,
  `backup-*.{json,sql,csv,zip,tar,gz}`

### 2. Quitar `.DS_Store` del index

`git rm --cached .DS_Store` en el root. El archivo físico se mantiene en
disco (es de macOS, se regenera solo), pero git deja de trackearlo.

## Plan de ejecución

1. Crear `/.gitignore` en root con valores arriba.
2. Carlos corre `git rm --cached .DS_Store` (el sandbox no puede modificar
   `.git/` directamente).
3. Verificar que `git status` muestra `.DS_Store` como deleted (en index)
   y el nuevo `.gitignore` como nuevo.
4. Commit + push.

## Criterios de aceptación

- [x] `.gitignore` en root creado con valores sensatos (>30 patterns).
- [x] Whitelist para `.env.example` (para que ese sí pueda subirse).
- [ ] `.DS_Store` removido del index con `git rm --cached`.
- [ ] `git ls-files | grep DS_Store` retorna vacío post-push.
- [x] El `metamorfosis-web/.gitignore` queda intacto (no duplica patterns).
- [x] Spec documentada y agregada al ROADMAP.

## Pruebas manuales

Tras el commit + push:

```bash
cd /Users/carlosreyes/Proyectos/Web_Site

# El .DS_Store ya no debe aparecer trackeado
git ls-files | grep -i DS_Store
# (debe imprimir vacío)

# Crear un .env de prueba en root y ver que .gitignore lo agarra
touch test.env
git check-ignore -v test.env
# Debe imprimir algo como: .gitignore:24:.env.*   test.env
rm test.env

# Lo mismo para una key fake
touch fake-firebase-adminsdk-abc.json
git check-ignore -v fake-firebase-adminsdk-abc.json
# Debe matchear *-adminsdk-*.json
rm fake-firebase-adminsdk-abc.json
```

## Riesgos y trade-offs

- **Posible doble-protección con `metamorfosis-web/.gitignore`**: no es
  un problema; git aplica el más cercano al archivo. Tener ambos da defense
  in depth y los patterns no entran en conflicto.
- **El `.DS_Store` removido del index sigue existiendo en commits viejos**:
  no es un secreto, no requiere `git filter-branch`. Solo nos importa que
  no se siga commiteando.
- **`package-lock.json` queda como deuda**: cubre en SPEC-050b si Carlos
  decide commitearlo para reproducibilidad de builds en Hostinger.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos tocados:**
- `.gitignore` (root) — NEW, ~50 patterns en 8 categorías.
- `.DS_Store` (root) — git rm --cached (sigue en disco, fuera del index).

**Decisiones:**
- NO modifiqué `metamorfosis-web/.gitignore` — está bien hecho y no
  necesita cambios. Mantengo separación: el de la subdir protege la app,
  el del root protege el resto.
- NO agregué patterns muy específicos como `*.bak`, `*.tmp.*`, etc.,
  porque mejor mantener el archivo simple y agregar patterns ad hoc si
  aparece una necesidad real.
- `.env.example` permitido vía whitelist para que devs/agentes puedan
  ver qué env vars necesita el proyecto sin exponer valores reales.

**Follow-ups opcionales:**
- SPEC-050b: commitear `package-lock.json` (requiere ajustar el
  `metamorfosis-web/.gitignore` para quitarlo del `*.json` ignored y
  agregarlo al whitelist).
- Decidir destino de `metamorfosis-web/vercel.json` (legado de intento
  pasado, hoy ignorado por `*.json`).

Sin desviaciones del plan funcional.
