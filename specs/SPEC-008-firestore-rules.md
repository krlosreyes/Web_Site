# SPEC-008 — Reglas de seguridad de Firestore

**Estado:** ✅ Cerrada
**Fase:** 2
**Severidad:** ALTO (seguridad)
**Fecha de creación:** 2026-05-09
**Cerrada:** 2026-05-09 (rules publicadas a las 14:33)
**Autor:** Carlos Reyes
**Depende de:** SPEC-005 (schema canónico)

---

## Contexto

Hoy las reglas de Firestore están en estado desconocido (probablemente las de prueba abiertas: `allow read, write: if true`). Como el cliente Firebase Web SDK lee `users/{uid}` directo desde el navegador (en `BioDashboard.tsx` y otros), las rules son la única protección server-side contra:

- Un user logueado leyendo el doc de OTRO user (`users/{uid_de_otro}`).
- Un user modificando su propio waitlist.position o cualquier campo "app.*" reservado para ElenaApp.
- Cualquier visitante anónimo leyendo `pruebas` o `waitlist_leads` (datos sensibles internos).
- Un atacante creando posts falsos en `metamorfosis_posts` desde su propio cliente.

## Problema

Sin reglas restrictivas, Firestore es lectura/escritura libre para cualquier autenticado (o incluso anónimo, según config). Hay que definir un set explícito alineado con el schema canónico de SPEC-005.

## Solución propuesta

Archivo `firebase/firestore.rules` (en repo, no se aplica desde repo — Carlos lo despliega vía Firebase Console o `firebase deploy --only firestore:rules`):

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ===== users/{uid} =====
    // Solo el dueño puede leer/escribir su propio doc.
    // Campos "app.*" reservados a ElenaApp; web no los toca.
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid;
      allow update: if request.auth != null
                    && request.auth.uid == uid
                    && (
                      // No permitir update de campos app.* desde cliente
                      !('app' in request.resource.data)
                      || request.resource.data.app == resource.data.app
                    );
      allow delete: if false; // nunca desde cliente

      // Subcolección daily_logs (planeada para ElenaApp)
      match /daily_logs/{date} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }

      // Subcolección article_quizzes
      match /article_quizzes/{slug} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }

    // ===== metamorfosis_posts =====
    // Lectura pública (artículos del blog). Escritura solo desde Admin SDK.
    match /metamorfosis_posts/{post} {
      allow read: if true;
      allow write: if false;
    }

    // ===== waitlist_leads =====
    // Anónimos pueden crear (lead capture). Lectura/modificación solo Admin SDK.
    match /waitlist_leads/{lead} {
      allow create: if request.resource.data.email is string
                    && request.resource.data.email.matches('.+@.+\\..+');
      allow read, update, delete: if false;
    }

    // ===== pruebas =====
    // Solo Admin SDK (datos analíticos internos).
    match /pruebas/{doc} {
      allow read, write: if false;
    }

    // ===== Default deny =====
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Notas clave:**

- `allow update` en `users/{uid}` permite al user editar todo SU propio doc EXCEPTO el bloque `app.*` (reservado para ElenaApp). Esto evita que un user manipule su `protocolId` o biomarcadores via cliente.
- `metamorfosis_posts` es `read: true` para que `biblioteca.astro` y `posts/[slug].astro` (que renderizan SSR pero también podrían leer client-side desde el quiz de artículo) funcionen para anónimos.
- `waitlist_leads` permite `create` con validación mínima de email; lectura solo desde server con Admin SDK (que bypassa rules). Esto deja la opción de capture pre-auth desde formularios.
- `default deny` cierra cualquier path no enumerado.

## Plan de implementación

1. **Crear** `firebase/firestore.rules` en raíz del repo con el contenido de arriba. (Carpeta nueva `firebase/` para mantener separado del código de la web.)

2. **Crear** `firebase/firestore.indexes.json` mínimo (vacío `[]`). Necesario si se despliega con `firebase deploy`.

3. **Crear** `firebase.json` mínimo:
   ```json
   {
     "firestore": {
       "rules": "firebase/firestore.rules",
       "indexes": "firebase/firestore.indexes.json"
     }
   }
   ```

4. **Carlos despliega manualmente** (no se hace desde Hostinger):
   - Opción A: copiar el contenido de `firestore.rules` a Firebase Console → Firestore → Rules → Publish.
   - Opción B: `firebase login && firebase deploy --only firestore:rules` desde local.

5. **Pruebas de validación** desde Firebase Console → Rules Playground:
   - Lectura `users/{my_uid}` autenticado como `my_uid` → ALLOW.
   - Lectura `users/{otro_uid}` autenticado como `my_uid` → DENY.
   - Update `users/{my_uid}` con cambio en `bio.weightKg` → ALLOW.
   - Update `users/{my_uid}` con cambio en `app.protocolId` → DENY.
   - Read `metamorfosis_posts/abc` sin auth → ALLOW.
   - Write `metamorfosis_posts/abc` con auth → DENY.
   - Create `waitlist_leads/test` con `{email:"a@b.com"}` sin auth → ALLOW.
   - Read `waitlist_leads/*` con auth → DENY.

## Criterios de aceptación

- [ ] `firebase/firestore.rules` existe en el repo.
- [ ] Reglas desplegadas en Firebase Console (verificable: la pestaña Rules del proyecto muestra el contenido del archivo).
- [ ] Las 8 pruebas del Rules Playground pasan según el resultado esperado.
- [ ] `BioDashboard.tsx` sigue funcionando (lee su propio `users/{uid}` ✅).
- [ ] `IMRQuiz.tsx` sigue funcionando (escribe su propio doc via `/api/users/onboard` que usa Admin SDK — bypassa rules).
- [ ] `biblioteca.astro` sigue listando posts.
- [ ] `pages/api/leads.ts` (anónimo) sigue creando leads.

## Pruebas

```sh
# Tras desplegar las reglas, login con un user de prueba y verificar que:

# 1. Lectura del propio doc desde el navegador (Firebase Web SDK) → OK
#    Lo hace BioDashboard.tsx automáticamente.

# 2. Lectura de posts → OK (lo hace biblioteca.astro vía SSR con Admin SDK,
#    pero también si el cliente lee, debería pasar).

# 3. Intentar leer otro user desde la consola del browser:
#    > await firebase.firestore().collection('users').doc('otro-uid').get()
#    Debería tirar permission-denied.
```

## Riesgos / consideraciones

- **Si rompemos `BioDashboard.tsx`**: el dashboard mostrará "doc no existe". Volver a verificar la regla `read: if request.auth.uid == uid`. El `uid` actual del cliente debe matchear el doc.
- **Subcolecciones futuras**: si ElenaApp agrega nuevas subcolecciones, hay que extender las rules. Por ahora cubrimos `daily_logs` y `article_quizzes` como anticipación.
- **`waitlist_leads.create` permisivo**: cualquiera puede crear leads con cualquier email. Bot abuse posible. Mitigación opcional: agregar reCAPTCHA en el form (otra spec).
- **Despliegue manual**: las rules NO se deployan automáticamente con cada push del sitio. Si Carlos cambia `firestore.rules`, debe correr `firebase deploy --only firestore:rules` o pegar el contenido en Console. Documentar en README.

## Commit

```
feat(spec-008): reglas de seguridad de Firestore

Define rules explícitas alineadas con schema v1 (SPEC-005):
- users/{uid}: solo dueño lee/edita; app.* protegido (reservado ElenaApp)
- metamorfosis_posts: read público, write solo Admin SDK
- waitlist_leads: create anónimo con validación email; read/update/delete deny
- pruebas: solo Admin SDK
- Default deny

Las rules no se despliegan automáticamente desde el repo — Carlos las
publica vía Firebase Console o `firebase deploy --only firestore:rules`.

Cierra specs/SPEC-008-firestore-rules.md
```

---

## Resultado

Implementada y publicada el 2026-05-09 a las 14:33.

**Cambios mergeados (commit `418ac32`):**

- `firebase/firestore.rules` — contrato declarativo de seguridad versionado en repo.
- `firebase/firestore.indexes.json` — `[]` por ahora (sin queries con índices compuestos).
- `firebase.json` — config para `firebase deploy --only firestore:rules`.
- `metamorfosis-web/src/components/ArticleQuiz.tsx` — refactor a `users/{currentUser.uid}` (cierre tardío de SPEC-005.4). Sin esto las rules nuevas habrían bloqueado la persistencia de quizzes de artículos.

**Despliegue:** manual desde Firebase Console (Firestore → Rules → pegar contenido del archivo → Publicar). Las rules NO se despliegan automáticamente con el push a Hostinger — son responsabilidad de Carlos publicarlas vía Console o `firebase deploy --only firestore:rules`. Verificado en la timeline de versiones del Console: la versión activa es la del 2026-05-09 14:33.

**Rules en producción (resumen):**

```
users/{uid}                  read/write: dueño; app.* protegido (ElenaApp)
users/{uid}/daily_logs/*     read/write: dueño
users/{uid}/article_quizzes/* read/write: dueño
metamorfosis_posts/*         read: público; write: solo Admin SDK
waitlist_leads/*             create: anónimo con email no vacío; resto deny
pruebas/*                    solo Admin SDK
{**} (default)               deny
```

**Aprendizajes:**

- **Rules son una capa adicional de defensa**, no la única. El Admin SDK de los endpoints `/api/*` bypasa rules y aplica su propia validación (ej. `request.auth.uid` validado por Firebase ID token en `/api/users/onboard`). Defensa en profundidad.
- **El campo `app.*` protegido** previene que un user manipule su propio `protocolId` o `biomarkers` desde el cliente — esos datos vienen de ElenaApp con sus propias validaciones.
- **El timing matters**: ArticleQuiz tenía un TODO desde SPEC-005.4 que iba a romper bajo las rules. Verificar grep de `email.toLowerCase()` antes de publicar rules estrictas.
- **Rollback es trivial** desde la timeline del Firebase Console (click una versión anterior → "Restaurar"). 30 segundos. Si las rules rompen algo en producción, la mitigación es inmediata.

**Pendientes que se mueven a otras specs:**

- Si en el futuro agregamos nuevas subcolecciones bajo `users/{uid}`, hay que extender las rules. Documentar en CHANGELOG.
- reCAPTCHA en `waitlist_leads.create` (anónimo) — backlog Fase 3+ si hay bot abuse.
- Reglas para Cloud Storage (avatares, etc.) cuando ElenaApp lo necesite — futura spec dedicada.
