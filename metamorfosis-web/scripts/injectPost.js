import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..'); // <-- Movido al scope global para que Git sepa dónde ejecutarse

// Find Service Account Key
function findServiceAccount() {
    const files = fs.readdirSync(rootDir);

    // Look for any .json file that contains "private_key" and "client_email"
    for (const file of files) {
        if (file.endsWith('.json') && file !== 'package.json' && file !== 'package-lock.json' && file !== 'tsconfig.json') {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(rootDir, file), 'utf8'));
                if (content.type === 'service_account' && content.project_id && content.private_key) {
                    console.log(`✅ Found Service Account: ${file}`);
                    return content;
                }
            } catch (e) {
                // Ignore parsing errors for non-JSON files or invalid JSON
            }
        }
    }
    return null;
}

const serviceAccount = findServiceAccount();

if (!serviceAccount) {
    console.error('❌ Error: No Service Account file found in the root directory.');
    console.error('Please place your Firebase Service Account JSON file in the root of the project.');
    process.exit(1);
}

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function uploadPost() {
    // Get JSON file path from args
    const filePath = process.argv[2];

    if (!filePath) {
        console.error('❌ Error: Please provide the path to the JSON file.');
        console.error('Usage: node scripts/injectPost.js <path-to-json-file>');
        process.exit(1);
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const postData = JSON.parse(fileContent);

        // Validation
        const allowedNodes = ['metadata', 'content', 'app_integration', 'quiz'];
        const rootNodes = Object.keys(postData);

        for (const node of rootNodes) {
            if (!allowedNodes.includes(node)) {
                throw new Error(`Invalid Schema: root node '${node}' is not allowed. Only 4 root nodes are strictly permitted: metadata, content, app_integration, quiz.`);
            }
        }

        if (!postData.metadata || !postData.metadata.slug) {
            throw new Error("Invalid Schema: 'metadata' node with a 'slug' is required.");
        }
        if (!postData.content) {
            throw new Error("Invalid Schema: 'content' node is required.");
        }
        if (!postData.app_integration) {
            throw new Error("Invalid Schema: 'app_integration' node is strictly required.");
        }

        // Quiz validation
        if (!postData.quiz || !Array.isArray(postData.quiz)) {
            throw new Error("Invalid Schema: 'quiz' must be an array.");
        }

        if (postData.quiz.length < 3 || postData.quiz.length > 5) {
            throw new Error("Invalid Schema: 'quiz' must contain 3-5 questions.");
        }

        postData.quiz.forEach((q, idx) => {
            if (!q.question || typeof q.question !== 'string') {
                throw new Error(`Invalid Schema: quiz[${idx}].question is required and must be a string.`);
            }
            if (!Array.isArray(q.options) || q.options.length !== 4) {
                throw new Error(`Invalid Schema: quiz[${idx}].options must be an array with exactly 4 items.`);
            }
            q.options.forEach((opt, optIdx) => {
                if (typeof opt !== 'string') {
                    throw new Error(`Invalid Schema: quiz[${idx}].options[${optIdx}] must be a string.`);
                }
            });
            if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
                throw new Error(`Invalid Schema: quiz[${idx}].correctIndex must be a number between 0-3.`);
            }
            if (!q.rationale || typeof q.rationale !== 'string') {
                throw new Error(`Invalid Schema: quiz[${idx}].rationale is required and must be a string.`);
            }
        });

        console.log(`✅ Quiz validation passed: ${postData.quiz.length} questions validated.`);

        const slug = postData.metadata.slug;
        const docRef = db.collection('metamorfosis_posts').doc(slug);

        await docRef.set(postData);

        console.log(`✅ Successfully uploaded post: ${slug}`);
        console.log(`📄 Document ID: ${slug}`);

        // --- INICIO DEL NUEVO BLOQUE DE AUTO-DESPLIEGUE ---
        try {
            console.log('🚀 Iniciando proceso de auto-despliegue hacia GitHub y Hostinger...');

            // 1. Crea/Modifica el archivo trigger en la raíz del proyecto
            const triggerFile = path.join(rootDir, 'last-update.txt');
            fs.writeFileSync(triggerFile, `Última actualización: ${new Date().toISOString()} - Post: ${slug}`);

            // 2. Ejecuta los comandos de Git automáticamente, indicando que use la carpeta raíz (cwd: rootDir)
            execSync('git add last-update.txt', { stdio: 'inherit', cwd: rootDir });
            execSync(`git commit -m "content: auto-deploy after injecting post ${slug}"`, { stdio: 'inherit', cwd: rootDir });
            execSync('git push origin main', { stdio: 'inherit', cwd: rootDir });

            console.log('✅ Pipeline de GitHub Actions disparado con éxito. El sitio estará en vivo en ~2 minutos.');
        } catch (gitError) {
            console.error('❌ Error disparando el despliegue en Git. El post subió a Firebase, pero el sitio no se actualizó automáticamente:', gitError.message);
            console.log('💡 Sugerencia: Puedes hacer un git add . && git commit -m "update" && git push manual para actualizar la web.');
        }
        // --- FIN DEL NUEVO BLOQUE ---

    } catch (error) {
        console.error('❌ Error uploading post:', error.message);
        process.exit(1);
    }
}

uploadPost();