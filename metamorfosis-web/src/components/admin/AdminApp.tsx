import React, { useState } from 'react';
import StatsGrid from './StatsGrid';
import PostList from './PostList';
import LeadList from './LeadList';
import ArticleEditor from './ArticleEditor';

class ErrorBoundary extends React.Component<{children: React.ReactNode, onReset: () => void}, {hasError: boolean, error: string}> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: '' };
    }
    static getDerivedStateFromError(error: any) {
        return { hasError: true, error: error?.message || 'Error desconocido' };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-10 text-center">
                    <p className="text-red-400 font-bold text-lg mb-2">⚠️ Error en el componente</p>
                    <p className="text-gray-400 text-sm mb-6 font-mono">{this.state.error}</p>
                    <button 
                        onClick={() => { this.setState({ hasError: false, error: '' }); this.props.onReset(); }}
                        className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-red-500 transition-all"
                    >
                        ← Volver al Panel
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const AdminApp = () => {
    const [activeTab, setActiveTab] = useState<'ARCHIVE' | 'LEADS'>('ARCHIVE');
    const [isEditing, setIsEditing] = useState(false);
    const [editingPost, setEditingPost] = useState<any>(null);

    const handleSaveArticle = async (article: any) => {
        try {
            const method = article.id ? 'PUT' : 'POST';
            const response = await fetch('/api/admin/posts', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(article)
            });
            if (response.ok) {
                setIsEditing(false);
                setEditingPost(null);
                window.location.reload(); 
            } else {
                const errData = await response.json();
                throw new Error(errData.error || 'Error en el servidor');
            }
        } catch (error) {
            console.error("Error saving article:", error);
            throw error; // Re-lanzar para que ArticleEditor lo capture
        }
    };

    const handleEdit = (post: any) => {
        setEditingPost(post);
        setIsEditing(true);
    };

    const handleNew = () => {
        setEditingPost(null);
        setIsEditing(true);
    };

    const handleReset = () => {
        setIsEditing(false);
        setEditingPost(null);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-8rem)]">
            {/* Sidebar Navigation */}
            {!isEditing && (
                <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-2">
                    <button
                        onClick={() => setActiveTab('LEADS')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm border ${activeTab === 'LEADS'
                            ? 'bg-[#00C49A]/10 text-[#00C49A] border-[#00C49A]/30 shadow-[0_0_15px_rgba(0,196,154,0.1)]'
                            : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-800/50 hover:text-white'
                            }`}
                    >
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        Gestión de Leads
                    </button>

                    <button
                        onClick={() => setActiveTab('ARCHIVE')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm border ${activeTab === 'ARCHIVE'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                            : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-800/50 hover:text-white'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        Gestión de Artículos
                    </button>

                    <a
                        href="/admin/analitica-imr"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm border bg-transparent text-gray-500 border-transparent hover:bg-gray-800/50 hover:text-white mt-4 relative group"
                    >
                        <div className="absolute inset-0 bg-[#00C49A]/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-md"></div>
                        <svg className="w-5 h-5 relative z-10 text-[#00C49A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        <span className="relative z-10">Analítica IMR →</span>
                    </a>
                </aside>
            )}

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 flex flex-col gap-8">
                <ErrorBoundary onReset={handleReset}>
                    {isEditing ? (
                        <ArticleEditor 
                            article={editingPost} 
                            onSave={handleSaveArticle} 
                            onCancel={() => setIsEditing(false)} 
                        />
                    ) : (
                        <>
                            <StatsGrid />
                            <div className="flex-1 animate-fade-in-up">
                                {activeTab === 'LEADS' && <LeadList />}
                                {activeTab === 'ARCHIVE' && <PostList onEdit={handleEdit} onNew={handleNew} />}
                            </div>
                        </>
                    )}
                </ErrorBoundary>
            </main>
        </div>
    );
};

export default AdminApp;

