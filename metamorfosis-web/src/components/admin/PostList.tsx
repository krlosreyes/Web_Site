import React, { useEffect, useState } from 'react';

interface Post {
    id: string;
    title: string;
    slug: string;
    views: number;
    clicks: number;
    conversions: number;
    content?: string;
    images?: string[];
    references?: string[];
    quiz?: any[];
}

interface PostListProps {
    onEdit: (post: Post) => void;
    onNew: () => void;
}

const PostList: React.FC<PostListProps> = ({ onEdit, onNew }) => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/posts');
            if (response.ok) {
                const data = await response.json();
                if (data.success) setPosts(data.posts);
            }
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar este artículo permanentemente?')) return;
        try {
            const response = await fetch(`/api/admin/posts?id=${id}`, { method: 'DELETE' });
            if (response.ok) fetchPosts();
        } catch (error) {
            console.error("Error deleting post:", error);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    if (loading) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl h-full flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-[#00C49A] rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">Cargando Archivos...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-1">Index de Contenido</h2>
                    <p className="text-xs text-gray-500 font-mono">Gestiona tus artículos de autoridad</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onNew} className="text-xs font-bold uppercase tracking-wider bg-[#00C49A] text-black px-4 py-2 rounded-xl hover:bg-[#00C49A]/90 transition-all">
                        + Nuevo Artículo
                    </button>
                    <button onClick={fetchPosts} className="text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-full border border-blue-500/30 hover:bg-blue-500/10">
                        ↻
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest bg-black/50 text-gray-500">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">Artículo</th>
                            <th className="px-4 py-3 text-right">Métricas</th>
                            <th className="px-4 py-3 text-right rounded-tr-lg">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {posts.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-600 font-mono text-xs">
                                    No hay artículos publicados aún.
                                </td>
                            </tr>
                        ) : (
                            posts.map((post) => (
                                <tr key={post.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-4 py-4 max-w-md">
                                        <div className="font-medium text-gray-200 group-hover:text-white transition-colors line-clamp-1 overflow-hidden">{post.title}</div>
                                        <div className="text-[10px] text-gray-600 font-mono mt-1 truncate max-w-xs">/{post.slug}</div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] uppercase tracking-tighter text-gray-500">Vistas: {post.views}</span>
                                            <span className="text-[10px] uppercase tracking-tighter text-blue-400">Clics: {post.clicks}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => onEdit(post)}
                                                className="text-[10px] font-bold uppercase tracking-widest border border-blue-500/30 px-2 py-1 rounded text-blue-400 hover:bg-blue-500/10"
                                            >
                                                Editar
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(post.id)}
                                                className="text-[10px] font-bold uppercase tracking-widest border border-red-500/30 px-2 py-1 rounded text-red-500 hover:bg-red-500/10"
                                            >
                                                Borrar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PostList;
