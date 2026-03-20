import { db } from "../lib/firebaseAdmin";

const COLLECTION_NAME = "post";

export async function getPosts() {
    const posts = [];
    try {
        const postsRef = db.collection(COLLECTION_NAME);
        const snapshot = await postsRef.get();

        snapshot.forEach((doc) => {
            const data = doc.data();
            
            // Reconciliar viejos vs nuevos esquemas (Tolerancia a versiones planas)
            const normalizedMetadata = data.metadata || {
                seoTitle: data.title || doc.id,
                slug: data.slug || doc.id,
                status: data.status || 'published',
                category: data.category || 'Guía',
            };

            // Solo mostrar publicados
            if (normalizedMetadata.status === 'published' || data.status === 'published') {
                posts.push({
                    id: doc.id,
                    ...data,
                    metadata: normalizedMetadata, 
                    title: data.title || normalizedMetadata.seoTitle
                });
            }
        });
    } catch (error) {
        console.error("Error fetching posts:", error);
    }
    return posts;
}

export async function getPostBySlug(slug) {
    try {
        const postsRef = db.collection(COLLECTION_NAME);
        const snapshot = await postsRef.get();
        
        const postDoc = snapshot.docs.find(doc => {
            const data = doc.data();
            const docSlug = data.metadata?.slug || data.slug || doc.id;
            return docSlug === slug;
        });

        if (postDoc) {
            const data = postDoc.data();
             const normalizedMetadata = data.metadata || {
                seoTitle: data.title || postDoc.id,
                slug: data.slug || postDoc.id,
                status: data.status || 'published',
                category: data.category || 'Guía',
            };

            return {
                id: postDoc.id,
                ...data,
                metadata: normalizedMetadata,
                content: typeof data.content === 'string' ? { body: data.content } : data.content
            };
        }
    } catch (error) {
        console.error("Error fetching post by slug:", error);
    }
    return null;
}
