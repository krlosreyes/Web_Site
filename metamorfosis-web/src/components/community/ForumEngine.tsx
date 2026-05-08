import React, { useState, useMemo, useEffect } from 'react';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Iconos SVG Personalizados
const Icon = ({ d, size = 20, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d={d} />
    </svg>
);

const Icons = {
    Search: (props) => <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" {...props} />,
    Message: (props) => <Icon d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" {...props} />,
    Trending: (props) => <Icon d="M23 6l-9.5 9.5-5-5L1 18" {...props} />,
    Users: (props) => <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" {...props} />,
    ChevronRight: (props) => <Icon d="M9 5l7 7-7 7" {...props} />,
    ChevronLeft: (props) => <Icon d="M15 19l-7-7 7-7" {...props} />,
    Award: (props) => <Icon d="M12 15l-2 5L9 9l11 4-5 2zm0 0l4 8" {...props} />,
    Timer: (props) => <Icon d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" {...props} />,
    Zap: (props) => <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" {...props} />,
    Heart: (props) => <Icon d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" {...props} />,
    Brain: (props) => <Icon d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-5 0V11" {...props} />,
    Send: (props) => <Icon d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" {...props} />,
    Lock: (props) => <Icon d="M7 11V7a5 5 0 0110 0v4M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z" {...props} />,
    Check: (props) => <Icon d="M20 6L9 17l-5-5" {...props} />
};

interface Topic {
    id: string;
    title: string;
    author: string;
    content: string;
    category: string;
    replies: number;
    views: number;
    likes: number;
    tags: string[];
    isHot: boolean;
    createdAt: string;
}

const INITIAL_TOPICS: Topic[] = [
    {
        id: '1',
        title: "¿Cómo romper el ayuno de 24h sin pico de insulina?",
        author: "Carlos Reyes",
        content: "He probado con caldo de huesos, pero me pregunto si el aguacate es mejor opción para mantener la cetosis...",
        category: 'ayuno',
        replies: 45, views: 1200, likes: 156,
        tags: ["Ayuno", "Insulina"],
        isHot: true,
        createdAt: '2h'
    },
    {
        id: '2',
        title: "Protocolo de Hidratación con Agua de Mar: Resultados día 5",
        author: "Elena Bio",
        content: "Los calambres han desaparecido por completo. Mi energía por la mañana es mucho más estable.",
        category: 'bio',
        replies: 28, views: 850, likes: 92,
        tags: ["Hidratación", "Minerales"],
        isHot: false,
        createdAt: '5h'
    },
    {
        id: '3',
        title: "Masa Muscular y Longevidad: ¿Es posible ganar músculo a los 50?",
        author: "Dr. Mendoza",
        content: "La sarcopenia es el mayor enemigo de la longevidad. Aquí les comparto mi protocolo de aminoácidos...",
        category: 'longevity',
        replies: 62, views: 2300, likes: 412,
        tags: ["Músculo", "Longevidad"],
        isHot: true,
        createdAt: '1d'
    }
];

const ForumEngine = () => {
    const [topics, setTopics] = useState<Topic[]>(INITIAL_TOPICS);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('todos');
    const [isCreating, setIsCreating] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
    const [newTopic, setNewTopic] = useState({ title: '', content: '', category: 'bio' });

    // Estados de Validación
    const [userName, setUserName] = useState<string | null>(null);
    const [hasIMR, setHasIMR] = useState(false);
    const [hasReadArticle, setHasReadArticle] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            // Priorizamos el nombre de la sesión del dashboard para fluidez
            const storedName = sessionStorage.getItem('imr_userName');
            setUserName(u?.displayName || storedName);
            
            setHasIMR(!!sessionStorage.getItem('imr_score'));
            setHasReadArticle(localStorage.getItem('imr_article_read') === 'true');
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const isFullyAuthorized = userName && (hasIMR || hasReadArticle);

    const filteredTopics = useMemo(() => {
        return topics.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                                 t.content.toLowerCase().includes(search.toLowerCase());
            const matchesCategory = activeCategory === 'todos' || t.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [search, activeCategory, topics]);

    const handleCreateTopic = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTopic.title || !newTopic.content) return;
        const topic: Topic = {
            id: Date.now().toString(),
            title: newTopic.title,
            author: userName || "Biohacker",
            content: newTopic.content,
            category: newTopic.category,
            replies: 0, views: 0, likes: 0,
            tags: [newTopic.category.toUpperCase()],
            isHot: false,
            createdAt: 'Ahora mismo'
        };
        setTopics([topic, ...topics]);
        setIsCreating(false);
        setNewTopic({ title: '', content: '', category: 'bio' });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
                <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Validando Autoridad Biológica...</p>
            </div>
        );
    }

    // VISTA DE BLOQUEO (GATEKEEPER)
    if (!isFullyAuthorized) {
        return (
            <div className="max-w-4xl mx-auto mt-12 bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[300px] bg-blue-600/10 blur-[120px] -z-10"></div>
                
                <div className="w-20 h-20 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                    <Icons.Lock size={32} className="text-blue-400" />
                </div>
                
                <h2 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter mb-6 leading-tight">
                    Casi llegas a <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#00C49A]">La Tribu</span>
                </h2>
                <p className="text-gray-400 text-base max-w-xl mx-auto mb-12 font-medium">
                    Para interactuar con la comunidad, necesitamos confirmar tu compromiso con el protocolo. Sigue estos pasos para habilitar tu voz en La Tribu Biohacker.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                    {/* Requisito 1: Usuario Activo */}
                    <div className={`p-6 rounded-2xl border transition-all ${userName ? 'bg-blue-600/10 border-blue-500/50' : 'bg-white/5 border-white/10 opacity-50'}`}>
                        <div className="flex justify-center mb-4">
                            {userName ? <Icons.Check className="text-blue-400" /> : <Icons.Users className="text-gray-600" />}
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1">Identidad Activa</h4>
                        <p className="text-[10px] text-gray-500 uppercase font-black">{userName ? 'Listo' : 'Pendiente'}</p>
                        {!userName && <a href="/login" className="mt-4 inline-block text-[10px] text-blue-400 border-b border-blue-400/30">Identifícate</a>}
                    </div>

                    {/* Requisito 2: IMR Calculado */}
                    <div className={`p-6 rounded-2xl border transition-all ${hasIMR ? 'bg-blue-600/10 border-blue-500/50' : 'bg-white/5 border-white/10 opacity-50'}`}>
                        <div className="flex justify-center mb-4">
                            {hasIMR ? <Icons.Check className="text-blue-400" /> : <Icons.Zap className="text-gray-600" />}
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1">Diagnóstico IMR</h4>
                        <p className="text-[10px] text-gray-500 uppercase font-black">{hasIMR ? 'Listo' : 'Pendiente'}</p>
                        {!hasIMR && <a href="/quiz" className="mt-4 inline-block text-[10px] text-blue-400 border-b border-blue-400/30">Empezar Quiz</a>}
                    </div>

                    {/* Requisito 3: Artículo Leído */}
                    <div className={`p-6 rounded-2xl border transition-all ${hasReadArticle ? 'bg-blue-600/10 border-blue-500/50' : 'bg-white/5 border-white/10 opacity-50'}`}>
                        <div className="flex justify-center mb-4">
                            {hasReadArticle ? <Icons.Check className="text-blue-400" /> : <Icons.Message className="text-gray-600" />}
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1">Teoría Aplicada</h4>
                        <p className="text-[10px] text-gray-500 uppercase font-black">{hasReadArticle ? 'Listo' : 'Pendiente'}</p>
                        {!hasReadArticle && <a href="/biblioteca" className="mt-4 inline-block text-[10px] text-blue-400 border-b border-blue-400/30">Ir a Biblioteca</a>}
                    </div>
                </div>
            </div>
        );
    }

    if (selectedTopic) {
        return (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <button onClick={() => setSelectedTopic(null)} className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 font-bold text-xs uppercase tracking-widest transition-colors">
                    <Icons.ChevronLeft size={16} /> Volver a La Tribu
                </button>
                
                <div className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px]"></div>
                    <div className="flex items-center gap-4 mb-8">
                         <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold uppercase">
                            {selectedTopic.author[0]}
                         </div>
                         <div>
                            <h4 className="text-white font-bold">{selectedTopic.author}</h4>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Biohacker Verificado • Hace {selectedTopic.createdAt}</p>
                         </div>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter mb-8 leading-tight">{selectedTopic.title}</h2>
                    <p className="text-gray-300 text-xl leading-relaxed font-medium mb-12">{selectedTopic.content}</p>
                    
                    <div className="border-t border-white/5 pt-10">
                        <div className="flex items-center justify-between mb-8">
                            <h5 className="text-xs font-black text-blue-400 uppercase tracking-widest">Respuestas ({selectedTopic.replies})</h5>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex gap-4">
                            <textarea placeholder="Comparte tu experiencia..." className="flex-1 bg-transparent border-none outline-none text-white text-sm resize-none" rows={2} />
                            <button className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                                <Icons.Send size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">
            <aside className="lg:col-span-3 space-y-6">
                {/* BOTÓN DE RETORNO AL DASHBOARD */}
                <a href="/dashboard" className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group shadow-lg">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                        <Icons.ChevronLeft size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Panel de Control</p>
                        <p className="text-xs text-white font-bold uppercase">Volver al Perfil</p>
                    </div>
                </a>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 px-2">Categorías</h3>
                    <div className="space-y-1">
                        {[
                            { id: 'todos', name: 'La Tribu', icon: <Icons.Users size={16} /> },
                            { id: 'ayuno', name: 'Ayuno', icon: <Icons.Timer size={16} /> },
                            { id: 'bio', name: 'Biohacking', icon: <Icons.Zap size={16} /> },
                            { id: 'longevity', name: 'Longevidad', icon: <Icons.Heart size={16} /> },
                            { id: 'mind', name: 'Cerebro', icon: <Icons.Brain size={16} /> }
                        ].map(cat => (
                            <button 
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${activeCategory === cat.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:bg-white/5'}`}
                            >
                                <span className="flex items-center gap-3 font-bold text-sm">
                                    {cat.icon}
                                    {cat.name}
                                </span>
                                <Icons.ChevronRight size={14} className={activeCategory === cat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} />
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            <section className="lg:col-span-9 space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/[0.02] p-4 rounded-[2rem] border border-white/5 backdrop-blur-xl">
                    <div className="relative flex-1 w-full">
                        <Icons.Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar en La Tribu..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-blue-500/50 transition-all text-sm font-medium"
                        />
                    </div>
                    <button 
                        onClick={() => setIsCreating(true)}
                        className="w-full md:w-auto bg-[#00C49A] text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.03] transition-all shadow-xl shadow-[#00C49A]/20"
                    >
                        + Nuevo Tema
                    </button>
                </div>

                {isCreating && (
                    <div className="bg-blue-600/5 border border-blue-500/20 p-10 rounded-[2.5rem] mb-6">
                        <form onSubmit={handleCreateTopic} className="space-y-6">
                            <input placeholder="Título del tema..." className="w-full bg-black/40 border border-white/10 rounded-xl p-5 text-white font-bold outline-none focus:border-blue-500" value={newTopic.title} onChange={e => setNewTopic({...newTopic, title: e.target.value})} />
                            <textarea placeholder="Comparte tu conocimiento o duda..." className="w-full bg-black/40 border border-white/10 rounded-xl p-5 text-gray-300 text-sm outline-none focus:border-blue-500 min-h-[150px]" value={newTopic.content} onChange={e => setNewTopic({...newTopic, content: e.target.value})} />
                            <div className="flex justify-end gap-6 items-center">
                                <button type="button" onClick={() => setIsCreating(false)} className="text-[10px] text-gray-500 font-black uppercase">Cancelar</button>
                                <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">Publicar en La Tribu</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="space-y-4">
                    {filteredTopics.map(topic => (
                        <div key={topic.id} onClick={() => setSelectedTopic(topic)} className="group bg-white/[0.02] border border-white/5 p-8 rounded-[2rem] hover:bg-white/[0.05] hover:border-blue-500/30 transition-all cursor-pointer relative overflow-hidden">
                            {topic.isHot && <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-600 to-[#00C49A]"></div>}
                            <div className="flex justify-between items-start gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-4">
                                        {topic.tags.map(tag => (
                                            <span key={tag} className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 bg-blue-400/5 px-2.5 py-1 rounded border border-blue-400/10">{tag}</span>
                                        ))}
                                        <span className="text-[10px] text-gray-500 font-bold">Hace {topic.createdAt}</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-3 group-hover:text-blue-400 transition-colors leading-tight italic uppercase tracking-tighter">{topic.title}</h3>
                                    <p className="text-gray-500 text-base line-clamp-2 mb-6 font-medium leading-relaxed">{topic.content}</p>
                                    
                                    <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.1em] text-gray-600 group-hover:text-gray-400 transition-colors">
                                        <span className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-gray-800 border border-white/10 overflow-hidden"><img src={`https://i.pravatar.cc/100?u=${topic.author}`} /></div> {topic.author}</span>
                                        <span className="flex items-center gap-1.5"><Icons.Message size={14} className="text-blue-600" /> {topic.replies}</span>
                                        <span className="flex items-center gap-1.5"><Icons.Trending size={14} className="text-[#00C49A]" /> {topic.likes}</span>
                                    </div>
                                </div>
                                <Icons.ChevronRight size={32} className="text-gray-800 group-hover:text-blue-500 transition-all" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default ForumEngine;
