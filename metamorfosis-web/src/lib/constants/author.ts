/**
 * SPEC-116 (C1): autoría visible en cada artículo.
 *
 * Única fuente de verdad para la firma, la caja de autor y el JSON-LD.
 * El autor NO es médico (ver MedicalDisclaimer / SPEC-080): la caja lo dice
 * de forma explícita. `reviewer` queda en null hasta que un profesional de
 * la salud revise realmente el contenido; si se completa, la caja muestra
 * "Revisado por" y el JSON-LD añade `reviewedBy`.
 */
export interface ArticleReviewer {
    name: string;
    credential: string;
    url?: string;
}

export const ARTICLE_AUTHOR = {
    /** SPEC-117: el sitio ya no muestra el nombre del fundador; firma la marca. */
    name: 'Equipo Metamorfosis Real',
    profilePath: '/sobre-nosotros',
    role: 'Proyecto de salud metabólica',
    notDoctor: 'No somos médicos ni profesionales de la salud.',
    /** Cómo se elabora el contenido: debe ser cierto, el autor lo confirma. */
    howItsMade:
        'Cada artículo se elabora a partir de literatura científica publicada y se redacta con apoyo de herramientas de inteligencia artificial; las cifras y citas se contrastan con las fuentes originales antes de publicar y el texto lo revisa su autor.',
    reviewer: null as ArticleReviewer | null,
};
