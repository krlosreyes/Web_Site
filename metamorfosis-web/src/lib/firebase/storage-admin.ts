import { getStorage } from 'firebase-admin/storage';
import crypto from 'crypto';
import '../firebaseAdmin';

export async function uploadImageBuffer(buffer: Buffer, slug: string, index: number): Promise<string> {
    const bucketName = import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!bucketName) {
        throw new Error('❌ Falta la variable PUBLIC_FIREBASE_STORAGE_BUCKET en el .env');
    }

    const bucket = getStorage().bucket(bucketName);
    const uuid = crypto.randomUUID();
    const filePath = `articles/${slug}/visual-${index}.png`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
        metadata: {
            contentType: 'image/png',
            metadata: {
                firebaseStorageDownloadTokens: uuid,
            }
        },
    });

    // Construir la URL pública nativa de Firebase Storage
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${uuid}`;
    return publicUrl;
}
