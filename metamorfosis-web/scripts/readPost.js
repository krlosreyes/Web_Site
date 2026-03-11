
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find Service Account Key (reusing logic from injectPost.js)
function findServiceAccount() {
    const rootDir = path.resolve(__dirname, '..');
    const files = fs.readdirSync(rootDir);
    for (const file of files) {
        if (file.endsWith('.json') && file.includes('firebase-adminsdk')) {
             return JSON.parse(fs.readFileSync(path.join(rootDir, file), 'utf8'));
        }
    }
    return null;
}

const serviceAccount = findServiceAccount();
if (!serviceAccount) { console.error('No service account'); process.exit(1); }

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function readPost() {
    const slug = 'como-empezar-ayuno-intermitente-3-niveles';
    const docRef = db.collection('metamorfosis_posts').doc(slug);
    const doc = await docRef.get();
    
    if (!doc.exists) {
        console.log('❌ Document does not exist!');
    } else {
        const data = doc.data();
        console.log('✅ Document found.');
        console.log('--- CONTENT START ---');
        console.log(data.content.body.substring(0, 500)); // Print first 500 chars
        console.log('--- CONTENT END ---');
    }
}

readPost();
