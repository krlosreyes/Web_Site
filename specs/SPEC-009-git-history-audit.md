# SPEC-009 — Auditar git history por credenciales filtradas

**Estado:** 📝 Spec
**Fase:** 2
**Severidad:** ALTO (depende del hallazgo)
**Fecha de creación:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** ninguna

---

## Contexto

Durante el WIP previo a SPEC-001, varios archivos sensibles podrían haber sido commiteados accidentalmente al repo público `krlosreyes2/Web_Site`:

- `metamorfosis-web/.env` con `FIREBASE_PRIVATE_KEY` y `ADMIN_PASSWORD`.
- `metamorfosis-web/elena-app-2026-v1-firebase-adminsdk-*.json` (service account).

El `.gitignore` actual los protege:
```
.env
.env.*
!.env.example
*.json
!package.json
!tsconfig.json
!firebase.json
service-account-*.json
*-adminsdk-*.json
elena-app-2026-v1-firebase-adminsdk-*.json
```

Pero el `.gitignore` solo previene futuros commits — no remueve archivos ya en el historial. Si en algún momento se commiteó alguno, **la credencial está expuesta en GitHub público**.

## Problema

No sabemos si `.env`, la service account JSON, o secretos similares aparecen en algún commit del historial del repo público. Si aparecen, hay que rotar credenciales y limpiar historial.

## Solución propuesta

Auditoría sistemática del historial git y reacción según hallazgo.

## Plan de implementación

### 1. Búsqueda en historial

Carlos corre estos comandos desde la raíz del repo:

```sh
cd ~/Proyectos/Web_Site

# (a) ¿Algún archivo .env apareció alguna vez?
echo "=== .env files ==="
git log --all --diff-filter=A --name-only -- '**/.env' '**/.env.*' 2>/dev/null | grep -v '^$\|^commit\|^Author\|^Date' | sort -u

# (b) ¿Algún service account JSON apareció?
echo "=== service account JSONs ==="
git log --all --diff-filter=A --name-only -- '**/*-adminsdk-*.json' 'service-account-*.json' 2>/dev/null | grep -v '^$\|^commit\|^Author\|^Date' | sort -u

# (c) ¿Aparece la cadena "BEGIN PRIVATE KEY" en algún commit?
echo "=== BEGIN PRIVATE KEY ==="
git log -p --all -S "BEGIN PRIVATE KEY" --pretty=format:'%h %s' 2>/dev/null | head -50

# (d) ¿Aparece ADMIN_PASSWORD con un valor concreto?
echo "=== ADMIN_PASSWORD literals ==="
git log -p --all -S "ADMIN_PASSWORD" --pretty=format:'%h %s' 2>/dev/null | head -50

# (e) ¿Aparece la API key de Firebase pública? (no es crítica pero confirma scope)
echo "=== Firebase API key ==="
git log -p --all -S "AIzaSyDjutyeWEfZyN2pqmEgM1aEEdidKyekLtk" --pretty=format:'%h %s' 2>/dev/null | head -10
```

### 2. Análisis de hallazgos

Tres escenarios:

**Escenario A — Repo limpio.** Los outputs (a)-(d) están vacíos. El `.gitignore` siempre protegió. ✅ Cierra spec sin acciones adicionales (más allá de mantener el `.gitignore`).

**Escenario B — `.env` o `.json` apareció en algún commit pero ya no está en HEAD.** El historial GitHub público lo expone aunque el archivo actual no exista. Acciones obligatorias:
1. **Rotar service account de Firebase Admin** (Firebase Console → Project Settings → Service Accounts → Generate new private key, descargar JSON). Eliminar la clave vieja.
2. **Rotar `ADMIN_PASSWORD`** (SPEC-010).
3. **Limpiar historial git** con `git filter-repo` (recomendado) o `BFG Repo-Cleaner`. Force push al remote. **Esto reescribe SHAs**: cualquier clon o fork queda inválido.
4. Después del filter-repo, todos los colaboradores tienen que clonar de nuevo (Carlos es el único, así que no hay fricción).

**Escenario C — Aparece en HEAD también.** El archivo está actualmente en el repo público. Acciones de B + eliminación inmediata del archivo + commit + push.

### 3. Comandos para Escenario B/C (si aplica)

```sh
# Backup del repo antes de tocar el historial
cd ~/Proyectos
cp -r Web_Site Web_Site_backup_$(date +%Y%m%d)

# Instalar git-filter-repo si no lo tenés
brew install git-filter-repo

# Eliminar archivos sensibles del historial completo
cd ~/Proyectos/Web_Site
git filter-repo --path-glob '*.env' --invert-paths
git filter-repo --path-glob '*-adminsdk-*.json' --invert-paths

# Verificar que ya no aparecen
git log -p --all -S "BEGIN PRIVATE KEY" | head -5
# Esperado: vacío

# Re-agregar el remote (filter-repo lo elimina)
git remote add origin https://github.com/krlosreyes/Web_Site.git
git push origin --force --all
git push origin --force --tags
```

### 4. Documentar en `SECURITY.md`

Independiente del hallazgo, dejar nota en repo:

```md
# SECURITY.md

## Manejo de secretos

- `.env` contiene `FIREBASE_PRIVATE_KEY`, `ADMIN_PASSWORD`, etc.
  Está en `.gitignore` — NUNCA debe commitearse.
- Service accounts JSON (`*-adminsdk-*.json`) están en `.gitignore`.
  Se descargan de Firebase Console, no se versionan.
- Variables de entorno productivas viven en hPanel (Hostinger Node.js App).
  Para desarrollo local, copiar `.env.example` a `.env` y rellenar.

## Si un secreto se filtra

1. Rotar inmediatamente en el origen (Firebase Console / hPanel).
2. Limpiar historial git con `git-filter-repo`.
3. Notificar al equipo (re-clonar repo).
```

## Criterios de aceptación

- [ ] Los 5 comandos de auditoría se ejecutaron y se documentó el resultado.
- [ ] Si Escenario A: spec cerrada con nota "historial limpio, sin acciones".
- [ ] Si Escenario B/C: service account rotada en Firebase Console; historial git limpiado; force push hecho; verificación de que la cadena "BEGIN PRIVATE KEY" no aparece en `git log -p --all`.
- [ ] `SECURITY.md` agregado al repo en raíz.

## Pruebas

```sh
# Después de filter-repo (si aplicó):
git log -p --all -S "BEGIN PRIVATE KEY" | wc -l
# Esperado: 0

git log --all --name-only -- '**/.env' | wc -l
# Esperado: 0
```

## Riesgos / consideraciones

- **`git filter-repo` reescribe SHAs.** Cualquier persona con un clon viejo (incluyendo CI antiguos) verá conflictos. En este proyecto Carlos es el único colaborador, así que no es problema, pero conviene anotarlo.
- **GitHub mantiene caches** de objetos por un tiempo después del filter-repo. Para purga inmediata, abrir issue en GitHub Support solicitando cache flush. En la práctica, asumir que cualquier credencial filtrada está comprometida — rotarla, no confiar en filter-repo solo.
- **Buscar también en GitHub Code Search** (https://github.com/search?type=code&q=AIzaSyDjutyeWEfZyN2pqmEgM1aEEdidKyekLtk) por la API key u otro secret específico. Si aparece en otros repos (forks, gists), no se puede limpiar — solo rotar.

## Commit

```
docs(spec-009): SECURITY.md y resultado de auditoría git history

Auditoría del historial git por credenciales filtradas. Resultado:
[Escenario A | B | C — completar tras correr los comandos].

[Si A] Historial limpio: el .gitignore actual siempre protegió .env y
service accounts. No se requiere rotación. SECURITY.md documenta el
proceso para futuros equipos.

[Si B/C] Service account rotada en Firebase Console (clave vieja
inhabilitada). Historial limpiado con git-filter-repo. Force push a
origin. ADMIN_PASSWORD rotado en SPEC-010 (siguiente).

Cierra specs/SPEC-009-git-history-audit.md
```

---

## Resultado

*(Pendiente de auditoría.)*
