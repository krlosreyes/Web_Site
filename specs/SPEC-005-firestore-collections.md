# SPEC-005 — Unificar colecciones Firestore

**Estado:** 📝 Spec
**Fase:** 1
**Severidad:** CRÍTICO
**Fecha de creación:** 2026-05-08
**Autor:** Carlos Reyes
**Depende de:** SPEC-001 (deploy) — útil para verificar end-to-end con datos reales

---

## Contexto

Hay dos inconsistencias separadas pero relacionadas:

### 5.1 — Bug en `stats.ts`

`metamorfosis-web/src/pages/api/admin/stats.ts:21`:

```ts
const postsRef = db.collection('post');   // ← singular
```

Todo el resto del código usa `'metamorfosis_posts'`:

```
src/pages/biblioteca.astro:8:        const postsRef = db.collection('metamorfosis_posts');
src/pages/posts/[slug].astro:14:     const postsRef = db.collection("metamorfosis_posts");
src/pages/api/calculate-imr.ts:36:   const docRef = db.collection('metamorfosis_posts').doc(...)
src/pages/api/admin/posts.ts:21,88,104,124:  db.collection('metamorfosis_posts')
src/pages/api/admin/cleanup.ts:5:    const postsRef = db.collection('metamorfosis_posts');
```

El admin dashboard muestra "Total Posts: 0" siempre porque `'post'` (singular) no existe.

### 5.2 — Perfiles dispersos en dos colecciones

| Colección | Dónde se usa |
|---|---|
| `profiles` | `pages/login.astro:120,131`, `components/BioDashboard.tsx:29` |
| `users` | `components/IMRQuiz.tsx:64,88`, `components/BioDashboard.tsx:37`, `components/ArticleQuiz.tsx:93` |

`BioDashboard.tsx` lee de **las dos** y mergea — workaround que evidencia el problema. Si un usuario se registró por `/login.astro`, su perfil está en `profiles`. Si se registró por el quiz, en `users`. El IMR puede vivir en una y el `userName` en la otra.

## Problema

`stats.ts` consulta una colección que no existe (bug fácil). Y los perfiles de usuario están duplicados o partidos entre dos colecciones, generando lógica de merge frágil.

## Solución propuesta

### 5.1 — Corregir `stats.ts`

Cambiar `'post'` → `'metamorfosis_posts'`. Trivial.

### 5.2 — Elegir `users` como colección canónica de perfil

Razones:
- `users` es más estándar en aplicaciones Firebase y es el nombre que ya usa la app móvil ElenaApp (asumiblemente — confirmar con Carlos).
- Tres archivos usan `users` vs dos `profiles`.
- El IMR del quiz (que es el dato más cargado de valor) ya vive en `users`.

**Migración de datos legacy en `profiles` → `users`:**

Usuarios registrados antes de esta spec quedaron en `profiles/{email}` con `{ userName, email, imr, interpretation, updatedAt }`. Los movemos a `users/{email}`, fusionando con lo que ya esté ahí (no pisar `imr` reciente del quiz).

Estrategia de migración:
1. Script único `metamorfosis-web/scripts/migrate-profiles-to-users.ts` que itera `profiles`, hace `users/{id}.set(data, { merge: true })` priorizando lo que ya hay en `users` para campos comunes, y al final borra los docs de `profiles`.
2. Ejecutar una vez en local apuntando a Firestore prod (con service account de admin, fuera del repo).
3. Después del run, verificar `profiles` está vacía. Eliminar referencias a `profiles` en código.

**Actualización de código (post-migración):**

- `pages/login.astro` → `doc(db, 'users', email.toLowerCase())` (en lugar de `profiles`).
- `components/BioDashboard.tsx` → leer solo de `users` (eliminar el merge de dos colecciones).

## Plan de implementación

### Sub-spec 5.1 (independiente, se puede commitear sola)

1. **Modificar `metamorfosis-web/src/pages/api/admin/stats.ts:21`**:
   ```ts
   const postsRef = db.collection('metamorfosis_posts');
   ```

2. **Verificar resto de `stats.ts`**: que la colección de leads esté correcta (`'waitlist_leads'` ✓).

### Sub-spec 5.2 (requiere migración de datos)

1. **Crear `metamorfosis-web/scripts/migrate-profiles-to-users.ts`**:
   ```ts
   import { db } from '../src/lib/firebaseAdmin';

   async function migrate() {
     const profilesSnap = await db.collection('profiles').get();
     console.log(`Found ${profilesSnap.size} profiles to migrate.`);

     let migrated = 0;
     for (const doc of profilesSnap.docs) {
       const profileData = doc.data();
       const userRef = db.collection('users').doc(doc.id);
       const userSnap = await userRef.get();

       if (userSnap.exists) {
         const userData = userSnap.data() || {};
         // users gana en campos comunes; profiles aporta lo que falte
         const merged = { ...profileData, ...userData };
         await userRef.set(merged, { merge: false });
       } else {
         await userRef.set(profileData);
       }
       migrated++;
     }
     console.log(`Migrated ${migrated} profiles to users.`);

     // Borrado seguro de profiles
     const batch = db.batch();
     profilesSnap.docs.forEach(d => batch.delete(d.ref));
     await batch.commit();
     console.log(`Deleted ${profilesSnap.size} docs from profiles.`);
   }

   migrate().catch(err => { console.error(err); process.exit(1); });
   ```

2. **Ejecutar el script** en local con `.env` apuntando a prod:
   ```sh
   cd metamorfosis-web
   npx tsx scripts/migrate-profiles-to-users.ts
   ```
   (Hay que tener `tsx` o usar `ts-node`; `package.json` ya incluye `ts-node`.)

3. **Verificar en Firebase Console** que `profiles` está vacía y `users` contiene todo.

4. **Modificar código para usar solo `users`**:

   `pages/login.astro` líneas 120 y 131:
   ```ts
   const profileRef = doc(db, 'users', email.toLowerCase());
   ```

   `components/BioDashboard.tsx` líneas 23-49:
   ```tsx
   const fetchUserData = async (email: string, displayName: string | null) => {
     try {
       const userRef = doc(db, 'users', email.toLowerCase());
       const userSnap = await getDoc(userRef);
       if (userSnap.exists()) {
         const data = userSnap.data();
         setStats((prev: any) => ({
           ...prev,
           ...data,
           userName: displayName || data.userName || 'Biohacker',
           isLoading: false,
         }));
       } else {
         setStats((prev: any) => ({
           ...prev,
           userName: displayName || 'Biohacker',
           isLoading: false,
         }));
       }
     } catch (e: any) {
       console.error('[BioDashboard] fetch error:', e);
       setStats((prev: any) => ({ ...prev, isLoading: false }));
     }
   };
   ```

5. **Grep final**:
   ```sh
   grep -rn "collection('profiles'\|doc(db, 'profiles'" metamorfosis-web/src
   # No debe haber resultados.
   ```

6. **Borrar el script de migración** después de ejecutarlo (ya cumplió su propósito; queda en el historial git).

### Decisión sobre commits

Esta spec se puede partir en **dos commits separados**, porque los dos sub-cambios son independientes:

- **Commit 1 (sub-spec 5.1):** `fix(spec-005a): stats.ts apunta a 'metamorfosis_posts'`
- **Commit 2 (sub-spec 5.2):** `refactor(spec-005b): unificar perfiles en colección 'users'`

Recomiendo commitear primero 5.1 (es trivial, una línea, gana inmediato) y después 5.2 (requiere ejecución de migración).

## Criterios de aceptación

### Sub-spec 5.1
- [ ] `grep -n "collection('post')" metamorfosis-web/src` no devuelve nada (excepto sub-strings dentro de `'metamorfosis_posts'`).
- [ ] El admin dashboard muestra `totalPosts > 0` (suponiendo que hay al menos un post en Firestore).

### Sub-spec 5.2
- [ ] La colección `profiles` en Firestore está vacía.
- [ ] La colección `users` contiene los datos antes dispersos.
- [ ] `grep -rn "collection('profiles'" metamorfosis-web/src` y `grep -rn "doc(db, 'profiles'" metamorfosis-web/src` no devuelven resultados.
- [ ] `pages/login.astro` y `components/BioDashboard.tsx` solo leen/escriben en `users`.
- [ ] Login con un email previamente registrado en `profiles` funciona (su perfil ahora está en `users`).
- [ ] El dashboard muestra correctamente `userName`, `imr`, `zona`, `blocks` después del login.

## Pruebas

```sh
# Sub-spec 5.1
cd metamorfosis-web
grep -n "collection('post')" src/pages/api/admin/stats.ts
# Debe estar vacío.

# Login como admin → /admin/dashboard → ver "Total Posts" con valor real.

# Sub-spec 5.2
# 1. Backup de Firestore antes de migrar (gcloud firestore export ...).
# 2. Ejecutar script.
# 3. Verificar en Console.
# 4. Login con un usuario que estuviera en 'profiles'.
# 5. Verificar que dashboard.astro muestra todos sus datos.
```

## Riesgos / consideraciones

- **Backup obligatorio antes de migrar.** `gcloud firestore export gs://elena-app-2026-v1.appspot.com/backups/$(date +%Y%m%d)`. Si la migración sale mal, se restaura.
- **Datos en conflicto.** Si un usuario tenía perfil en `profiles` con `imr=80` (fecha vieja) y otro en `users` con `imr=85` (fecha reciente del quiz), la estrategia gana `users`. Eso es el comportamiento que se quiere.
- **Rules de Firestore.** Si las security rules están definidas por colección (`match /profiles/{...}` y `match /users/{...}`), eliminar las de `profiles` después de migrar. Pero en general lo que importa es que `users` sí permita lo que necesita la UI (read del propio doc por el usuario logueado).
- **App móvil ElenaApp.** Si la app móvil también lee/escribe perfiles, hay que coordinar. Asumimos que ya usa `users`. Confirmar antes de la migración.

## Commit

**Mensajes sugeridos:**

Sub-spec 5.1:
```
fix(spec-005a): apuntar stats.ts a 'metamorfosis_posts'

Antes consultaba 'post' (singular), una colección que no existe.
totalPosts en el dashboard admin siempre devolvía 0.

Cierra specs/SPEC-005-firestore-collections.md (parte 5.1)
```

Sub-spec 5.2:
```
refactor(spec-005b): unificar perfiles en colección 'users'

- Migrar docs de 'profiles' a 'users' (script ejecutado, ver historial)
- login.astro y BioDashboard.tsx pasan a usar solo 'users'
- Eliminado merge de dos colecciones en BioDashboard

Cierra specs/SPEC-005-firestore-collections.md (parte 5.2)
```

---

## Resultado

*(Pendiente de implementación.)*
