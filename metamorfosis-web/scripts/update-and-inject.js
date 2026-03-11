import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Find the service account matching the nam5 project or generally the one available
function findServiceAccount() {
    const files = fs.readdirSync(rootDir);
    for (const file of files) {
        if (file.endsWith('.json') && !['package.json', 'package-lock.json', 'tsconfig.json'].includes(file)) {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(rootDir, file), 'utf8'));
                if (content.type === 'service_account' && content.project_id && content.private_key) {
                    return content;
                }
            } catch (e) { }
        }
    }
    return null;
}

const serviceAccount = findServiceAccount();

if (!serviceAccount) {
    console.error('❌ Error: No Service Account file found in the root directory.');
    process.exit(1);
}

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}
const db = getFirestore();

const newPayload = {
    "metadata": {
        "title": "Ayuno Intermitente: Ingeniería Metabólica para Controlar tu Insulina",
        "slug": "ayuno-intermitente-insulina-control",
        "author": "Metamorfosis Real",
        "cover_image": "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?auto=format&fit=crop&w=800&q=80",
        "status": "published",
        "tags": ["Salud Metabólica", "Ayuno", "Insulina", "Autofagia"]
    },
    "content": "<p>El ayuno intermitente no es una restricción calórica, es una reprogramación metabólica estructural.</p><p>Al limitar la ventana de ingesta, obligamos al cuerpo a transicionar del uso de glucosa exógena a la oxidación de grasas almacenadas.</p><p>Este cambio de combustible estabiliza drásticamente los niveles de insulina y reduce la resistencia hormonal.</p><img src=\"https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80\" alt=\"Metabolismo y Nutrición\" class=\"w-full rounded-lg my-6 shadow-sm\"/><div class=\"box-science bg-blue-50 border-l-4 border-blue-600 p-5 my-6 rounded-r-md\"><strong class=\"text-blue-900 block mb-2 text-lg\">Ciencia Metabólica:</strong><p class=\"text-blue-800 m-0\">A partir de las 16 horas sin ingesta [00:06:36], las células inician la autofagia. Este proceso recicla proteínas degradadas, renueva estructuras celulares y mitiga la senescencia de los tejidos.</p></div><p>A nivel hepático, las reservas de glucógeno se agotan típicamente tras 12 horas de ayuno continuo.</p><p>En este punto de inflexión, el organismo activa la lipólisis, utilizando los triglicéridos como fuente primaria de energía.</p><p>El impacto clínico se traduce en mayor claridad mental, energía estable y reducción acelerada del tejido adiposo.</p><div class=\"box-tip bg-green-50 border-l-4 border-green-600 p-5 my-6 rounded-r-md\"><strong class=\"text-green-900 block mb-2 text-lg\">Optimización Práctica:</strong><p class=\"text-green-800 m-0\">Inicia con un protocolo de 12 horas (ej. 8:00 PM a 8:00 AM). Durante la ventana de ayuno, prioriza agua, café negro o té verde para no alterar la glucemia.</p></div><p>Romper el ayuno adecuadamente es tan crítico como el periodo de restricción mismo.</p><p>Evita los carbohidratos de alto índice glucémico en tu primera comida para prevenir picos agresivos de insulina.</p><p>Prioriza proteínas de alto valor biológico y grasas saludables para maximizar la síntesis muscular y combatir la sarcopenia.</p><div class=\"forum-section mt-10 border-t-2 border-gray-200 pt-8\"><h3>Foro Clínico: Metamorfosis Real</h3><p class=\"text-sm text-gray-600 mb-6\">Espacio de reporte técnico. ¿Qué protocolo de ayuno aplicas y cómo ha impactado tu glucemia basal?</p><form class=\"flex flex-col gap-4\"><textarea rows=\"3\" placeholder=\"Ingresa tu reporte metabólico aquí...\" class=\"p-4 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-black\"></textarea><button type=\"button\" class=\"bg-black text-white px-6 py-3 rounded-md font-bold w-fit hover:bg-gray-800 transition-colors\">Publicar Reporte</button></form><div class=\"comments-list mt-8 space-y-4\"><div class=\"comment bg-gray-50 border border-gray-100 p-4 rounded-md shadow-sm\"><span class=\"font-bold text-sm block text-black\">Usuario_Alfa_77</span><span class=\"text-sm text-gray-700 mt-1 block\">Protocolo 16/8 establecido hace 3 semanas. La niebla mental desapareció y la energía es lineal.</span></div><div class=\"comment bg-gray-50 border border-gray-100 p-4 rounded-md shadow-sm\"><span class=\"font-bold text-sm block text-black\">Ing_Metabólico</span><span class=\"text-sm text-gray-700 mt-1 block\">Iniciando con 12 horas de restricción temporal. Manteniendo la hidratación con electrolitos y café negro.</span></div></div></div>",
    "app_integration": {
        "cta_text": "Mide el impacto de tu ayuno en tiempo real y optimiza tus métricas de insulina con ElenaApp.",
        "cta_url": "https://elenaapp.com/tracker-metabolico",
        "visibility": true
    },
    "quiz": [
        {
            "question": "¿Qué proceso fisiológico clave se activa al superar las 16 horas de ayuno intermitente?",
            "options": [
                "Glucólisis acelerada",
                "Autofagia celular",
                "Pico de insulina",
                "Sarcopenia muscular"
            ],
            "correct_answer": 1,
            "explanation": "La autofagia es el mecanismo mediante el cual el cuerpo descompone y recicla proteínas dañadas para construir estructuras celulares nuevas y funcionales."
        }
    ]
};

async function executeMigration() {
    try {
        console.log("Iniciando migración de Firestore...");

        // 1. Batch update existing documents to "hidden"
        console.log("🔍 Buscando documentos en metamorfosis_posts...");
        const postsRef = db.collection('metamorfosis_posts');
        const snapshot = await postsRef.get();
        if (snapshot.empty) {
            console.log("No se encontraron documentos para ocultar.");
        } else {
            const batch = db.batch();
            snapshot.forEach(doc => {
                const docRef = postsRef.doc(doc.id);
                // Update only metadata.status to 'hidden'
                batch.set(docRef, { metadata: { status: 'hidden' } }, { merge: true });
            });
            await batch.commit();
            console.log(`✅ ${snapshot.size} posts ocultados exitosamente.`);
        }

        // 2. Inject new post
        console.log("Iniciando inyección del nuevo post...");
        const newDocRef = await postsRef.add(newPayload);
        console.log(`✅ Post 'Ayuno Intermitente' inyectado exitosamente con ID: ${newDocRef.id}`);

        process.exit(0);
    } catch (e) {
        console.error("❌ Falló la migración:", e);
        process.exit(1);
    }
}

executeMigration();
