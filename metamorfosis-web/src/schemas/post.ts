import { z } from 'zod';

export const PostSchema = z.object({
    metadata: z.object({
        title: z.string(),
        slug: z.string(),
        pillar: z.string(),
        authority_level: z.string(),
        updated_at: z.string()
    }),
    content: z.object({
        blocks: z.array(z.object({
            type: z.enum(['text', 'science_box', 'tip_box']),
            title: z.string().optional(),
            content: z.string()
        }))
    }),
    authority_evidence: z.object({
        scientific_sources: z.array(z.object({
            source_name: z.string(),
            study_title: z.string(),
            url: z.string(),
            doi: z.string().optional(),
            key_insight: z.string()
        })),
        expert_review: z.string()
    }),
    monetization_library: z.object({
        recommended_books: z.array(z.object({
            title: z.string(),
            author: z.string(),
            format: z.string(),
            amazon_affiliate_url: z.string(),
            why_it_matters: z.string()
        })).optional()
    }),
    app_integration: z.object({
        active: z.boolean(),
        feature_focus: z.string(),
        cta_text: z.string(),
        deep_link: z.string()
    }),
    quiz: z.object({
        show_imr_quiz: z.boolean(),
        quiz_id: z.string()
    })
});

export type Post = z.infer<typeof PostSchema>;