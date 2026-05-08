import * as dotenv from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// 1. Cargar variables de entorno
dotenv.config();

// 2. Inicialización moderna de Firebase Admin (ESM compatible)
if (getApps().length === 0) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // El replace es vital para parsear correctamente la llave en entornos Node
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

// Instanciar la base de datos
const db = getFirestore();

// 3. El Contrato de Datos: Primer Artículo Ancla
const postData = {
    metadata: {
        title: "Qué pasa en tu cuerpo hora a hora durante el ayuno",
        slug: "que-pasa-cuerpo-hora-hora-ayuno",
        pillar: "Ayuno Intermitente Inteligente",
        authority_level: "Hard Science",
        updated_at: "2026-04-07",
        reading_time_min: 7
    },
    content: {
        intro_text: "El ayuno no es una dieta para 'pasar hambre', es una reprogramación metabólica. Al detener la ingesta, fuerzas a tu cuerpo a cambiar su fuente de energía primaria: de glucosa externa a grasa almacenada.",
        body_blocks: [
            {
                type: "text",
                content: "Las primeras 12 horas son la fase de transición. Durante este tiempo, tu sistema agota las reservas de glucógeno en el hígado y los niveles de insulina comienzan a descender hacia su estado basal."
            },
            {
                type: "science_box",
                title: "Activación Lipolítica (Horas 12 a 16)",
                content: "Al caer la insulina, se activa la lipasa sensible a hormonas (LSH). Esto inicia la lipólisis: la descomposición de triglicéridos en ácidos grasos libres para ser oxidados en la mitocondria."
            },
            {
                type: "tip_box",
                title: "Acelerador Metabólico",
                content: "Realiza un entrenamiento de fuerza o camina a paso ligero durante la hora 12 de tu ayuno. Esto vaciará las reservas de glucógeno remanentes mucho más rápido y forzará la quema de grasa."
            },
            {
                type: "text",
                content: "A partir de la hora 16, el cuerpo entra en modo de supervivencia inteligente y reciclaje celular. En lugar de gastar energía procesando comida, la invierte en reparar daños estructurales a nivel microscópico."
            },
            {
                type: "science_box",
                title: "Autofagia (Hora 16+)",
                content: "Un proceso de control de calidad celular. Los lisosomas degradan proteínas disfuncionales y organelas envejecidas para construir componentes nuevos, rejuveneciendo el metabolismo de forma sistémica."
            },
            {
                type: "text",
                content: "No todos los metabolismos responden igual el primer día. Si tienes resistencia a la insulina, tu cuerpo luchará por encontrar glucosa, causando fatiga inicial hasta que recupere la flexibilidad metabólica."
            }
        ]
    },
    authority_evidence: {
        scientific_sources: [
            {
                source_name: "New England Journal of Medicine",
                study_title: "Effects of Intermittent Fasting on Health, Aging, and Disease",
                url: "https://www.nejm.org/doi/full/10.1056/NEJMra1905136",
                key_insight: "Confirma la transición metabólica de glucosa a cetonas como regulador central de la longevidad y resistencia al estrés celular."
            },
            {
                source_name: "Nobel Prize in Physiology",
                study_title: "Discoveries of Mechanisms for Autophagy (Yoshinori Ohsumi)",
                url: "https://www.nobelprize.org/prizes/medicine/2016/press-release/",
                key_insight: "Demuestra cómo la deprivación de nutrientes (ayuno) es el principal activador del reciclaje celular."
            }
        ],
        expert_review: "Revisado bajo estándares de ingeniería metabólica por el equipo de Metamorfosis Real."
    },
    monetization_library: {
        recommended_books: [
            {
                title: "The Obesity Code",
                author: "Dr. Jason Fung",
                format: "Audiobook / Hardcover",
                amazon_affiliate_url: "https://www.amazon.com/dp/1771641258",
                why_it_matters: "La explicación definitiva de por qué la obesidad es un problema hormonal(insulina) y no un balance calórico, y cómo el ayuno lo soluciona."
            }
        ]
    },
    app_integration: {
        active: true,
        cta_headline: "Optimiza tus ventanas de ayuno sin adivinar.",
        cta_button_text: "Monitorear en ElenaApp",
        deep_link: "elenaapp://tracking/fasting"
    },
    quiz: {
        show_imr_quiz: true,
        quiz_variant: "fasting-efficiency"
    }
};

// 4. Lógica de Inyección a Firestore
async function seedDatabase() {
    try {
        const slug = postData.metadata.slug;
        console.log(`\n⏳ Inyectando artículo en Firestore: [${slug}]...`);

        // Inyectamos en la colección usando el slug como ID del documento
        await db.collection('metamorfosis_posts').doc(slug).set(postData);

        console.log(`✅ ¡Éxito! El artículo "${postData.metadata.title}" ha sido inyectado en Firestore.`);
        console.log(`🌐 Prueba ahora en tu navegador: http://localhost:4321/articulos/${slug}\n`);
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Error crítico al inyectar en Firestore:");
        console.error(error);
        process.exit(1);
    }
}

// Ejecutar el script
seedDatabase();