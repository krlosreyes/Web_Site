/**
 * Detección de bots conocidos por User-Agent (SPEC-094).
 *
 * Los crawlers de Meta, X, LinkedIn, Slack, etc. cargan el HTML del
 * sitio cada vez que alguien comparte un enlace para generar el
 * link preview (Open Graph image, title, description). Eso infla
 * counters de pageviews y rebote sin ser tráfico humano real.
 *
 * Este helper detecta los bots conocidos por substring en el
 * User-Agent. La lista es CONSERVADORA: patterns específicos que
 * no aparecen en UAs humanos legítimos.
 *
 * Pure TS, sin dependencias. Se usa en:
 *   - UmamiScript.astro (no inyectar el tracker)
 *   - /posts/[slug].astro (no incrementar views)
 *   - /api/posts/[slug]/click.ts (no incrementar clicks)
 *   - /api/quiz/funnel.ts (no incrementar el funnel)
 */

/**
 * Lista de substrings de User-Agent que identifican bots conocidos.
 * Comparación case-insensitive.
 *
 * Mantener ORDENADO por categoría para facilitar mantenimiento.
 */
export const BOT_USER_AGENT_PATTERNS: readonly string[] = [
    // Meta (Facebook, Instagram, WhatsApp).
    'facebookexternalhit',
    'facebot',
    'meta-externalagent',
    'whatsapp',
    'instagram',

    // X / Twitter.
    'twitterbot',

    // LinkedIn.
    'linkedinbot',

    // Slack.
    'slackbot',

    // Discord.
    'discordbot',

    // Pinterest.
    'pinterest',
    'pinterestbot',

    // Telegram.
    'telegrambot',

    // Search engines.
    'googlebot',
    'bingbot',
    'duckduckbot',
    'applebot',
    'yandexbot',
    'baiduspider',

    // Genéricos (más restrictivos para no falsear matches en UAs humanos).
    // `bot` solo NO está acá porque hace match con `kbot`, `chatbot`,
    // etc. Los conocidos van listados arriba uno por uno.
    'crawler',
    'spider',
    'headless',

    // Otros scrapers comunes que vimos en logs reales.
    'embedly',
    'vkshare',
    'redditbot',
    'tumblr',
    'msnbot',
    'ahrefsbot',
    'semrushbot',
    'mj12bot',
    'dotbot',
];

/**
 * Returns true si el User-Agent corresponde a un bot conocido.
 *
 * - UA null/undefined/vacío → false (conservador: lo tratamos como humano).
 * - Match case-insensitive contra `BOT_USER_AGENT_PATTERNS`.
 */
export function isKnownBotUserAgent(
    ua: string | null | undefined,
): boolean {
    if (!ua || typeof ua !== 'string') return false;
    const lower = ua.toLowerCase();
    for (const pattern of BOT_USER_AGENT_PATTERNS) {
        if (lower.includes(pattern)) return true;
    }
    return false;
}
