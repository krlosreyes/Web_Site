/**
 * SPEC-120: enlaces internos entre artículos.
 *
 * Search Console (26-nov-2026): 12 de 15 artículos "descubiertos, sin
 * indexar". La portada no enlazaba a ningún artículo y los artículos no se
 * enlazaban entre sí; Google solo los conocía por el sitemap y /biblioteca.
 * Estos enlaces se renderizan en el servidor (HTML plano, rastreable).
 */
import { POST_SEO } from './seoOverrides';

export const TOPICS: Record<string, string[]> = {
    ayuno: [
        'ayuno-intermitente-guia-practica-para-sanar-tu-metabolismo-sin-pasar-hambre',
        'el-mito-de-que-el-ayuno-es-todo-o-nada-que-comer-durante-el-ayuno',
        'por-que-sigues-con-hambre-aunque-acabas-de-cenar',
    ],
    composicion: [
        'el-espejo-miente-por-que-estar-delgado-no-siempre-es-estar-sano',
        'adios-a-la-bascula-la-guia-tecnica-para-medir-lo-que-realmente-importa',
        'por-que-comer-menos-y-moverte-mas-fracasa-en-el-95-de-los-casos',
    ],
    ejercicio: [
        'por-que-te-matas-en-el-gimnasio-y-no-ves-cambios-reales',
        'como-entrenar-zona-2-y-por-que-tu-mitocondria-depende-de-eso',
    ],
    sueno: [
        'por-que-dormir-8-horas-no-es-lo-mismo-que-dormir-8-horas',
        'por-que-te-sientes-como-un-zombi-aunque-dormiste-8-horas',
        'tu-cuerpo-tiene-un-horario-de-oficina-el-reloj-secreto-de-tus-celulas',
    ],
    hidratacion: [
        'por-que-tu-cansancio-de-las-3-pm-es-sed-y-no-hambre',
        '5-mitos-sobre-la-hidratacion-que-la-ciencia-ya-desmintio-pero-que-tu-mama-sigue-repitiendo',
        'tomaba-4-litros-de-agua-al-dia-y-se-sentia-peor-la-paradoja-de-andres-y-la-sobrehidratacion-silencio',
    ],
    alimentacion: [
        'porque-la-comida-es-informacion-no-solo-calorias',
        'por-que-sigues-con-hambre-aunque-acabas-de-cenar',
    ],
};

/** Uno por pilar, para la portada. */
export const HOME_FEATURED: string[] = [
    'ayuno-intermitente-guia-practica-para-sanar-tu-metabolismo-sin-pasar-hambre',
    'adios-a-la-bascula-la-guia-tecnica-para-medir-lo-que-realmente-importa',
    'por-que-te-matas-en-el-gimnasio-y-no-ves-cambios-reales',
    'por-que-dormir-8-horas-no-es-lo-mismo-que-dormir-8-horas',
    'por-que-tu-cansancio-de-las-3-pm-es-sed-y-no-hambre',
    'porque-la-comida-es-informacion-no-solo-calorias',
];

export interface PostLink {
    slug: string;
    href: string;
    title: string;
    description: string;
}

export function toLink(slug: string): PostLink | null {
    const seo = POST_SEO[slug];
    if (!seo) return null;
    return { slug, href: `/posts/${slug}`, title: seo.title, description: seo.description };
}

/**
 * Artículos relacionados: primero los del mismo tema, luego el resto en
 * orden estable (el siguiente en la lista, dando la vuelta). Nunca repite
 * ni incluye el artículo actual.
 */
export function getRelated(slug: string | undefined, n = 3): PostLink[] {
    const all = Object.keys(POST_SEO);
    const out: string[] = [];
    const add = (s: string) => {
        if (s !== slug && !out.includes(s) && POST_SEO[s]) out.push(s);
    };
    for (const list of Object.values(TOPICS)) if (slug && list.includes(slug)) list.forEach(add);
    const start = slug ? Math.max(0, all.indexOf(slug)) : 0;
    for (let i = 1; i <= all.length && out.length < n; i++) add(all[(start + i) % all.length]);
    return out.slice(0, n).map((s) => toLink(s)!);
}
