import type { DocumentData } from "firebase/firestore";

export interface PostData extends DocumentData {
    id: string;
    metadata?: {
        seoTitle?: string;
        seoDescription?: string;
        publishedAt?: string;
        youtubeUrl?: string;
        slug?: string;
        category?: string;
        readingTime?: number;
        thumbnailUrl?: string;
        impact?: "Bajo" | "Medio" | "Alto";
        effort?: number | "N/A";
        biomarker?: string;
    };
    content?: {
        body?: string;
    };
    image_prompts?: string[];
    comparisons?: Array<{
        concept: string;
        myth: string;
        reality: string;
    }>;
    steps?: Array<{
        title: string;
        description: string;
        time?: string;
    }>;
    quiz?: Array<{
        question: string;
        options: string[];
        correctIndex: number;
        rationale: string;
    }>;
    app_integration?: {
        callToAction?: string;
        deepLink?: string;
    };
    references?: Array<{
        title: string;
        url: string;
    }>;
}
