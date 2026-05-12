/**
 * postAnalytics — contadores reales de vistas y clics por artículo (SPEC-086).
 *
 * Cada post tiene un doc en `metamorfosis_posts` con shape:
 *   { ..., analytics: { views: number, clicks: number, conversions: number } }
 *
 * Estos helpers incrementan atómicamente esos contadores usando
 * `FieldValue.increment()`. Son best-effort: si la op falla por cualquier
 * razón (red, permisos, doc no encontrado), se loguea y NO se propaga el
 * error. El render del artículo o el navigate del usuario nunca se rompen
 * por un fallo de tracking.
 *
 * Localización del doc: filtramos `where('slug', '==', slug).limit(1)`.
 * El campo `slug` está indexado por uso previo (ver query similar en
 * /posts/[slug].astro) así que el read es O(1) en práctica.
 */

import { db, FieldValue } from './firebaseAdmin';
import { COLLECTIONS } from './constants/firestore';

/** Localiza el docId del post por su slug. Null si no existe. */
async function findPostDocId(slug: string): Promise<string | null> {
    const snap = await db
        .collection(COLLECTIONS.POSTS)
        .where('slug', '==', slug)
        .limit(1)
        .get();
    if (snap.empty) return null;
    return snap.docs[0].id;
}

/**
 * Incrementa `analytics.views` en +1. Best-effort: nunca lanza.
 * Caller debe haber aplicado dedupe (cookie de sesión) y exclusión
 * del admin ANTES de invocar.
 */
export async function incrementView(slug: string): Promise<void> {
    if (!slug) return;
    try {
        const docId = await findPostDocId(slug);
        if (!docId) {
            // Slug no existe — silencioso. El caller ya retornó 404 al user.
            return;
        }
        await db
            .collection(COLLECTIONS.POSTS)
            .doc(docId)
            .set(
                { analytics: { views: FieldValue.increment(1) } },
                { merge: true },
            );
    } catch (err) {
        console.error('[postAnalytics] incrementView error:', err);
        // No re-lanzamos. Tracking nunca rompe el flujo.
    }
}

/**
 * Incrementa `analytics.clicks` en +1. Best-effort: nunca lanza.
 * Invocado desde el endpoint /api/posts/[slug]/click cuando el usuario
 * clickea un CTA principal del artículo (sendBeacon).
 */
export async function incrementClick(slug: string): Promise<void> {
    if (!slug) return;
    try {
        const docId = await findPostDocId(slug);
        if (!docId) return;
        await db
            .collection(COLLECTIONS.POSTS)
            .doc(docId)
            .set(
                { analytics: { clicks: FieldValue.increment(1) } },
                { merge: true },
            );
    } catch (err) {
        console.error('[postAnalytics] incrementClick error:', err);
    }
}
