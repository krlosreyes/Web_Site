/**
 * Tests del helper de detección de bots (SPEC-094).
 *
 * UAs reales tomados de:
 *   - https://developers.facebook.com/docs/sharing/webmasters/crawler/
 *   - https://developer.twitter.com/en/docs/twitter-for-websites/cards/guides/troubleshooting-cards
 *   - https://docs.linkedin.com/share/dev/post-tagger/
 *   - User-Agent strings.com (referencia común)
 */

import { describe, test, expect } from 'vitest';
import { isKnownBotUserAgent } from './botDetection';

describe('isKnownBotUserAgent', () => {
    describe('UAs de bots conocidos (deben retornar true)', () => {
        test('facebookexternalhit clásico', () => {
            expect(
                isKnownBotUserAgent(
                    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                ),
            ).toBe(true);
        });

        test('facebookexternalhit nuevo formato', () => {
            expect(
                isKnownBotUserAgent('facebookexternalhit/1.1'),
            ).toBe(true);
        });

        test('Facebot', () => {
            expect(isKnownBotUserAgent('Facebot/1.0')).toBe(true);
        });

        test('meta-externalagent', () => {
            expect(
                isKnownBotUserAgent('meta-externalagent/1.1 (+https://developers.facebook.com)'),
            ).toBe(true);
        });

        test('WhatsApp', () => {
            expect(isKnownBotUserAgent('WhatsApp/2.21.5.16 A')).toBe(true);
        });

        test('Twitterbot', () => {
            expect(isKnownBotUserAgent('Twitterbot/1.0')).toBe(true);
        });

        test('LinkedInBot', () => {
            expect(
                isKnownBotUserAgent(
                    'LinkedInBot/1.0 (compatible; Mozilla/5.0; +http://www.linkedin.com)',
                ),
            ).toBe(true);
        });

        test('Slackbot-LinkExpanding', () => {
            expect(
                isKnownBotUserAgent(
                    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
                ),
            ).toBe(true);
        });

        test('Discordbot', () => {
            expect(isKnownBotUserAgent('Mozilla/5.0 (compatible; Discordbot/2.0)')).toBe(true);
        });

        test('Pinterest', () => {
            expect(
                isKnownBotUserAgent('Pinterest/0.2 (+http://www.pinterest.com/)'),
            ).toBe(true);
        });

        test('TelegramBot', () => {
            expect(isKnownBotUserAgent('TelegramBot (like TwitterBot)')).toBe(true);
        });

        test('Googlebot', () => {
            expect(
                isKnownBotUserAgent(
                    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                ),
            ).toBe(true);
        });

        test('bingbot', () => {
            expect(
                isKnownBotUserAgent(
                    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
                ),
            ).toBe(true);
        });

        test('case-insensitive — UA en mayúsculas también detecta', () => {
            expect(isKnownBotUserAgent('FACEBOOKEXTERNALHIT/1.1')).toBe(true);
            expect(isKnownBotUserAgent('TwitterBot')).toBe(true);
        });

        test('crawler genérico', () => {
            expect(
                isKnownBotUserAgent('Mozilla/5.0 (compatible; SomeCrawler/1.0)'),
            ).toBe(true);
        });

        test('spider genérico', () => {
            expect(isKnownBotUserAgent('Some Spider 1.0')).toBe(true);
        });

        test('headless browsers', () => {
            expect(
                isKnownBotUserAgent('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0'),
            ).toBe(true);
        });

        test('Embedly', () => {
            expect(isKnownBotUserAgent('Embedly/0.2')).toBe(true);
        });
    });

    describe('UAs humanos (deben retornar false)', () => {
        test('Chrome desktop estándar', () => {
            expect(
                isKnownBotUserAgent(
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ),
            ).toBe(false);
        });

        test('Safari iPhone', () => {
            expect(
                isKnownBotUserAgent(
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                ),
            ).toBe(false);
        });

        test('Firefox Linux', () => {
            expect(
                isKnownBotUserAgent(
                    'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
                ),
            ).toBe(false);
        });

        test('Edge Windows', () => {
            expect(
                isKnownBotUserAgent(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
                ),
            ).toBe(false);
        });

        test('Chrome Android', () => {
            expect(
                isKnownBotUserAgent(
                    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                ),
            ).toBe(false);
        });
    });

    describe('edge cases', () => {
        test('null retorna false', () => {
            expect(isKnownBotUserAgent(null)).toBe(false);
        });

        test('undefined retorna false', () => {
            expect(isKnownBotUserAgent(undefined)).toBe(false);
        });

        test('string vacío retorna false', () => {
            expect(isKnownBotUserAgent('')).toBe(false);
        });

        test('value que no es string retorna false', () => {
            expect(isKnownBotUserAgent(123 as unknown as string)).toBe(false);
            expect(isKnownBotUserAgent({} as unknown as string)).toBe(false);
        });
    });
});
