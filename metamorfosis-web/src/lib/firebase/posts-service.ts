import { db } from '../firebaseAdmin';

/**
 * Service to handle Firestore operations for the metamorfosis_posts collection.
 * Applying Clean Architecture: This decouples the network controllers from the persistence layer.
 */
export const savePostToFirestore = async (slug: string, payload: any): Promise<void> => {
    if (!slug) {
        throw new Error("Slug is required for the document ID.");
    }

    try {
        await db.collection('metamorfosis_posts').doc(slug).set(payload);
    } catch (error) {
        console.error(`[PostsService] Firebase write failed for document ${slug}:`, error);
        throw new Error(`Fallo en la persistencia de base de datos para la llave ${slug}`);
    }
};

/**
 * Updates ONLY the body string of a document, leaving all other JSON nodes intact.
 * Essential for the atomic "visual resync" feature.
 */
export const updatePostBodyInFirestore = async (slug: string, newBody: string): Promise<void> => {
    if (!slug || !newBody) {
        throw new Error("Slug and newBody are required.");
    }
    try {
        await db.collection('metamorfosis_posts').doc(slug).update({
            'content.body': newBody
        });
    } catch (error) {
        console.error(`[PostsService] Firebase update failed for document ${slug}:`, error);
        throw new Error(`Fallo en la actualización atómica del artículo ${slug}`);
    }
};
