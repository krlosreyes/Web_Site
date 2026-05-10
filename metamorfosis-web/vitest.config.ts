/**
 * Vitest config — SPEC-020.
 *
 * Astro 6 ya monta Vite internamente; Vitest aprovecha esa misma capa sin
 * duplicar configuración. Lo único que necesitamos es delimitar el patrón
 * de archivos y forzar entorno Node (no jsdom) — los módulos testeados
 * (motor IMR, auth) son código puro de servidor.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        globals: false, // explicit imports — más fácil de auditar
        passWithNoTests: false,
        // Vitest hace polyfill de import.meta.env automáticamente.
        // Para tests que dependen de variables específicas usamos vi.stubEnv.
    },
});
