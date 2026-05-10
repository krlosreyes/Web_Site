/**
 * Audit log helper (SPEC-018).
 *
 * Best-effort: si Firestore falla, la acción admin original sigue funcionando
 * y el error queda en console.error. La auditoría NO debe bloquear operación.
 *
 * Uso típico al final de un handler admin después del éxito de la mutación:
 *
 *   await logAdminAction({
 *     action: 'update_lead',
 *     resource: 'lead',
 *     resourceId: id,
 *     changes: diffOf(before, after),
 *     request,
 *   });
 */

import { db } from './firebaseAdmin';
import { COLLECTIONS } from './constants/firestore';
import { getClientIp } from './auth';

export type AuditAction =
    | 'create_post'
    | 'update_post'
    | 'delete_post'
    | 'update_lead'
    | 'upload_image'
    | 'cleanup'
    | 'login_admin'
    | 'logout_admin'
    | 'send_welcome_email';

export type AuditResource = 'post' | 'lead' | 'image' | 'system' | 'session';

export interface AuditChange {
    before: unknown;
    after: unknown;
}

export interface AuditEntry {
    action: AuditAction;
    resource: AuditResource;
    resourceId: string | null;
    changes: Record<string, AuditChange> | null;
    performedAt: string; // ISO
    /** Hoy hardcoded a 'admin'. Cuando haya multi-user, viene del contrato de cookie. */
    performedBy: string;
    /** IP del header x-forwarded-for o cf-connecting-ip; null si no disponible. */
    ip: string | null;
}

/**
 * Construye un objeto `changes` que solo incluye los campos cuyo before !== after.
 * Útil para no inflar el log con campos sin cambios reales (típico cuando un PUT
 * llega con varios campos pero solo uno cambió).
 */
export function diffOf(
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown> | null | undefined
): Record<string, AuditChange> | null {
    const result: Record<string, AuditChange> = {};
    const keys = new Set<string>([
        ...Object.keys(before ?? {}),
        ...Object.keys(after ?? {}),
    ]);
    for (const k of keys) {
        const b = before?.[k];
        const a = after?.[k];
        // Comparación shallow con JSON.stringify para arrays/objetos simples.
        // Si el valor es deep estructurado, queda como "cambió" igual; vale.
        if (JSON.stringify(b) !== JSON.stringify(a)) {
            result[k] = { before: b ?? null, after: a ?? null };
        }
    }
    return Object.keys(result).length > 0 ? result : null;
}

/** Escribe una entrada de audit log. NO BLOQUEANTE. */
export async function logAdminAction(input: {
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string | null;
    changes?: Record<string, AuditChange> | null;
    request?: Request;
}): Promise<void> {
    try {
        const entry: AuditEntry = {
            action: input.action,
            resource: input.resource,
            resourceId: input.resourceId ?? null,
            changes: input.changes ?? null,
            performedAt: new Date().toISOString(),
            performedBy: 'admin',
            ip: input.request ? getClientIp(input.request) : null,
        };
        // IP que es '127.0.0.1' por fallback la dejamos como null para que el
        // log no sugiera tráfico que no fue real.
        if (entry.ip === '127.0.0.1') entry.ip = null;
        await db.collection(COLLECTIONS.ADMIN_AUDIT_LOG).add(entry);
    } catch (err) {
        // Best-effort: nunca bloqueamos la acción admin original.
        console.error('[auditLog] Error escribiendo entry:', err);
    }
}
