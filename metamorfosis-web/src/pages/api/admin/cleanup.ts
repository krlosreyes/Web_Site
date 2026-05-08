import { db } from '../../../lib/firebaseAdmin';

export async function GET() {
    try {
        const postsRef = db.collection('metamorfosis_posts');
        const snapshot = await postsRef.get();

        let deletedCount = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            // Detectamos el artículo corrupto por la longitud exagerada del slug o título
            if (data.slug && data.slug.length > 200) {
                await doc.ref.delete();
                deletedCount++;
            }
        }

        return new Response(JSON.stringify({ success: true, deletedCount }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
}
