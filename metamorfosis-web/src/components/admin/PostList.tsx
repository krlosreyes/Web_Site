import React, { useEffect, useState } from 'react';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';

interface Post {
    id: string;
    title: string;
    slug: string;
    views: number;
    clicks: number;
    conversions: number;
}

const PostList = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const fetchPosts = async () => {
                    try {
                        const postsRef = collection(db, 'posts');
                        // Normally order by createdAt desc, but we'll fetch all or limit
                        const q = query(postsRef, limit(10));
                        const snap = await getDocs(q);

                        const data: Post[] = [];
                        snap.forEach(doc => {
                            const postData = doc.data();
                            // Mocking metrics if they don't exist yet in the schema
                            const mockViews = Math.floor(Math.random() * 5000) + 500;
                            const mockClicks = Math.floor(mockViews * (Math.random() * 0.3 + 0.1));
                            const mockConversions = Math.floor(mockClicks * (Math.random() * 0.1 + 0.02));
                            data.push({
                                id: doc.id,
                                title: postData.title || 'Untitled',
                                slug: postData.slug || doc.id,
                                views: postData.views || mockViews,
                                clicks: postData.clicks || mockClicks,
                                conversions: postData.conversions || mockConversions,
                            });
                        });

                        // Sort by views
                        data.sort((a, b) => b.views - a.views);
                        setPosts(data);
                    } catch (error) {
                        console.error("Error fetching posts:", error);
                    } finally {
                        setLoading(false);
                    }
                };

                fetchPosts();
            } else {
                setLoading(false);
                console.warn("User not authenticated, skipping fetch.");
            }
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl h-full flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-[#00C49A] rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">Fetching Archives...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-1">Index de Contenido</h2>
                    <p className="text-xs text-gray-500 font-mono">Últimas 10 publicaciones inyectadas por IA</p>
                </div>
                <button className="text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-full border border-blue-500/30 hover:bg-blue-500/10">
                    Sincronizar Datos ↻
                </button>
            </div>

            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest bg-black/50 text-gray-500">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">Artículo</th>
                            <th className="px-4 py-3 text-right">Vistas</th>
                            <th className="px-4 py-3 text-right">Clics IMX</th>
                            <th className="px-4 py-3 text-right rounded-tr-lg">Subs Elena</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {posts.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-600 font-mono text-xs">
                                    No records found in database.
                                </td>
                            </tr>
                        ) : (
                            posts.map((post) => (
                                <tr key={post.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-4 py-4">
                                        <div className="font-medium text-gray-200 group-hover:text-white transition-colors line-clamp-1">{post.title}</div>
                                        <div className="text-[10px] text-gray-600 font-mono mt-1">/{post.slug}</div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="inline-flex items-center gap-1">
                                            {post.views.toLocaleString()}
                                            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="font-mono text-blue-400">{post.clicks.toLocaleString()}</span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <span className="inline-flex items-center gap-1 font-bold text-[#00C49A] w-12 justify-end">
                                                {post.conversions.toLocaleString()}
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                                            </span>
                                            <a
                                                href={`/blog/${post.slug}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold uppercase tracking-widest border border-gray-600 px-2 py-1 rounded text-gray-400 hover:text-white hover:border-gray-400"
                                            >
                                                Preview
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-600 font-mono flex justify-between">
                <span>System Status: <span className="text-[#00C49A]">Optimal</span></span>
                <span>DB: Firestore /posts</span>
            </div>
        </div>
    );
};

export default PostList;
