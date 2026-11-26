import { ARTICLE_AUTHOR, type ArticleReviewer } from '../constants/author';

/**
 * Autor del JSON-LD (E-E-A-T), con URL absoluta al perfil.
 * SPEC-117: firma la marca, así que es Organization, no Person.
 */
export function buildAuthorJsonLd(origin: string) {
    return {
        '@type': 'Organization',
        name: ARTICLE_AUTHOR.name,
        url: new URL(ARTICLE_AUTHOR.profilePath, origin).toString(),
    };
}

/** `reviewedBy` solo existe si hay revisor real; si no, undefined. */
export function buildReviewerJsonLd(reviewer: ArticleReviewer | null = ARTICLE_AUTHOR.reviewer) {
    if (!reviewer) return undefined;
    return {
        '@type': 'Person',
        name: reviewer.name,
        jobTitle: reviewer.credential,
        ...(reviewer.url ? { url: reviewer.url } : {}),
    };
}
