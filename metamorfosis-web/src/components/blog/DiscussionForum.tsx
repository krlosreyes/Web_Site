import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';

interface Comment {
    id: string;
    text: string;
    userId: string;
    userName: string;
    createdAt: any;
}

interface DiscussionForumProps {
    postId: string;
}

const DiscussionForum: React.FC<DiscussionForumProps> = ({ postId }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [user, setUser] = useState<User | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Check Auth State
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribeAuth();
    }, []);

    // 2. Realtime Listener for Comments in this specific Post
    useEffect(() => {
        if (!postId) return;

        const commentsRef = collection(db, 'posts', postId, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'desc'));

        const unsubscribeComments = onSnapshot(q, (snapshot) => {
            const commentsData: Comment[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                commentsData.push({
                    id: doc.id,
                    text: data.text,
                    userId: data.userId,
                    userName: data.userName || 'Usuario Anónimo',
                    createdAt: data.createdAt,
                });
            });
            setComments(commentsData);
        }, (error) => {
            console.error("Error listening to comments:", error);
        });

        return () => unsubscribeComments();
    }, [postId]);

    // 3. Submit New Comment
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newComment.trim() || !postId) return;

        setIsSubmitting(true);
        try {
            const commentsRef = collection(db, 'posts', postId, 'comments');
            await addDoc(commentsRef, {
                text: newComment.trim(),
                userId: user.uid,
                userName: user.displayName || user.email?.split('@')[0] || 'Usuario Metamorfosis',
                createdAt: serverTimestamp()
            });
            setNewComment('');
        } catch (error) {
            console.error("Error adding comment:", error);
            alert("No se pudo publicar el comentario. Intenta de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper para formatear fecha relative
    const formatTimeAgo = (timestamp: any) => {
        if (!timestamp) return 'justo ahora';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const seconds = Math.floor((new Date().getTime() - date) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " años atrás";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " pt. meses atrás";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " días atrás";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hs atrás";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " mins atrás";
        return Math.floor(seconds) + " segs atrás";
    };


    return (
        <div className="mt-16 border-t border-gray-800 pt-12">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                    <svg className="w-6 h-6 text-[#00C49A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg>
                    Foro de Discusión
                    <span className="text-xs font-mono font-medium bg-[#00C49A]/20 text-[#00C49A] px-2 py-1 rounded-full">{comments.length}</span>
                </h3>
            </div>

            {/* Formulario de Ingreso */}
            {!user ? (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center shadow-lg mb-10">
                    <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    </div>
                    <h4 className="text-lg font-bold text-gray-200 mb-2">Comunidad Exclusiva</h4>
                    <p className="text-sm text-gray-500 mb-6 font-mono">Inicia sesión en la plataforma para participar en la discusión de este artículo, hacer preguntas y conectar con otros pioneros de la salud metabólica.</p>
                    <a href="/login" className="inline-block bg-white text-black font-bold uppercase tracking-widest text-xs px-8 py-3 rounded-full hover:bg-gray-200 transition-colors">
                        Iniciar Sesión / Registrarse
                    </a>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="mb-12 relative">
                    <div className="flex gap-4">
                        <div className="w-10 h-10 shrink-0 bg-gradient-to-tr from-[#00C49A] to-blue-500 rounded-full flex items-center justify-center text-white font-bold uppercase shadow-lg border-2 border-gray-900 z-10">
                            {user.email?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Comparte tu experiencia, haz una pregunta o deja un tip..."
                                className="w-full bg-gray-900/50 border border-gray-800 hover:border-gray-700 focus:border-[#00C49A]/50 focus:ring-1 focus:ring-[#00C49A]/50 rounded-2xl p-4 text-sm text-white placeholder-gray-600 transition-all min-h-[120px] resize-y"
                                required
                            />
                            <div className="flex justify-end mt-3">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newComment.trim()}
                                    className={`px-6 py-2.5 rounded-full font-bold uppercase tracking-widest text-xs transition-all flex items-center gap-2
                                        ${isSubmitting || !newComment.trim() 
                                            ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                                            : 'bg-[#00C49A] hover:bg-[#00C49A]/90 text-black'}`}
                                >
                                    {isSubmitting ? 'Publicando...' : 'Publicar Comentario'} 
                                    {!isSubmitting && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {/* Hilo de Comentarios */}
            <div className="space-y-6">
                {comments.length === 0 ? (
                    <div className="text-center py-12 text-gray-600 font-mono text-sm border border-dashed border-gray-800 rounded-2xl">
                        Aún no hay comentarios. {user ? "¡Sé el primero en iniciar la discusión!" : ""}
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex gap-4 group">
                            <div className="w-10 h-10 shrink-0 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 font-bold uppercase border border-gray-700">
                                {comment.userName.charAt(0)}
                            </div>
                            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-5 group-hover:border-gray-700 transition-colors">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-bold text-gray-300 capitalize">{comment.userName}</span>
                                    <span className="text-[10px] text-gray-600 font-mono">{formatTimeAgo(comment.createdAt)}</span>
                                </div>
                                <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                                    {comment.text}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DiscussionForum;
