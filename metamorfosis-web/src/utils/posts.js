
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "../lib/firebase";

const COLLECTION_NAME = "metamorfosis_posts";

export async function getPosts() {
    const posts = [];
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("metadata.status", "==", "published")
        );
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            posts.push({
                id: doc.id,
                ...doc.data()
            });
        });
    } catch (error) {
        console.error("Error fetching posts:", error);
    }
    return posts;
}

export async function getPostBySlug(slug) {
    // Since we don't have slug as document ID, we might need a query
    // Ideally, slug should be unique.
    // Assuming for now we query by a 'metadata.slug' field or simply fetch all and find.
    // Better approach: query by slug field.

    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where("metadata.status", "==", "published")
        );
        // Optimization: In a real app, you'd want an index on slug and use `where("metadata.slug", "==", slug)`
        // For now, let's fetch all and filter or use the ID if the slug IS the ID.
        // The prompt implies we use "metamorfosis_posts". 
        // Let's assume the document ID is NOT the slug unless specified.

        // Let's try to find by query first
        const querySnapshot = await getDocs(q);
        const post = querySnapshot.docs.find(doc => doc.data().metadata?.slug === slug || doc.id === slug);

        if (post) {
            return {
                id: post.id,
                ...post.data()
            };
        }
    } catch (error) {
        console.error("Error fetching post by slug:", error);
    }
    return null;
}
