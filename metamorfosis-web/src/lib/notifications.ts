/**
 * Notificaciones in-app del foro (SPEC-043).
 *
 * Helper best-effort para crear notifs en `users/{uid}/notifications/{id}`.
 * Si Firestore falla, NO bloquea la operación que disparó la notif.
 */

import { db } from './firebaseAdmin';
import { COLLECTIONS } from './constants/firestore';

export type NotificationType =
    | 'reply_to_topic'
    | 'reply_to_reply'
    | 'mention';

export interface NotificationInput {
    /** UID del destinatario. */
    toUid: string;
    type: NotificationType;
    fromUid: string;
    fromName: string;
    topicId: string;
    replyId?: string | null;
    topicTitle: string;
    /** Snippet del contenido (~120 chars) para mostrar en la notif. */
    snippet: string;
}

const SNIPPET_MAX = 120;

/**
 * Crea una notificación. No lanza — si falla, log + continuar.
 *
 * Auto-rechaza si toUid === fromUid (no notificás de tu propia acción).
 */
export async function createNotification(input: NotificationInput): Promise<void> {
    if (!input.toUid || !input.fromUid) return;
    if (input.toUid === input.fromUid) return; // no auto-notificarse

    try {
        const trimmedSnippet =
            input.snippet.length > SNIPPET_MAX
                ? input.snippet.slice(0, SNIPPET_MAX - 3) + '...'
                : input.snippet;

        await db
            .collection(COLLECTIONS.USERS)
            .doc(input.toUid)
            .collection('notifications')
            .add({
                type: input.type,
                fromUid: input.fromUid,
                fromName: input.fromName.slice(0, 100),
                topicId: input.topicId,
                replyId: input.replyId ?? null,
                topicTitle: input.topicTitle.slice(0, 200),
                snippet: trimmedSnippet,
                read: false,
                createdAt: new Date().toISOString(),
            });
    } catch (err) {
        // Best-effort: log y seguir
        console.error('[notifications.create] error:', err);
    }
}
