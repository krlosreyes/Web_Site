/**
 * POST /api/quiz/funnel — incrementa counter del funnel del quiz (SPEC-093).
 *
 * Invocado por `navigator.sendBeacon` desde el componente IMRQuiz en
 * 3 puntos del flujo: started, completed, registered.
 *
 * Exclusiones:
 *   - admin_session válido (admin logueado).
 *   - mr_admin_self=1 (self-exclusion de SPEC-091).
 *
 * Astro 6 CSRF: sendBeacon envía Blob de application/json. El endpoint
 * acepta cualquier body válido o vacío; lee `event` del JSON parse.
 */

import type { APIRoute } from 'astro';
import {
    incrementFunnel,
    isValidFunnelEvent,
} from '../../../lib/quizFunnel';
import {
    isAuthenticatedFromCookie,
    parseCookies,
} from '../../../lib/auth';
import {
    isSelfExcluded,
    readCookiesFromHeader,
} from '../../../lib/legacy/adminSelfExclusion';
import { isKnownBotUserAgent } from '../../../lib/legacy/botDetection';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    // SPEC-093: ambas exclusiones para no contaminar el funnel con
    // tráfico interno de Carlos.
    const adminCookies = parseCookies(request);
    if (isAuthenticatedFromCookie(adminCookies)) {
        return new Response(null, { status: 204 });
    }
    const selfCookies = readCookiesFromHeader(request.headers.get('cookie'));
    if (isSelfExcluded(selfCookies)) {
        return new Response(null, { status: 204 });
    }

    // SPEC-094: filtrar bots (no deberían disparar sendBeacon pero
    // por seguridad chequeamos).
    if (isKnownBotUserAgent(request.headers.get('user-agent'))) {
        return new Response(null, { status: 204 });
    }

    let body: { event?: unknown };
    try {
        body = await request.json();
    } catch {
        // sendBeacon a veces manda body raro. Si no parseamos, 204 silencioso.
        return new Response(null, { status: 204 });
    }

    if (!isValidFunnelEvent(body.event)) {
        return new Response(null, { status: 204 });
    }

    try {
        await incrementFunnel(body.event);
    } catch (err) {
        console.error('[api/quiz/funnel] error:', err);
    }
    return new Response(null, { status: 204 });
};
