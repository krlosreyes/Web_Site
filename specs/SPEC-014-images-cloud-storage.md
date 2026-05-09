# SPEC-014 — Imágenes a Firebase Cloud Storage (no base64)

**Estado:** 📝 Spec
**Fase:** 4
**Severidad:** ALTO (riesgo de bug de límite Firestore)
**Fecha de creación:** 2026-05-09
**Autor:** Carlos Reyes
**Depende de:** SPEC-005 (schema), SPEC-008 (rules) — ambas cerradas

---

## Contexto

`ArticleEditor.tsx` actual maneja imágenes así:

```ts
const reader = new FileReader();
reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        // ...resize...
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setImages(prev => [...prev, compressedBase64]);
    };
    img.src = event.target?.result as string;
};
```

Cada imagen termina como string `data:image/jpeg;base64,/9j/4AAQ...` dentro del array `images[]`. Cuando se guarda el artículo, ese array va al campo `images` del doc en `metamorfosis_posts/{id}` en Firestore.

**Problemas:**

1. **Límite hard de Firestore: 1 MB por documento.** Una imagen de 1200px en JPEG calidad 0.7 base64-encoded suele pesar 200-500 KB. Con 4-5 imágenes, el doc se acerca o supera el límite y falla al guardar (o peor, guarda truncado).
2. **Performance.** Cada lectura del artículo (ej. en `posts/[slug]` y `biblioteca`) descarga el doc completo con todas las imágenes inline. Esto inflado el bandwidth y ralentiza el TTFB.
3. **Caching.** Los CDN/navegador no pueden cachear imágenes individualmente — cualquier cambio al doc invalida toda la cache.
4. **Costos Firestore.** Firestore cobra por reads y por document size. Imágenes en base64 multiplican ambos costos vs. imágenes servidas desde Storage (que tiene tier gratis muy generoso).

## Problema

El pipeline actual de imágenes pone al sitio en riesgo de bug latente (límite 1MB) y desperdicia recursos en cada read. Tiene que migrar a Firebase Cloud Storage.

## Solución propuesta

**Pipeline nuevo:**

```
ArticleEditor (cliente)
  ↓ user selecciona imagen
  ↓ resize a 1200px ancho + JPEG calidad 0.7 (igual que ahora)
POST /api/admin/upload-image (multipart/form-data o base64 small)
  ↓ verifica auth (cookie admin)
  ↓ sube a Firebase Storage en path posts/{articleId or hash}/{filename}.jpg
Storage → URL pública (gs:// + CDN HTTPS)
  ↓ devuelve URL al cliente
Cliente guarda URL string en images[] (en lugar de base64)
  ↓ al guardar artículo
Firestore guarda images: [string URL] — ~80-200 chars cada uno
```

### Setup en Firebase Console (manual, una vez)

1. Habilitar Firebase Storage en el proyecto `elena-app-2026-v1`. Si Carlos no lo había habilitado, va a Firebase Console → Storage → "Comenzar".
2. Crear el bucket por default (`elena-app-2026-v1.firebasestorage.app`).
3. Configurar reglas de Storage (ver `firebase/storage.rules` que esta spec crea).

### Archivos a crear

1. **`firebase/storage.rules`** (rules declarativas, similar a Firestore rules):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // posts/* — lectura pública (los artículos del blog son públicos),
    // escritura solo desde Admin SDK (bypassa rules pero las dejamos
    // restrictivas por defensa en profundidad).
    match /posts/{path=**} {
      allow read: if true;
      allow write: if false; // solo Admin SDK
    }

    // users/{uid}/* — futuro: avatares de user, fotos de progreso
    match /users/{uid}/{path=**} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    match /{path=**} {
      allow read, write: if false;
    }
  }
}
```

2. **`firebase.json`** (extender para incluir storage):

```json
{
  "firestore": {
    "rules": "firebase/firestore.rules",
    "indexes": "firebase/firestore.indexes.json"
  },
  "storage": {
    "rules": "firebase/storage.rules"
  }
}
```

3. **`src/lib/firebaseAdmin.ts`** — agregar export de Storage:

```ts
import { getStorage } from 'firebase-admin/storage';
// ...
export const storage = getStorage();
```

4. **`src/pages/api/admin/upload-image.ts`** (nuevo endpoint):

```ts
import type { APIRoute } from 'astro';
import { storage } from '../../../lib/firebaseAdmin';
import { isAuthenticatedFromCookie, parseCookies, enforceProductionSecurity } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    enforceProductionSecurity();
    const cookies = parseCookies(request);
    if (!isAuthenticatedFromCookie(cookies)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    let body: { dataUrl?: string; filename?: string; folder?: string };
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!body.dataUrl?.startsWith('data:image/')) {
        return new Response(JSON.stringify({ error: 'dataUrl debe ser data:image/...' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Extraer base64 + content-type
    const match = body.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
        return new Response(JSON.stringify({ error: 'dataUrl mal formada' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    // Validación de tamaño server-side (max 5MB tras resize cliente)
    if (buffer.length > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Imagen excede 5MB tras resize' }), { status: 413, headers: { 'Content-Type': 'application/json' } });
    }

    const folder = (body.folder || 'posts/uploads').replace(/[^a-z0-9/_-]/gi, '');
    const filename = (body.filename || `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`).replace(/[^a-z0-9._-]/gi, '');
    const objectPath = `${folder}/${filename}`;

    try {
        const bucket = storage.bucket();
        const file = bucket.file(objectPath);
        await file.save(buffer, {
            contentType,
            metadata: { cacheControl: 'public, max-age=31536000, immutable' }, // 1 año
        });
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
        return new Response(JSON.stringify({ success: true, url: publicUrl, path: objectPath }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('[upload-image] Error:', err);
        return new Response(JSON.stringify({ error: 'Error subiendo imagen' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};
```

5. **`ArticleEditor.tsx`** — refactor del `handleFileUpload`:

```ts
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
        const dataUrl = await resizeAndCompress(file, 1200, 0.7);
        const res = await fetch('/api/admin/upload-image', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl, folder: 'posts/uploads' }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Upload falló');
        const { url } = await res.json();
        setImages(prev => [...prev, url]);
    } catch (err) {
        alert(`Error subiendo imagen: ${(err as Error).message}`);
    } finally {
        setUploading(false);
    }
};
```

`resizeAndCompress(file, maxWidth, quality): Promise<string>` extrae la lógica actual de FileReader+canvas+toDataURL en una helper que devuelve la base64.

### Compatibilidad con artículos legacy

Los artículos existentes (al menos el "Reloj Secreto") tienen sus imágenes en base64 inline. **No los rompemos**: el front de `posts/[slug].astro` y `biblioteca.astro` renderiza con `<img src={image}>` directo. Tanto `data:image/...` base64 como `https://storage.googleapis.com/...` son strings válidos para `src` — funcionan igual.

**Migración opcional** (sub-spec 14b): script que recorre `metamorfosis_posts`, detecta imágenes base64, las sube a Storage, reemplaza con URL. No es bloqueante; el sistema funciona en modo mixto durante la transición.

## Plan de implementación

1. **Habilitar Firebase Storage** (manual, Carlos en Firebase Console). Es el único bloqueador externo.
2. Crear `firebase/storage.rules` en repo.
3. Extender `firebase.json` con la sección `storage`.
4. Agregar export de `storage` en `firebaseAdmin.ts`.
5. Crear `src/pages/api/admin/upload-image.ts`.
6. Refactor `ArticleEditor.tsx`: extraer `resizeAndCompress` como helper, usar el endpoint en `handleFileUpload`. Estado `uploading` para mostrar feedback.
7. Build local + commit + push.
8. Carlos publica `storage.rules` desde Firebase Console (manual, igual que `firestore.rules`).
9. Smoke test: subir una imagen desde el editor admin, verificar que va a Storage (no se queda como base64 en el doc).

## Criterios de aceptación

- [ ] Firebase Storage habilitado en el proyecto.
- [ ] `firebase/storage.rules` y `firebase.json` actualizados.
- [ ] `POST /api/admin/upload-image` sin cookie → 401.
- [ ] `POST /api/admin/upload-image` con cookie + `dataUrl` válido → 200 + `{success, url, path}`.
- [ ] El `url` devuelto es accesible públicamente (curl da 200).
- [ ] `ArticleEditor.tsx` usa el endpoint; el array `images` queda con URLs cortas (no base64).
- [ ] Crear/editar un artículo con imagen nueva → la imagen se ve en `posts/{slug}` con la URL de Storage.
- [ ] Artículos legacy con base64 siguen renderizando (compatibilidad).

## Pruebas

```sh
# Auth check
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://metamorfosisvital.com.co/api/admin/upload-image \
    -H 'Content-Type: application/json' -d '{}'
# Esperado: 401

# Con cookie + payload válido (mini PNG transparente 1x1):
COOKIE=$(curl -s -i -X POST https://metamorfosisvital.com.co/api/admin/login \
    -H 'Content-Type: application/json' -d '{"password":"<NUEVO_ADMIN_PASSWORD>"}' \
    | grep -i 'set-cookie' | head -1 | sed 's/[Ss]et-[Cc]ookie: //;s/;.*//')

DATA_URL='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

curl -s -X POST https://metamorfosisvital.com.co/api/admin/upload-image \
    -H 'Content-Type: application/json' \
    -b "$COOKIE" \
    -d "{\"dataUrl\":\"${DATA_URL}\",\"folder\":\"posts/test\"}"
# Esperado: 200 + {success:true, url:"https://storage.googleapis.com/...", path:"posts/test/img-..."}

# La URL devuelta debe ser pública:
URL_OUT=$(...)
curl -sI "$URL_OUT" | head -1
# Esperado: HTTP/2 200
```

UI manual:
- Login admin → editar el post existente → subir una imagen nueva → la URL en el array `images[]` no es `data:image/...` sino `https://storage.googleapis.com/elena-app-2026-v1.firebasestorage.app/posts/...`
- Publicar el cambio → abrir `/posts/{slug}` → la imagen se ve.

## Riesgos / consideraciones

- **`makePublic()` hace el archivo legible para cualquiera con la URL**. Esto está OK para imágenes de blog público. Para futuros uploads sensibles (avatares de user, fotos privadas), usar `getSignedUrl` con expiración.
- **Costos Storage**: tier gratis es 5GB de almacenamiento + 1GB/día de bandwidth. Para un blog con pocos artículos al mes, sobra. Monitorear.
- **No se borran las imágenes viejas en base64** — solo aplica a imágenes nuevas. Si un artículo legacy se edita y se reemplazan las imágenes, las base64 viejas quedan en el doc. Para limpieza completa, ejecutar el script de migración (sub-spec 14b) que recorre y migra.
- **Filename collisions**: el endpoint genera nombres con `Date.now()` + random hex de 6 chars. Probabilidad de colisión despreciable.
- **CORS de Storage**: las URLs de `storage.googleapis.com` son públicas y se sirven con CORS abierto. No hay que configurar nada extra.

## Commit

```
feat(spec-014): imágenes a Firebase Cloud Storage (no más base64 en Firestore)

- Nuevo POST /api/admin/upload-image con auth admin: recibe dataUrl,
  sube buffer a Storage en posts/uploads/{filename}.jpg, devuelve URL
  pública con cache-control de 1 año.
- ArticleEditor.tsx: handleFileUpload llama al endpoint en lugar de
  guardar base64 inline. images[] ahora son URLs cortas.
- Helper resizeAndCompress extraído (resize a 1200px + JPEG q=0.7).
- firebase/storage.rules: read público en posts/, deny everything else.
  Solo Admin SDK escribe (bypassa rules).
- firebase.json: + sección storage.
- firebaseAdmin.ts: + export de storage.

Compatibilidad: artículos legacy con base64 siguen renderizando (el
front usa <img src=...> que acepta tanto data: como https:).

Carlos publica storage.rules manualmente desde Firebase Console.

Cierra specs/SPEC-014-images-cloud-storage.md
```

---

## Resultado

*(Pendiente de implementación.)*
