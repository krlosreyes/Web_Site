import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure it reads from the `.env` root file manually
const envPath = resolve(__dirname, '../.env');
const envFile = fs.readFileSync(envPath, 'utf8');

const envVars = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        envVars[key] = value;
    }
});

const serviceAccount = {
    projectId: envVars['FIREBASE_PROJECT_ID'] || envVars['PUBLIC_FIREBASE_PROJECT_ID'],
    clientEmail: envVars['FIREBASE_CLIENT_EMAIL'],
    privateKey: envVars['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
};

if (!serviceAccount.privateKey) {
    console.error('❌ Error: FIREBASE_PRIVATE_KEY is missing in your .env file.');
    process.exit(1);
}

try {
    initializeApp({
        credential: cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK Initialized.');
} catch (error) {
    console.error('❌ Error initializing Firebase Admin: ', error);
}

const adminEmail = 'admin@metamorfosis.com';
const adminPassword = envVars['ADMIN_PASSWORD'] || 'metamorfosis2026';

async function createAdminUser() {
    try {
        console.log(`Buscando usuario administrador: ${adminEmail} ...`);
        try {
            const user = await getAuth().getUserByEmail(adminEmail);
            console.log(`✅ El usuario ${adminEmail} ya existe con UID: ${user.uid}. No es necesario crearlo.`);
            process.exit(0);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log(`Creando nuevo usuario administrador...`);
                const userRecord = await getAuth().createUser({
                    email: adminEmail,
                    password: adminPassword,
                    displayName: 'System Admin',
                });
                console.log(`✅ Usuario creado exitosamente! UID: ${userRecord.uid}`);
                console.log(`🔑 Puedes iniciar sesión en el Admin Dashboard usando este correo y tu ADMIN_PASSWORD del .env`);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('❌ Ocurrió un error creando al administrador:', error);
    }
}

createAdminUser();
