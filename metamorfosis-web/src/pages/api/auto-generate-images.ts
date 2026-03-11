import type { APIRoute } from 'astro';
import { uploadImageBuffer } from '../../lib/firebase/storage-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { image_prompts, slug, title, category } = body;

        if (!slug || typeof slug !== 'string') {
            return new Response(JSON.stringify({ error: "El campo 'slug' es obligatorio." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!title || typeof title !== 'string') {
            return new Response(JSON.stringify({ error: "El campo 'title' es obligatorio para la validación semántica." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!image_prompts || !Array.isArray(image_prompts)) {
            return new Response(JSON.stringify({ error: "El array 'image_prompts' es obligatorio." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const googleAiApiKey = import.meta.env.GOOGLE_AI_API_KEY || import.meta.env.GEMINI_API_KEY;
        if (!googleAiApiKey) {
            return new Response(JSON.stringify({ error: "Falta GOOGLE_AI_API_KEY en el servidor." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const genAI = new GoogleGenerativeAI(googleAiApiKey);

        console.log(`🚀 Iniciando generación de ${image_prompts.length} imágenes vía Gemini (Imagen 3)...`);
        const generatedUrls: string[] = [];

        // Hacemos el fetch en serie o paralelo. Paralelo es más rápido.
        const promises = image_prompts.map(async (prompt, index) => {
            const startTime = Date.now();

            // Declaración de Diccionarios Metabólicos
            const metabolicKeys: Record<string, string[]> = {
                "Ayuno": ["reloj", "tiempo", "célula", "ayuno", "fasting", "time", "clock", "cell", "autophagy", "water", "window", "hour", "empty"],
                "Nutricion": ["comida", "plato", "proteína", "glucosa", "food", "plate", "protein", "glucose", "insulin", "diet", "nutrition", "meal", "avocado", "meat", "veg"],
                "Ejercicio": ["músculo", "pesa", "fuerza", "sudor", "muscle", "weight", "strength", "sweat", "gym", "exercise", "workout", "tension", "dumbell", "barbell", "tape"]
            };

            const cleanTitleWords = title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w: string) => w.length > 3);
            const promptWords = prompt.toLowerCase();
            const activeCategoryKeys = category && metabolicKeys[category] ? metabolicKeys[category] : [];

            let semanticMatches = 0;
            cleanTitleWords.forEach((word: string) => { if (promptWords.includes(word)) semanticMatches++; });
            activeCategoryKeys.forEach((key: string) => { if (promptWords.includes(key.toLowerCase())) semanticMatches++; });

            let finalPromptText = prompt;
            if (semanticMatches < 1) {
                console.warn(`⚠️ [Metamorfosis-Log] Activando Fallback Heurístico para Prompt: Usando Título Original del SEO.`);
                finalPromptText = `A conceptual metaphor representing: ${title}`;
            }

            const strictVisualRule = " No text, no labels, high-quality metabolic health metaphor, minimalist 3D isometric style, professional lighting. Focus on visual communication only.";
            const primaryPrompt = finalPromptText + strictVisualRule;

            // El prompt simplificado se usará si el primaryPrompt choca (error 400 por filtro de seguridad) o colapsa el modelo
            const simplifiedPrompt = `Aesthetically pleasing minimalist 3D render representing: ${title}. High quality graphic design, conceptual, no letters, no text.`;

            // Inicializar el modelo con el ID estándar de Imagen 3 (Requisito User)
            const targetModel = 'imagen-3';
            const model = genAI.getGenerativeModel({ model: targetModel });

            console.log(`[Img ${index + 1}] Solicitando generación vía SDK genAI (${targetModel})...`);

            // Intento 1: Primary Pipeline
            try {
                // Generando a través de la interfaz oficial SDK (Unified endpoint format)
                const result = await model.generateContent(primaryPrompt);

                // Mapeo defensivo a la posible estructura que retorne el SDK de Node para imágenes
                const rawResponseResponse = result.response;
                // La metadata viaja en inlineData.data (SDK standard) o como bytesBase64Encoded (Raw Vertex fallback en SDK)
                const base64Candidate =
                    rawResponseResponse?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
                    (rawResponseResponse as any)?.candidates?.[0]?.bytesBase64Encoded ||
                    (rawResponseResponse as any)?.predictions?.[0]?.bytesBase64Encoded;

                if (!base64Candidate) {
                    throw new Error(`Imagen generada pero la estructura Base64 del SDK no era legible. Raw: ${JSON.stringify(rawResponseResponse)}`);
                }

                const buffer = Buffer.from(base64Candidate, 'base64');
                const firebasePublicUrl = await uploadImageBuffer(buffer, slug, index);

                return { url: firebasePublicUrl, path: `articles/${slug}/visual-${index}.png`, model: targetModel, timeMs: Date.now() - startTime };

            } catch (e: any) {
                console.warn(`⚠️ [Img ${index + 1}] Falló Primary SDK (${targetModel}): ${e.message}`);

                // Intento 2: Prompt Simplificadísimo al mismo Modelo a través de SDK
                console.log(`[Img ${index + 1}] Reintentando con Simplified Prompt Heurístico en SDK...`);
                try {
                    const resultFallback = await model.generateContent(simplifiedPrompt);
                    const rawResponseFallback = resultFallback.response;

                    const base64CandidateFb =
                        rawResponseFallback?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
                        (rawResponseFallback as any)?.candidates?.[0]?.bytesBase64Encoded ||
                        (rawResponseFallback as any)?.predictions?.[0]?.bytesBase64Encoded;

                    if (!base64CandidateFb) {
                        throw new Error('Estructura Base64 ilegible en el Fallback SDK.');
                    }

                    const bufferFallback = Buffer.from(base64CandidateFb, 'base64');
                    const firebasePublicUrlFallback = await uploadImageBuffer(bufferFallback, slug, index);

                    return { url: firebasePublicUrlFallback, path: `articles/${slug}/visual-${index}.png`, model: targetModel + ' (Simplified SDK)', timeMs: Date.now() - startTime };

                } catch (errFallback: any) {
                    console.error(`❌ [Img ${index + 1}] Fallo general crítico de Generacion Visual SDK. Causas terminales: ${errFallback.message}`);
                    return null; // Frontend interpreta array y avanza a "pending_verification" preventivo
                }
            }
        });

        const results = await Promise.all(promises);

        // Filtramos nulos (fallos)
        const successfulResults = results.filter((res) => res !== null) as any[];
        const successfulUrls = successfulResults.map(r => r.url);

        return new Response(JSON.stringify({
            success: true,
            urls: successfulUrls,
            telemetry: successfulResults
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('❌ Error fatal en /api/auto-generate-images:', e.message);
        return new Response(JSON.stringify({ error: e.message || 'Error interno del servidor.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
