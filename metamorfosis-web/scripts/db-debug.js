import admin from 'firebase-admin';
import fs from 'fs';

// Setup basic cert from .env
const envFile = fs.readFileSync('.env', 'utf8');

const projectIdMatch = envFile.match(/FIREBASE_PROJECT_ID=(.*)/);
const clientEmailMatch = envFile.match(/FIREBASE_CLIENT_EMAIL=(.*)/);
const privateKeyMatch = envFile.match(/FIREBASE_PRIVATE_KEY=(.*)/);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: projectIdMatch ? projectIdMatch[1].replace(/['"]/g, '').trim() : '',
            clientEmail: clientEmailMatch ? clientEmailMatch[1].replace(/['"]/g, '').trim() : '',
            privateKey: privateKeyMatch ? privateKeyMatch[1].replace(/['"]/g, '').replace(/\\n/g, '\n').trim() : '',
        }),
    });
}

const db = admin.firestore();

async function listCollections() {
    try {
        console.log("Checking collections...");
        const collections = await db.listCollections();
        console.log("Available collections:");
        collections.forEach(collection => console.log("-", collection.id));
        
        const postSnap = await db.collection('post').limit(1).get();
        console.log(`'post' collection has docs: ${!postSnap.empty}`);
        
        const postsSnap = await db.collection('posts').limit(1).get();
        console.log(`'posts' collection has docs: ${!postsSnap.empty}`);
        
        if (!postSnap.empty) {
            console.log("\n--- Sample data from 'post' (Singular) ---");
            console.log(JSON.stringify(postSnap.docs[0].data(), null, 2));
        }
        if (!postsSnap.empty) {
            console.log("\n--- Sample data from 'posts' (Plural) ---");
            console.log(JSON.stringify(postsSnap.docs[0].data(), null, 2));
        }

    } catch (e) {
        console.error("Error code:", e.code);
        console.error("Error message:", e.message);
    }
}

listCollections();
