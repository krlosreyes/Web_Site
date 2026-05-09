# SPEC-010 — Rotar ADMIN_PASSWORD

**Estado:** ✅ Cerrada
**Fase:** 2
**Severidad:** ALTO
**Fecha de creación:** 2026-05-09
**Cerrada:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** SPEC-001 (deploy), SPEC-003 (auth admin), SPEC-009 (auditoría — define si la rotación es urgente)

---

## Contexto

`ADMIN_PASSWORD = "Metamorfosis2026*"` estuvo en `.env` durante el WIP previo a SPEC-001. Aunque hoy el `.env` está en `.gitignore`, el password en sí es:

- Conocido por Claude (lo vio durante el debugging de SPEC-001 y SPEC-003).
- Posiblemente en algún commit antiguo si SPEC-009 lo confirma.
- Posiblemente cacheado en navegadores, screenshots, logs o sesiones de Claude.
- Predecible si alguien conoce el patrón de naming del producto ("Metamorfosis2026" + sufijo común).

Cualquiera de esas vías hace que el password actual deba considerarse **comprometido**, aunque la probabilidad real sea baja.

## Problema

El único factor de auth admin es `ADMIN_PASSWORD`. Si está comprometido, alguien puede acceder al panel admin y borrar/modificar artículos, leer leads, etc.

## Solución propuesta

Generar una nueva contraseña random (32 chars), actualizarla en hPanel, reiniciar la app, verificar que el flow admin funciona end-to-end. El password viejo queda obsoleto.

## Plan de implementación

### 1. Generar password nuevo (Carlos en su terminal)

```sh
# Genera 32 caracteres alfanuméricos + símbolos seguros
openssl rand -base64 32 | tr -d '+/=' | head -c 32 ; echo
# Ejemplo de output: "K7hG9vNxQ4rT2bL8jF6sZ1dW3pY5cM0e"
```

Copiar el valor resultante. **No usar palabras del dominio** (Metamorfosis, IMR, salud, etc.) — random es más seguro.

### 2. Actualizar en hPanel

1. Abrir hPanel → Sitios web → metamorfosisvital.com.co → Node.js App → "Ajustes y reimplementación".
2. Sección "Variables de entorno" → editar `ADMIN_PASSWORD` → pegar el nuevo valor (sin comillas envolventes).
3. Guardar.
4. Click "Reimplementar" o "Restart" para que el proceso Node tome el nuevo valor.
5. Esperar ~60 segundos.

### 3. Actualizar `.env` local (Carlos en su máquina)

```sh
cd ~/Proyectos/Web_Site/metamorfosis-web
# Editar .env y reemplazar la línea de ADMIN_PASSWORD con el nuevo valor.
# El .env está en .gitignore, así que no se commitea.
```

### 4. Verificar end-to-end

```sh
# Login con el password VIEJO debería fallar
echo "--- Login con password viejo (esperado: 401):"
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://metamorfosisvital.com.co/api/admin/login \
    -H 'Content-Type: application/json' \
    -d '{"password":"Metamorfosis2026*"}'

# Login con password nuevo (poniéndolo en una variable temporal por seguridad)
echo "--- Login con password nuevo (esperado: 200):"
read -s NEW_PASS
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://metamorfosisvital.com.co/api/admin/login \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${NEW_PASS}\"}"
unset NEW_PASS
```

### 5. Documentar en gestor de credenciales

Carlos guarda el nuevo password en su gestor (1Password, Bitwarden, llavero del Mac, etc.). NO en archivo plano fuera de `.env`.

### 6. Considerar rate limit history

El rate limit in-memory de `auth.ts` se resetea con cada restart. Tras la rotación + restart, no quedan registros de intentos previos.

## Criterios de aceptación

- [ ] Nuevo `ADMIN_PASSWORD` generado con `openssl rand` (32 chars random, no derivado del dominio).
- [ ] Variable actualizada en hPanel + app reiniciada.
- [ ] `.env` local actualizado.
- [ ] Login con password viejo (`Metamorfosis2026*`) → 401.
- [ ] Login con password nuevo → 200 + cookie.
- [ ] Password nuevo guardado en gestor de credenciales (acción manual de Carlos).
- [ ] Memory file de Claude actualizado para reflejar que `ADMIN_PASSWORD` ya no es `Metamorfosis2026*` (no guardar el nuevo valor; solo invalidar referencias al viejo).

## Pruebas

```sh
# El test anterior. Esperás 401 con viejo y 200 con nuevo.
```

## Riesgos / consideraciones

- **Si la app no arranca tras el cambio**: probablemente el nuevo password tiene un caracter que se interpreta raro (`#`, `;`, `\`, etc.). Solución: usar `openssl rand -hex 32` que da solo hex chars, sin símbolos.
- **Si Carlos olvida el password nuevo**: puede regenerar otro siguiendo los mismos pasos. El acceso al hPanel siempre está disponible mediante la cuenta de Hostinger principal.
- **Sesiones existentes no se invalidan**: la cookie `admin_session=firebase_auth` actual sigue válida hasta su expiry (24h). Para invalidar todas las sesiones inmediatamente, cambiar el valor de `SESSION_VALUE` en `auth.ts` (de `'firebase_auth'` a otro literal) — eso requiere otro deploy. Si no es urgente, esperar las 24h.
- **Single-factor admin sigue siendo vulnerable a phishing**. La rotación no protege contra eso. Mejora futura: agregar TOTP / 2FA real (otra spec).

## Commit

```
chore(spec-010): rotar ADMIN_PASSWORD

El password anterior (Metamorfosis2026*) estuvo en .env durante WIP y
en sesiones de debugging. Considerado comprometido por exposición.
Nuevo password generado con openssl rand, 32 chars random, almacenado
en hPanel env vars y gestor de credenciales personal.

Sin cambios de código. Solo documentación + memoria.

Cierra specs/SPEC-010-rotate-admin-password.md
```

---

## Resultado

Rotación ejecutada manualmente por Carlos el 2026-05-09. Sin cambios de código.

**Acciones tomadas:**

- Nuevo `ADMIN_PASSWORD` generado con `openssl rand -base64 32 | tr -d '+/=' | head -c 32`.
- Variable actualizada en hPanel → Node.js App → variables de entorno.
- Reimplementación disparada para que el proceso Node tome el nuevo valor.
- `.env` local actualizado.
- Nuevo password guardado en gestor de credenciales personal.
- Memoria de Claude actualizada (`project_metamorfosis_real_stack.md`) para invalidar referencias al valor anterior `Metamorfosis2026*`.

**Verificación:**

- Login con password viejo (`Metamorfosis2026*`) → 401 Unauthorized ✅
- Login con password nuevo → 200 OK + cookie ✅

**Aprendizajes:**

- **Rotaciones de credenciales son pequeñas operaciones manuales** que se reducen a 5 pasos cuando el sistema ya tiene un canal limpio (env vars en hPanel + restart). Sin esa base, rotar es mucho más doloroso.
- **No registrar passwords literales en specs**. Esta lección quedó en SPEC-009 — futuras specs deben usar placeholders (`<ADMIN_PASSWORD>`, `***`).
- **Single-factor admin sigue siendo single-factor.** La rotación protege contra el password viejo expuesto, no contra phishing futuro. Si en algún momento se quiere 2FA real (TOTP), eso es otra spec.

**Pendientes:** ninguno. Spec cerrada. Fase 2 completa.
