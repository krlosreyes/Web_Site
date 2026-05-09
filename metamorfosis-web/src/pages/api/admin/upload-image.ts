/**
 * POST /api/admin/upload-image
 *
 * Sube una imagen a Firebase Cloud Storage en lugar de embeber base64 en el
 * doc Firestore (que tiene límite de 1 MB y aliasea performance/costos).
 *
 * Auth: cookie admin (mismo contrato que el resto de /api/admin/*).
 * Body: { dataUrl: "data:image/jpeg;base64,...", folder?: string, filename?: string }
 *
 * Respuesta:
 *   200 { success: true, url: string, path: string }
 *   400 si JSON inválido o dataUrl mal formada
 *   401 si no hay sesión admin
 *   413 si la imagen excede 5 MB tras decodificar
 *   500 si Storage falla
 *
 * Ver specs/SPEC-014-images-cloud-storage.md
 */

import type { APIRoute } from 'astro';
import { storage } from '../../../lib/firebaseAdmin';
import {
    isAuthenticatedFromCookie,
    parseCookies,
    enforceProductionSecurity,
} from '../../../lib/auth';

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB tras resize cliente
const ALLOWED_CONTENT_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
]);

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function sanitizePathSegment(input: string, fallback: string): string {
    // Sólo letras/números/_-/./. Sin paths absolutos ni `..`.
    const cleaned = input.replace(/[^a-zA-Z0-9._\-/]/g, '').replace(/\.{2,}/g, '');
    return cleaned.length > 0 ? cleaned : fallback;
}

export const POST: APIRoute = async ({ request }) => {
    enforceProductionSecurity();

    const cookies = parseCookies(request);
    if (!isAuthenticatedFromCookie(cookies)) {
        return jsonResponse(401, { error: 'Unauthorized' });
    }

    let body: { dataUrl?: string; folder?: string; filename?: string };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: 'JSON inválido' });
    }

    if (!body.dataUrl || typeof body.dataUrl !== 'string') {
        return jsonResponse(400, { error: 'Campo `dataUrl` requerido' });
    }

    // Parsear data URL
    const match = body.dataUrl.match(/^data:(image\/[a-zA-Z+.\-]+);base64,(.+)$/);
    if (!match) {
        return jsonResponse(400, { error: 'dataUrl mal formada — esperaba data:image/...;base64,...' });
    }
    const contentType = match[1].toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        return jsonResponse(400, { error: `Content-Type no soportado: ${contentType}` });
    }

    let buffer: Buffer;
    try {
        buffer = Buffer.from(match[2], 'base64');
    } catch {
        return jsonResponse(400, { error: 'base64 inválido' });
    }
    if (buffer.length === 0) {
        return jsonResponse(400, { error: 'Imagen vacía' });
    }
    if (buffer.length > MAX_BYTES) {
        return jsonResponse(413, { error: `Imagen excede ${MAX_BYTES / (1024 * 1024)} MB` });
    }

    const folder = sanitizePathSegment(body.folder ?? 'posts/uploads', 'posts/uploads');
    // Solo permitimos subir bajo posts/* desde este endpoint (el bucket tiene
    // otras carpetas reservadas para users/{uid}/*).
    if (!folder.startsWith('posts/')) {
        return jsonResponse(400, { error: 'folder debe empezar con `posts/`' });
    }

    const ext = contentType.split('/')[1].split('+')[0];
    const safeFilename = sanitizePathSegment(
        body.filename ?? `img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`,
        `img-${Date.now()}.${ext}`
    );
    const objectPath = `${folder}/${safeFilename}`;

    try {
        const bucket = storage.bucket();
        const file = bucket.file(objectPath);
        await file.save(buffer, {
            contentType,
            metadata: {
                cacheControl: 'public, max-age=31536000, immutable',
            },
        });
        // Hacer público el objeto (las rules de Storage también permiten read
        // sobre posts/*, pero makePublic asegura que GCS no devuelva 403 por ACL).
        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;

        return jsonResponse(200, {
            success: true,
            url: publicUrl,
            path: objectPath,
            bytes: buffer.length,
        });
    } catch (err) {
        console.error('[upload-image] Error subiendo a Storage:', err);
        return jsonResponse(500, { error: 'Error subiendo imagen' });
    }
};
