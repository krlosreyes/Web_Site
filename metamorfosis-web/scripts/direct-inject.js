import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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

const payload = {
    "metadata": {
        "title": "Qué es la insulina",
        "slug": "que-es-la-insulina",
        "views": 0,
        "conversions": 0,
        "videoUrl": "https://youtube.com/shorts/OGQ-NRl1Opo",
        "category": "Salud Metabólica",
        "imagePrompt": "cinematic 3d render of a cell being opened by a cyan energy key, dark technological background, hyper-detailed, 8k",
        "source_type": "research_augmented",
        "coverImage": "https://images.unsplash.com/photo-1532187863486-abf9db0c2095?q=80&w=1920&auto=format&fit=crop",
        "date": new Date().toISOString()
    },
    "content": {
        "introduction": "La insulina no es simplemente una hormona de almacenamiento; es el sistema de control de acceso principal de la célula. Sin ella, el sustrato energético más abundante (la glucosa) queda aislado en el torrente sanguíneo, provocando una crisis de inanición celular paradójica rodeada de energía inutilizable.",
        "sections": [
            "<h2 class='text-xl font-bold mb-4'>Mecanismo</h2><p class='mb-4'>El receptor de insulina actúa como una cerradura biométrica en la membrana plasmática. Cuando la molécula de insulina se acopla, desencadena una cascada de fosforilación intracelular. Esta señal provoca la translocación de los transportadores GLUT4 desde vesículas internas hacia la superficie celular.</p><p class='mb-4'>Una vez anclados en la membrana, los GLUT4 abren canales exclusivos para la entrada masiva de glucosa. Es un proceso de difusión facilitada hiper-eficiente que reduce dramáticamente la glucemia sérica mientras recarga el ATP celular. El sistema está calibrado para responder en milisegundos tras la ingesta.</p>",
            "<h2 class='text-xl font-bold mb-4'>Fallo del sistema</h2><p class='mb-4'>La resistencia metabólica (resistencia a la insulina) ocurre cuando los receptores sufren desensibilización por sobre-exposición crónica al ligando. Las vías de señalización intracelular (como PI3K/Akt) se bloquean a causa de metabolitos lipídicos tóxicos intracelulares como ceramidas y diacilgliceroles.</p><p class='mb-4'>Al fallar la señalización, las vesículas de GLUT4 permanecen secuestradas en el citosol. Como resultado, la célula no puede absorber glucosa, el páncreas en una maniobra compensatoria secreta aún más insulina (hiperinsulinemia), agravando la desensibilización y patologías asociadas.</p>",
            "<h2 class='text-xl font-bold mb-4'>Solución</h2><p class='mb-4'>Revertir el fallo del sistema requiere vaciar los depósitos de grasa ectópica y silenciar la hiperinsulinemia compensatoria. El ayuno intermitente y el vaciamiento de glucógeno mediante entrenamiento de fuerza imponen un estrés energético local que fuerza la lipólisis celular.</p><p class='mb-4'>Una vez que desaparece la interferencia de lipotóxicos, la cascada de señalización se re-calibra. La sensibilidad del receptor se restaura, permitiendo que niveles basales de insulina detonen la translocación de transportadores GLUT4, recuperando el flujo constante de homeostasis metabólica.</p>"
        ],
        "references": [
            "[Klip, A. et al. - Insulin signaling to GLUT4] - [https://pubmed.ncbi.nlm.nih.gov/15509748/]",
            "[Shulman, G. I. - Cellular mechanisms of insulin resistance] - [https://www.jci.org/articles/view/10581]"
        ]
    },
    "app_integration": {
        "callToAction": "¿Listo para revertir tu resistencia a la insulina con datos exactos?",
        "deepLink": "https://elena.com/"
    },
    "quiz": [
        {
            "question": "¿Qué estructura celular actúa como 'puerta' específica para la entrada de glucosa estimulada por insulina?",
            "options": ["Receptor de Insulina", "Transportadores GLUT4", "Mitocondrias", "Canales de Sodio"],
            "correctIndex": 1,
            "rationale": "Los transportadores GLUT4 son las proteínas de canal que se mueven hacia la membrana celular exclusivamente bajo la cascada de señalización de la insulina iniciada en el receptor."
        },
        {
            "question": "¿Cuál es el principal bloqueador intracelular de la señal del receptor de insulina?",
            "options": ["Exceso de ATP", "Metabolitos lipídicos tóxicos (ej. Ceramidas)", "Falta de Glucógeno", "Bajo volumen de Sodio"],
            "correctIndex": 1,
            "rationale": "Metabolitos derivados del almacenamiento patológico de grasas intramiocelulares (como ceramidas y DAG) bloquean e interfieren directamente en las vías PI3K/Akt deteniendo los transportadores GLUT4."
        },
        {
            "question": "¿Qué intervención metabólica RESTAURA directamente la sensibilidad de los receptores?",
            "options": ["Frecuencia alta de comidas (snacks)", "Vaciamiento de glucógeno (ejercicio) y Ayuno", "Inyección exógena de insulina lenta", "Consumo excesivo de fructosa aislada"],
            "correctIndex": 1,
            "rationale": "Al vaciar las reservas celulares y evitar los picos frecuentes de glucemia, el déficit promueve la re-sensibilización progresiva permitiendo un acople óptimo entre ligando y receptor."
        }
    ]
};

async function uploadDirectly() {
    try {
        console.log("Iniciando inyección directa del artículo científico...");
        const docRef = await db.collection('metamorfosis_posts').add(payload);
        console.log(`✅ Inyección exitosa. Documento guardado en metamorfosis_posts con ID: ${docRef.id}`);
        process.exit(0);
    } catch (e) {
        console.error("❌ Falló la inyección:", e);
        process.exit(1);
    }
}

uploadDirectly();
