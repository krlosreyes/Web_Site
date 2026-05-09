# SPEC-003 — Unificar contrato de autenticación admin

**Estado:** ✅ Cerrada
**Fase:** 1
**Severidad:** CRÍTICO
**Fecha de creación:** 2026-05-08
**Cerrada:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** SPEC-001 (deploy), SPEC-002 (cleanup) — recomendado tenerlas cerradas para verificar end-to-end

---

## Contexto

Hoy hay **cinco lugares** que hablan sobre la cookie `admin_session` y **no se ponen de acuerdo** sobre qué valor esperan:

| Archivo | Cómo valida |
|---|---|
| `src/pages/admin/login.astro:21` | `sessionCookie.value === ADMIN_PASSWORD` (raw string) |
| `src/pages/admin/dashboard.astro:22` | `sessionCookie.value === ADMIN_PASSWORD` (raw string) |
| `src/components/Footer.astro:13` | `value === 'firebase_auth' \|\| value === ADMIN_PASSWORD` |
| `src/lib/auth.ts → isAuthenticatedFromCookie` | `constantTimeCompare(sessionCookie, ADMIN_PASSWORD)` (lo usan todos los `/api/admin/*`) |
| `src/pages/api/admin/login.ts` (POST) | **emite cookie con valor `'firebase_auth'`** vía `createSecureSessionCookie('firebase_auth')` |
| `src/components/admin/AdminLogin.tsx:22` | `document.cookie = admin_session=<adminCode>` (cliente, sin HttpOnly/Secure/SameSite) y **no llama** al endpoint `/api/admin/login` |

Las consecuencias prácticas:

1. **Si el admin se loguea por el endpoint `/api/admin/login` (POST)**, recibe cookie con valor `'firebase_auth'`. Las APIs admin (`isAuthenticatedFromCookie`) la rechazan porque comparan contra `ADMIN_PASSWORD`. **No puede acceder a sus propias APIs.**
2. **Si el admin se loguea por `AdminLogin.tsx`** (el componente que sí se está usando hoy), pone la cookie del lado cliente con el password raw. Pasa por `admin/dashboard.astro`. Pero al ser cookie sin `HttpOnly`, JS de cualquier origen tras un XSS la lee.
3. El componente `AdminLogin.tsx` no usa el rate limiting ni la sanitización del endpoint `/api/admin/login.ts` — todo eso que existe en `auth.ts` está muerto.
4. `Footer.astro` muestra "modo admin" si la cookie es `'firebase_auth'` o el password — pero como las APIs no aceptan `'firebase_auth'`, el footer puede mentir.

## Problema

El sitio tiene dos sistemas de auth admin parcialmente implementados que no son interoperables. Hay que elegir uno y eliminar el otro.

## Solución propuesta

**Adoptar el contrato de `auth.ts` (cookie `'firebase_auth'` emitida por servidor) y migrar todo lo demás a él.**

Razones:
- Es el más seguro: cookie `HttpOnly` + `Secure` + `SameSite=Strict` + rate limiting + constant-time + sanitización. Toda esa lógica ya está escrita.
- Mover el password raw a la cookie es una mala práctica que conviene erradicar.
- El nombre `'firebase_auth'` es un valor opaco, no revela el secreto. Si en el futuro queremos reemplazar por un JWT firmado, solo cambia `createSecureSessionCookie` y `isAuthenticatedFromCookie`.

**Cambios concretos:**

1. `isAuthenticatedFromCookie` deja de comparar contra `ADMIN_PASSWORD` y compara contra el valor opaco `'firebase_auth'`. (Actualmente compara contra `ADMIN_PASSWORD`, lo que es un bug — el endpoint emite `'firebase_auth'` pero el verificador busca el password.)
2. `admin/login.astro` y `admin/dashboard.astro` dejan de comparar `sessionCookie.value === ADMIN_PASSWORD`. Pasan a usar `isAuthenticatedFromCookie` igual que las APIs.
3. `Footer.astro` deja de mostrar "modo admin" basado en cookie raw. Pasa a usar `isAuthenticatedFromCookie`. (O directamente eliminamos el indicador del footer y dejamos el botón "Admin" para todos, ver SPEC futura — pero no en esta spec.)
4. `AdminLogin.tsx` deja de setear cookie del lado cliente. Llama a `POST /api/admin/login` con el password, y el servidor emite la cookie segura. Si el login es exitoso, redirige a `/admin/dashboard`.

**Decisión sobre el "doble factor" actual:** el componente actual pide email + password de Firebase + adminCode. La realidad es que Firebase Auth no se está usando para autorizar acceso al panel — solo el `adminCode` (== `ADMIN_PASSWORD`) define la sesión. Mantener la confusión es peor que simplificar. Dos opciones:

- **(A) Simplificar a un solo factor:** solo `ADMIN_PASSWORD`. Limpio, una sola fuente de verdad. **Recomendado para esta spec.**
- **(B) Doble factor real:** validar Firebase Auth en el servidor (vía Firebase Admin SDK con un ID token enviado por el cliente) Y password admin. Se hace, pero es trabajo de otra spec (Fase 2 si se quiere).

Esta spec adopta la opción (A). Si más adelante se quiere doble factor, se abre una spec dedicada.

## Plan de implementación

1. **Modificar `src/lib/auth.ts`**:
   - Cambiar `isAuthenticatedFromCookie` para comparar contra el literal `'firebase_auth'` (no contra `ADMIN_PASSWORD`):
     ```ts
     const SESSION_VALUE = 'firebase_auth';

     export function isAuthenticatedFromCookie(cookies: Record<string, string>): boolean {
       const sessionCookie = cookies['admin_session'];
       if (!sessionCookie) return false;
       return constantTimeCompare(sessionCookie, SESSION_VALUE);
     }
     ```
   - Mantener `verifyAdminPassword` igual (sigue validando el password contra `ADMIN_PASSWORD` env).
   - Mantener `createSecureSessionCookie('firebase_auth')` como está.

2. **Modificar `src/pages/admin/login.astro`**:
   - Reemplazar la comparación raw `sessionCookie.value === ADMIN_PASSWORD` por `isAuthenticatedFromCookie(parseCookies(...))`.
   - Eliminar el código que normaliza `ADMIN_PASSWORD` con `slice(1, -1)` (ya no se usa para validación).

3. **Modificar `src/pages/admin/dashboard.astro`**:
   - Igual que login.astro: usar `isAuthenticatedFromCookie`.
   - El handler de logout (`?logout=true`) sigue igual: borra la cookie.

4. **Modificar `src/components/Footer.astro`**:
   - Reemplazar:
     ```ts
     const isAdmin = sessionCookie && (sessionCookie.value === 'firebase_auth' || sessionCookie.value === ADMIN_PASSWORD);
     ```
     por:
     ```ts
     const isAdmin = isAuthenticatedFromCookie(parseCookies({ headers: Astro.request.headers } as any));
     ```
     (o mejor, que `auth.ts` exponga una helper `isAdminFromAstro(Astro)` para no copiar el parser).
   - El throw de `ADMIN_PASSWORD must be set in production` ya no aplica al footer; sí a las APIs. Mover ese check fuera del footer.

5. **Modificar `src/components/admin/AdminLogin.tsx`**:
   - Eliminar `signInWithEmailAndPassword(auth, email, password)`.
   - Eliminar `document.cookie = ...`.
   - Eliminar los inputs `email` y `password` (Firebase). Dejar solo el input "Código de Acceso Admin".
   - Reemplazar el handler:
     ```tsx
     const handleLogin = async (e: React.FormEvent) => {
       e.preventDefault();
       setErrorMsg('');
       setIsLoading(true);
       try {
         const res = await fetch('/api/admin/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           credentials: 'include',
           body: JSON.stringify({ password: adminCode }),
         });
         const data = await res.json();
         if (!res.ok) {
           setErrorMsg(data.error || 'Credenciales inválidas');
           return;
         }
         window.location.href = data.redirect || '/admin/dashboard';
       } catch (err) {
         setErrorMsg('Error de red. Intenta de nuevo.');
       } finally {
         setIsLoading(false);
       }
     };
     ```
   - Actualizar copy ("Doble Factor Requerido" → "Acceso Admin") para reflejar la realidad.

6. **Verificar API `/api/admin/login.ts`**: ya está correcta. Confirmar que `password` en el body es el único campo que lee.

7. **Logout**:
   - `admin/dashboard.astro` actualmente hace `?logout=true` y borra la cookie server-side. Mantener.
   - El botón en el header del dashboard hace `signOut(auth)` de Firebase + redirige. Como ya no usamos Firebase Auth para admin, eliminar ese `signOut` y dejar solo la redirección al endpoint de logout.
   - Considerar exponer `POST /api/admin/logout` (ya existe en `api/admin/logout.ts`) y llamar desde el botón.

8. **Grep final** para asegurar que no queda comparación raw:
   ```sh
   grep -rn "sessionCookie.value === ADMIN_PASSWORD\|'firebase_auth'" metamorfosis-web/src
   # solo deberían quedar referencias en auth.ts y api/admin/login.ts
   ```

## Criterios de aceptación

- [ ] Solo `auth.ts` y `api/admin/login.ts` mencionan el literal `'firebase_auth'`.
- [ ] Ningún `.astro` ni `.tsx` compara `sessionCookie.value === ADMIN_PASSWORD` directamente.
- [ ] `AdminLogin.tsx` ya no llama a `signInWithEmailAndPassword` ni setea `document.cookie`.
- [ ] Login flujo completo:
  1. `GET /admin/login` → carga form.
  2. Submit con password correcto → `POST /api/admin/login` → setea `Set-Cookie: admin_session=firebase_auth; HttpOnly; Secure; SameSite=Strict; ...`.
  3. Redirige a `/admin/dashboard`.
  4. `GET /admin/dashboard` con esa cookie → carga.
  5. `GET /api/admin/posts` con esa cookie → 200.
- [ ] Login con password incorrecto → 401, no setea cookie, mensaje en UI.
- [ ] Más de 5 intentos en un minuto → 429.
- [ ] Cookie es `HttpOnly` (verificable con `document.cookie` en consola: no debe aparecer).
- [ ] Logout (`?logout=true` o `/api/admin/logout`) borra cookie y redirige a `/admin/login`.

## Pruebas

```sh
# 1. Build no rompe
cd metamorfosis-web && npm run build

# 2. Login flow contra dev server
npm run dev &
sleep 3

# 2a. Sin cookie → /admin/dashboard redirige a /admin/login
curl -sI http://localhost:4321/admin/dashboard
# Esperado: 302 Location: /admin/login

# 2b. Login correcto
curl -i -X POST http://localhost:4321/api/admin/login \
    -H 'Content-Type: application/json' \
    -d '{"password":"<ADMIN_PASSWORD del .env>"}'
# Esperado: 200 Set-Cookie: admin_session=firebase_auth; ...

# 2c. Capturar cookie
COOKIE=$(curl -s -X POST http://localhost:4321/api/admin/login \
    -H 'Content-Type: application/json' \
    -d '{"password":"<ADMIN_PASSWORD>"}' \
    -i | grep -i 'set-cookie' | head -1 | sed 's/Set-Cookie: //;s/;.*//')

# 2d. Acceder al dashboard con cookie
curl -sI -b "$COOKIE" http://localhost:4321/admin/dashboard
# Esperado: 200

# 2e. API admin con cookie
curl -sI -b "$COOKIE" http://localhost:4321/api/admin/posts
# Esperado: 200

# 2f. Login incorrecto
for i in 1 2 3 4 5 6; do
  curl -s -X POST http://localhost:4321/api/admin/login \
    -H 'Content-Type: application/json' \
    -d '{"password":"wrong"}' \
    -o /dev/null -w "%{http_code}\n"
done
# Esperado: 401, 401, 401, 401, 401, 429
```

## Riesgos / consideraciones

- **Sesiones activas se invalidan.** Cualquier admin con la cookie vieja (= password raw) deja de tener acceso. Hay que comunicar el cambio (basta con un mensaje a Carlos: "vas a tener que loguearte de nuevo").
- **Firebase Auth queda fuera del flujo admin.** Si en el futuro se quiere usar Firebase para identificar quién es el admin (ej. logs por usuario), se reintroduce con una spec dedicada que valide ID tokens server-side.
- **El endpoint `/api/admin/login` ya tiene rate limiting in-memory.** En Vercel con varias funciones serverless, ese rate limit es por instancia, no global. Aceptable para un panel admin con 1 usuario; si crece, mover a Firestore o Upstash Redis (otra spec).
- **`createSecureSessionCookie` setea `Secure` solo si `import.meta.env.PROD`.** En local (`npm run dev`) la cookie no será Secure, lo cual es correcto (HTTP). Verificar que en preview de Vercel sí lo sea.

## Commit

**Mensaje sugerido:**
```
refactor(spec-003): unificar contrato de auth admin

- isAuthenticatedFromCookie compara contra valor opaco 'firebase_auth'
  (antes comparaba contra ADMIN_PASSWORD, dejando inutilizada la cookie
  emitida por /api/admin/login)
- admin/login.astro y admin/dashboard.astro pasan a usar el helper en
  lugar de comparar raw el password
- Footer.astro idem
- AdminLogin.tsx ahora llama a POST /api/admin/login en vez de setear
  document.cookie del lado cliente; aprovecha rate limiting y cookie
  HttpOnly+Secure+SameSite del servidor
- Eliminados inputs de Firebase Auth en el form admin (no aportaban
  validación server-side)

Cierra specs/SPEC-003-admin-auth-contract.md
```

---

## Resultado

Implementada y verificada en producción contra `https://metamorfosisvital.com.co` el 2026-05-09.

**Cambios mergeados** (commit `5e28643`):

- `src/lib/auth.ts`:
  - Agregada constante `SESSION_VALUE = 'firebase_auth'` exportada como fuente única de verdad.
  - Agregado helper `isValidSessionValue(value: string | undefined | null)` para uso desde `.astro` files que ya tienen el valor crudo de la cookie (`Astro.cookies.get(...)?.value`).
  - `isAuthenticatedFromCookie` ahora compara contra `SESSION_VALUE` (no contra `ADMIN_PASSWORD`). Esto cierra el bug raíz: la cookie emitida por `/api/admin/login.ts` ahora la acepta el resto del sistema.
  - `verifyAdminPassword` (que sí valida el password en login) sin cambios.
- `src/pages/admin/login.astro`:
  - Usa `isValidSessionValue(sessionCookie?.value)` y `enforceProductionSecurity()` centralizado en `auth.ts`.
  - Eliminada la normalización inline de `ADMIN_PASSWORD` (las comillas envolventes ya no aplican porque la página no compara contra el password).
- `src/pages/admin/dashboard.astro`:
  - Mismo patrón. Logout reordenado para que el handler `?logout=true` corra **antes** del check de sesión (si no, la cookie ya estaría borrada cuando se chequea).
  - El script del botón "Salir" ahora llama a `POST /api/admin/logout` y al server-side redirect; eliminado `signOut(auth)` de Firebase.
- `src/pages/admin/analitica-imr.astro`:
  - Mismo refactor que `dashboard.astro`. Estaba en la mira porque tenía el patrón viejo (no estaba en la spec original; se descubrió con `grep` final).
- `src/components/Footer.astro`:
  - Pasa a `isValidSessionValue`. Eliminado el `throw new Error('ADMIN_PASSWORD must be set in production')`: el footer se renderiza en TODAS las páginas, así que si rompía el render del sitio entero por env var faltante. La validación de env vars vive ahora solo en `enforceProductionSecurity()` que se llama desde páginas/APIs que sí necesitan el password.
- `src/components/admin/AdminLogin.tsx`:
  - Reescrito como single-factor (solo `ADMIN_PASSWORD`). Llama a `POST /api/admin/login` con `credentials: 'include'`; el servidor emite la cookie segura.
  - Eliminado `signInWithEmailAndPassword` y los inputs de email/password Firebase.
  - Eliminado `document.cookie = ...` del cliente — el flow ahora pasa por el endpoint con HttpOnly+Secure+SameSite=Strict.
  - Manejo de errores explícito por status code (401, 429, 400, otros).

**Verificación end-to-end:**

```
POST /api/admin/cleanup  (sin cookie)
→ 401 {"error":"Unauthorized"}

POST /api/admin/login    (password incorrecto)
→ 401 {"error":"Invalid credentials"}

POST /api/admin/login    (password correcto)
→ 200 {"success":true,"redirect":"/admin/dashboard"}
   Set-Cookie: admin_session=firebase_auth; Path=/; Secure; HttpOnly; SameSite=Strict; Expires=...

POST /api/admin/cleanup  (con cookie capturada)
→ 200 {"success":true,"deletedCount":0}
```

El último escalón valida también el criterio pendiente de SPEC-002 (happy path con cookie admin válida).

**Criterios de aceptación cumplidos:**

- [x] Solo `auth.ts` y `api/admin/login.ts` mencionan el literal `'firebase_auth'` (verificado con `grep`; los demás archivos importan `SESSION_VALUE` o usan `isValidSessionValue`).
- [x] Ningún `.astro` ni `.tsx` compara `sessionCookie.value === ADMIN_PASSWORD` directamente.
- [x] `AdminLogin.tsx` ya no llama a `signInWithEmailAndPassword` ni setea `document.cookie`.
- [x] Login flujo completo (5 pasos del checklist) funciona en producción.
- [x] Login con password incorrecto → 401, no setea cookie.
- [x] Cookie es `HttpOnly` + `Secure` + `SameSite=Strict` (verificado en headers `Set-Cookie`).
- [x] Logout: el handler `?logout=true` borra cookie y redirige.
- [ ] Rate limit: más de 5 intentos en un minuto → 429. **No verificado en producción** (saltarse por respeto al sistema de Hostinger). El código está y el rate limit es 5/60s en memoria por instancia.

**Desviaciones del plan original:**

1. **Cuarto archivo agregado al scope.** El plan listaba 4 archivos a modificar (auth.ts, login.astro, dashboard.astro, Footer.astro, AdminLogin.tsx). Al hacer `grep` final apareció `pages/admin/analitica-imr.astro` con el mismo patrón viejo (`sessionCookie.value === "firebase_auth" || sessionCookie.value === ADMIN_PASSWORD`). Se incluyó en la misma spec porque era literalmente el mismo refactor; mantenerlo afuera dejaba un endpoint inconsistente.

2. **Helper `isValidSessionValue` agregado.** No estaba previsto. Surgió porque los `.astro` files trabajan con `Astro.cookies.get(...)?.value` (string), no con un `Record<string, string>` — armar el record solo para llamar `isAuthenticatedFromCookie` era código de pegamento innecesario. La helper recibe el valor crudo y delega al mismo `constantTimeCompare`.

3. **Footer.astro: eliminado el throw de production.** Antes el componente tiraba `Error` si no había `ADMIN_PASSWORD` en env vars de producción. Como el footer aparece en TODAS las páginas, una env var faltante volaba el render completo del sitio. La validación se centralizó en `enforceProductionSecurity()` y solo se invoca desde páginas/APIs que usan el password (login, dashboard, analitica-imr, las APIs admin). El footer ahora solo lee la cookie y muestra/oculta UI condicional sin imponer restricciones globales.

4. **Reordenamiento del logout en dashboard.astro y analitica-imr.astro.** En el código original el handler de `?logout=true` corría DESPUÉS del check de sesión, lo cual era inocuo pero raro: la cookie todavía estaba presente al momento del check. Lo movimos antes del check para que el flujo sea coherente: borrás cookie → redirigís → no se evalúa sesión.

5. **Smoke test inicial falló por deploy stale.** El primer test del happy path (curl 3d) volvió 401 porque corrió ~1 minuto después del push, antes de que Hostinger terminara el redeploy. Reintento dos minutos después dio 200. Aprendizaje: dejar 90-120s entre `git push` y verificación productiva.

**Aprendizajes:**

- **Una "fuente única de verdad" para el contrato de auth (la constante `SESSION_VALUE`)** evita que aparezcan comparaciones inconsistentes esparcidas por el código. Si en el futuro queremos rotar a JWT firmado, solo cambia esa constante y la lógica de `createSecureSessionCookie` + `isValidSessionValue`.
- **`grep` final post-implementación es esencial.** Sin él no se descubre el archivo extra (`analitica-imr.astro`) que necesitaba el mismo refactor.
- **Validar/throw en componentes globales es peligroso.** El footer está en todas las páginas; un throw ahí ataja el render del sitio entero. Centralizar checks en `enforceProductionSecurity` y llamarlo solo desde páginas/APIs que usan el password.
- **Hostinger Node.js Apps necesita ~90-120s post-push** para que el deploy se aplique. Tener cuenta en futuras specs.

**Cierre tardío con tres fix follow-ups (commits 43694e3, 8e62852, 9e3d8e2 aprox):**

Después del refactor inicial (`5e28643`) salieron tres bugs encadenados que extendieron la spec más de lo razonable:

1. **`fix(spec-003): Navbar refleja sesión admin`** — el Navbar global no detectaba la cookie admin (su script solo escuchaba `onAuthStateChanged` de Firebase). Aplicado el mismo patrón server-side de `Footer.astro`: leer la cookie con `isValidSessionValue` y renderizar UI condicional ("Modo Admin" + botón "Cerrar Sesión" rojo) cuando hay sesión admin.

2. **`fix(spec-003): logout no borraba cookie por flag Secure faltante`** — `createLogoutCookie()` y `Astro.cookies.delete()` no incluían `Secure` cuando emitían la cookie de borrado. La cookie original tenía `Secure; HttpOnly; SameSite=Strict; Path=/`. Al diferir en `Secure`, los navegadores en HTTPS ignoraban el `Set-Cookie` de logout y la sesión sobrevivía. Resultado: bug crítico de seguridad — el botón "Cerrar Sesión" parecía funcionar (redirigía a `/`) pero la cookie persistía y `/admin/dashboard` seguía siendo accesible sin re-login.

3. **`fix(spec-003): logout fetch con Content-Type:application/json`** — los botones "Cerrar Sesión" del Navbar y del header del dashboard hacían `fetch('/api/admin/logout', { method: 'POST' })` **sin** header `Content-Type`. Astro 6 trata POST sin JSON como form submission y lo rechaza con 403 "Cross-site POST form submissions are forbidden" antes de llegar al handler. `fetch()` con 403 NO lanza excepción (solo errores de red lo hacen), así que el `try/catch` no se enteraba y `window.location.href = '/'` daba la falsa sensación de logout exitoso. La cookie nunca se borraba.

**Aprendizajes clave que se memorizan para no repetir:**

- En Astro 6, **todo `fetch` POST desde JS a `/api/*` debe incluir `Content-Type: application/json`**. Sin él, 403 CSRF antes del handler. Mismo gotcha cometido dos veces seguidas en este proyecto (cleanup y logout).
- **Las cookies de invalidación deben matchear flags exactos** (Secure, HttpOnly, SameSite, Path) de la cookie original o el browser las ignora.
- **`fetch` con 4xx/5xx no lanza excepción** — siempre chequear `res.ok` explícitamente y loguear si hay rechazo.
- **Cuando un fix expone otro bug**, no pedir verificación parcial. Implementar TODOS los fixes que se descubran de una sola pasada para no entrar en loop iterativo. Carlos valora su tiempo y este loop lo costó ~1 hora.

**Pendientes que se mueven a otras specs:**

- Verificación de rate limit en producción → backlog Fase 3.
- Si en algún momento querés más de un admin (tu equipo crece), abrir nueva spec para reintroducir Firebase Auth con roles + el password actual como segundo factor real.
- Rotar `ADMIN_PASSWORD` (estuvo en repo durante WIP histórico) → Fase 2.
