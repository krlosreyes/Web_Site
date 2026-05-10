/**
 * Pilares de Metamorfosis Real (SPEC-046).
 *
 * Taxonomía oficial compartida entre artículos y foro. Si en el futuro
 * cambiamos un nombre/emoji o agregamos un pilar, este es el único lugar
 * donde tocar.
 *
 * Ver CLAUDE.md sección scope: "ayuno, nutrición, ejercicio, hidratación,
 * sueño" son los 5 ejes del producto.
 */

export interface Pillar {
    id: PillarId;
    name: string;
    emoji: string;
    /**
     * Identificador de paleta Tailwind para componer clases utilitarias
     * (ej. `bg-blue-500/10`, `text-blue-300`, `border-blue-500/30`).
     */
    tw: 'blue' | 'green' | 'orange' | 'cyan' | 'purple';
}

export const PILLARS = [
    { id: 'ayuno', name: 'Ayuno', emoji: '⏱️', tw: 'blue' },
    { id: 'nutricion', name: 'Nutrición', emoji: '🥗', tw: 'green' },
    { id: 'ejercicio', name: 'Ejercicio', emoji: '💪', tw: 'orange' },
    { id: 'hidratacion', name: 'Hidratación', emoji: '💧', tw: 'cyan' },
    { id: 'sueno', name: 'Sueño', emoji: '🌙', tw: 'purple' },
] as const satisfies readonly Pillar[];

export const PILLAR_IDS = PILLARS.map((p) => p.id);
export type PillarId = 'ayuno' | 'nutricion' | 'ejercicio' | 'hidratacion' | 'sueno';

export function getPillar(id: string | null | undefined): Pillar | null {
    if (!id) return null;
    return (PILLARS as readonly Pillar[]).find((p) => p.id === id) || null;
}

export function isValidPillarId(id: string | null | undefined): boolean {
    return !!id && (PILLAR_IDS as readonly string[]).includes(id);
}

/**
 * Categorías del foro: 5 pilares + "General" como secundaria.
 * El array final se usa en endpoints de foro y en el sidebar de categorías.
 */
export interface ForumCategory {
    id: string;
    name: string;
    emoji: string;
    tw: 'blue' | 'green' | 'orange' | 'cyan' | 'purple' | 'gray';
    isSecondary?: boolean;
}

export const FORUM_CATEGORIES: readonly ForumCategory[] = [
    ...PILLARS,
    { id: 'general', name: 'General', emoji: '💬', tw: 'gray', isSecondary: true },
];

export const VALID_FORUM_CATEGORY_IDS = FORUM_CATEGORIES.map((c) => c.id);

export function isValidForumCategory(id: string | null | undefined): boolean {
    return !!id && VALID_FORUM_CATEGORY_IDS.includes(id);
}

/**
 * Devuelve clases tailwind compuestas para un tw color dado.
 * Útil para badges/chips coherentes con el sistema de pilares.
 */
export function pillarClasses(tw: Pillar['tw'] | 'gray'): {
    bg: string;
    border: string;
    text: string;
    bgActive: string;
    borderActive: string;
    textActive: string;
} {
    const map = {
        blue: {
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/30',
            text: 'text-blue-300',
            bgActive: 'bg-blue-500/20',
            borderActive: 'border-blue-500/60',
            textActive: 'text-blue-200',
        },
        green: {
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/30',
            text: 'text-emerald-300',
            bgActive: 'bg-emerald-500/20',
            borderActive: 'border-emerald-500/60',
            textActive: 'text-emerald-200',
        },
        orange: {
            bg: 'bg-orange-500/10',
            border: 'border-orange-500/30',
            text: 'text-orange-300',
            bgActive: 'bg-orange-500/20',
            borderActive: 'border-orange-500/60',
            textActive: 'text-orange-200',
        },
        cyan: {
            bg: 'bg-cyan-500/10',
            border: 'border-cyan-500/30',
            text: 'text-cyan-300',
            bgActive: 'bg-cyan-500/20',
            borderActive: 'border-cyan-500/60',
            textActive: 'text-cyan-200',
        },
        purple: {
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/30',
            text: 'text-purple-300',
            bgActive: 'bg-purple-500/20',
            borderActive: 'border-purple-500/60',
            textActive: 'text-purple-200',
        },
        gray: {
            bg: 'bg-gray-500/10',
            border: 'border-gray-500/30',
            text: 'text-gray-300',
            bgActive: 'bg-gray-500/20',
            borderActive: 'border-gray-500/60',
            textActive: 'text-gray-200',
        },
    } as const;
    return map[tw];
}
