import React, { useEffect, useRef, useState } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

/**
 * Campanita de notificaciones del foro (SPEC-043).
 *
 * - Solo se renderiza si hay user logueado.
 * - Polling cada 60s para refrescar count + lista.
 * - Click → dropdown con últimas 5 notifs + botón "marcar todas".
 * - Click en una notif: marca read + linkea al topic.
 */

type NotifType = 'reply_to_topic' | 'reply_to_reply' | 'mention';

interface Notification {
    id: string;
    type: NotifType;
    fromUid: string;
    fromName: string;
    topicId: string;
    replyId: string | null;
    topicTitle: string;
    snippet: string;
    read: boolean;
    createdAt: string;
}

const POLL_MS = 60_000;

const relTime = (iso: string): string => {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    if (isNaN(ms) || ms < 0) return '';
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
};

const labelFor = (t: NotifType): string => {
    if (t === 'reply_to_topic') return 'respondió tu tema';
    if (t === 'reply_to_reply') return 'respondió tu comentario';
    if (t === 'mention') return 'te mencionó';
    return 'notificación';
};

const NotificationBell: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Notification[]>([]);
    const [unread, setUnread] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsub();
    }, []);

    /** Fetch del estado actual. */
    const fetchNotifs = React.useCallback(async () => {
        if (!user) return;
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/users/me/notifications?limit=10', {
                headers: { Authorization: `Bearer ${idToken}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) {
                setItems(data.items || []);
                setUnread(data.unreadCount || 0);
            }
        } catch (err) {
            console.error('[NotificationBell] fetch:', err);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            setItems([]);
            setUnread(0);
            return;
        }
        fetchNotifs();
        const id = setInterval(fetchNotifs, POLL_MS);
        return () => clearInterval(id);
    }, [user, fetchNotifs]);

    /** Cerrar dropdown al click fuera. */
    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);

    const handleMarkAllRead = async () => {
        if (!user || unread === 0) return;
        try {
            const idToken = await user.getIdToken();
            await fetch('/api/users/me/notifications', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ all: true }),
            });
            setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnread(0);
        } catch (err) {
            console.error('[NotificationBell] markAll:', err);
        }
    };

    const handleClickNotif = async (n: Notification) => {
        // Marcar read antes de navegar (best-effort)
        if (!n.read && user) {
            try {
                const idToken = await user.getIdToken();
                fetch('/api/users/me/notifications', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({ ids: [n.id] }),
                }).catch(() => {});
            } catch {
                // ignore
            }
        }
        // Navegar al foro (en futuras specs se puede deeplink al topic exacto)
        window.location.href = '/comunidad';
    };

    if (!user) return null;

    return (
        <div ref={dropdownRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label={`Notificaciones ${unread > 0 ? `(${unread} sin leer)` : ''}`}
                aria-expanded={open}
                className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
                <svg
                    className="w-5 h-5 text-gray-200"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                >
                    <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
                    <path d="M9 17a3 3 0 006 0" />
                </svg>
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 border-2 border-[#050a12] text-[9px] font-black text-white flex items-center justify-center tabular-nums">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 max-h-[80vh] overflow-y-auto bg-[#0a1020] border border-white/10 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <h4 className="text-xs font-black uppercase tracking-widest text-white">
                            Notificaciones
                        </h4>
                        {unread > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest transition-colors"
                            >
                                Marcar todas
                            </button>
                        )}
                    </div>

                    {items.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-600 text-xs font-mono">
                            No tenés notificaciones todavía.
                        </div>
                    ) : (
                        <ul className="divide-y divide-white/5">
                            {items.map((n) => (
                                <li key={n.id}>
                                    <button
                                        onClick={() => handleClickNotif(n)}
                                        className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors flex gap-3 ${
                                            !n.read ? 'bg-blue-500/[0.04]' : ''
                                        }`}
                                    >
                                        <div className="shrink-0 w-2 h-2 rounded-full mt-2 ${
                                            !n.read ? 'bg-blue-400' : 'bg-transparent'
                                        }" style={{ background: n.read ? 'transparent' : '#60a5fa' }} aria-hidden="true" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-gray-300 leading-snug mb-1 break-words">
                                                <strong className="text-white">{n.fromName}</strong>{' '}
                                                {labelFor(n.type)} en{' '}
                                                <em className="not-italic text-blue-300">
                                                    {n.topicTitle}
                                                </em>
                                            </p>
                                            <p className="text-[11px] text-gray-500 line-clamp-2 leading-snug mb-1 break-words">
                                                {n.snippet}
                                            </p>
                                            <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">
                                                Hace {relTime(n.createdAt)}
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
