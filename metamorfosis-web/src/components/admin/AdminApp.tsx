import React, { Suspense, useState } from 'react';
import StatsGrid from './StatsGrid';
import PostList from './PostList';
import LeadList from './LeadList';
import ArticleEditor from './ArticleEditor';
import FoundersList from './FoundersList';

/**
 * Lazy load de AnaliticaIMR (SPEC-017).
 * Recharts + cálculo del motor IMR sobre cada doc — pesado para usuarios
 * que sólo quieren gestionar leads o artículos. El chunk se descarga
 * la primera vez que el tab ANALYTICS se activa.
 */
const AnaliticaIMR = React.lazy(() => import('./AnaliticaIMR'));
/** SPEC-018: lazy load del visor de audit log. */
const AuditLog = React.lazy(() => import('./AuditLog'));
/** SPEC-033: lazy load del visor de moderación del foro. */
const ForumModeration = React.lazy(() => import('./ForumModeration'));

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
                <div className="bg-status-bad/10 border border-status-bad/30 rounded-xl p-8 text-center">
                    <p className="text-status-bad font-semibold text-base mb-2">⚠️ Error en el componente</p>
                    <p className="text-text-secondary text-sm mb-5 font-mono">{this.state.error}</p>
                    <button
                        onClick={() => { this.setState({ hasError: false, error: '' }); this.props.onReset(); }}
                        className="px-5 py-2.5 bg-status-bad text-bg-base rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                        ← Volver al panel
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

type AdminTab = 'ARCHIVE' | 'LEADS' | 'FOUNDERS' | 'ANALYTICS' | 'AUDIT' | 'FORUM';

const LazyLoader = () => (
    <div className="flex items-center justify-center min-h-[400px] bg-bg-surface border border-white/[0.08] rounded-xl">
        <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="text-xs text-text-muted font-medium">
                Cargando módulo…
            </span>
        </div>
    </div>
);

// SPEC-075: helper para clases de botón del sidebar.
// Activo = bg-accent/10 + text-accent + border-accent/30.
// Inactivo = transparente + text-text-secondary + hover sutil.
// Unificado a accent teal (antes cada tab tenia su color: teal/amber/blue/
// purple/yellow/orange). El admin es de Carlos, identifica tabs por texto,
// no necesita 6 colores compitiendo en el sidebar.
const sidebarBtn = (active: boolean) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm border ${
        active
            ? 'bg-accent/10 text-accent border-accent/30'
            : 'bg-transparent text-text-secondary border-transparent hover:bg-white/[0.04] hover:text-text-primary'
    }`;

const AdminApp = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('ARCHIVE');
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
                <aside className="w-full lg:w-60 shrink-0 flex flex-col gap-1">
                    <button
                        onClick={() => setActiveTab('LEADS')}
                        className={sidebarBtn(activeTab === 'LEADS')}
                    >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        Gestión de leads
                    </button>

                    <button
                        onClick={() => setActiveTab('FOUNDERS')}
                        className={sidebarBtn(activeTab === 'FOUNDERS')}
                    >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0h-2m6-10a2 2 0 11-4 0 2 2 0 014 0zM6 7a2 2 0 11-4 0 2 2 0 014 0zm12 11a2 2 0 11-4 0 2 2 0 014 0zM6 17a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        Fundadores
                    </button>

                    <button
                        onClick={() => setActiveTab('ARCHIVE')}
                        className={sidebarBtn(activeTab === 'ARCHIVE')}
                    >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        Gestión de artículos
                    </button>

                    <div className="my-2 border-t border-white/[0.04]" />

                    <button
                        onClick={() => setActiveTab('ANALYTICS')}
                        className={sidebarBtn(activeTab === 'ANALYTICS')}
                    >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        Analítica IMR
                    </button>

                    <button
                        onClick={() => setActiveTab('AUDIT')}
                        className={sidebarBtn(activeTab === 'AUDIT')}
                    >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                        Audit log
                    </button>

                    <button
                        onClick={() => setActiveTab('FORUM')}
                        className={sidebarBtn(activeTab === 'FORUM')}
                    >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path></svg>
                        Moderación foro
                    </button>
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
                            {/* StatsGrid se oculta en ANALYTICS, AUDIT, FORUM y
                                FOUNDERS para evitar redundancia / saturación visual
                                (el tab Fundadores tiene su propio header con métricas). */}
                            {activeTab !== 'ANALYTICS' && activeTab !== 'AUDIT' && activeTab !== 'FORUM' && activeTab !== 'FOUNDERS' && <StatsGrid />}
                            <div className="flex-1 animate-fade-in-up">
                                {activeTab === 'LEADS' && <LeadList />}
                                {activeTab === 'FOUNDERS' && <FoundersList />}
                                {activeTab === 'ARCHIVE' && <PostList onEdit={handleEdit} onNew={handleNew} />}
                                {activeTab === 'ANALYTICS' && (
                                    <Suspense fallback={<LazyLoader />}>
                                        <AnaliticaIMR />
                                    </Suspense>
                                )}
                                {activeTab === 'AUDIT' && (
                                    <Suspense fallback={<LazyLoader />}>
                                        <AuditLog />
                                    </Suspense>
                                )}
                                {activeTab === 'FORUM' && (
                                    <Suspense fallback={<LazyLoader />}>
                                        <ForumModeration />
                                    </Suspense>
                                )}
                            </div>
                        </>
                    )}
                </ErrorBoundary>
            </main>
        </div>
    );
};

export default AdminApp;
