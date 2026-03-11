import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Prevent duplicate initialization on hot-reloads in SSR
if (!getApps().length) {
    const serviceAccount = {
        projectId: import.meta.env.FIREBASE_PROJECT_ID,
        clientEmail: import.meta.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newline characters from .env parser
        privateKey: import.meta.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    };

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
        console.warn('⚠️ Missing Firebase Admin environment variables. Admin SDK might fail to initialize.');
    }

    try {
        initializeApp({
            credential: cert(serviceAccount)
        });
        console.log('✅ Firebase Admin SDK initialized successfully.');
    } catch (error) {
        console.error('❌ Error initializing Firebase Admin SDK:', error);
    }
}

export const db = getFirestore();
