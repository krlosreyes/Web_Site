import React, { useState } from 'react';
import PromptGenerator from './PromptGenerator';
import StatsGrid from './StatsGrid';
import PostList from './PostList';
import LeadList from './LeadList';
import ManualPostInjection from './ManualPostInjection';

const AdminApp = () => {
    const [activeTab, setActiveTab] = useState<'INJECTOR' | 'ARCHIVE' | 'LEADS'>('INJECTOR');

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-8rem)]">
            {/* Sidebar Navigation */}
            <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-2">
                <button
                    onClick={() => setActiveTab('INJECTOR')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm border ${activeTab === 'INJECTOR'
                        ? 'bg-[#00C49A]/10 text-[#00C49A] border-[#00C49A]/30 shadow-[0_0_15px_rgba(0,196,154,0.1)]'
                        : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-800/50 hover:text-white'
                        }`}
                >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                    Inyección Manual (JSON)
                </button>

                <button
                    onClick={() => setActiveTab('ARCHIVE')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm border ${activeTab === 'ARCHIVE'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                        : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-800/50 hover:text-white'
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    Archivo de Posts
                </button>

                <button
                    onClick={() => setActiveTab('LEADS')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm border ${activeTab === 'LEADS'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                        : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-800/50 hover:text-white'
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    Gestión de Leads
                </button>

                {/* Enlace estático a la página separada de analíticas */}
                <a
                    href="/admin/analitica-imx"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm border bg-transparent text-gray-500 border-transparent hover:bg-gray-800/50 hover:text-white mt-4 relative group"
                >
                    <div className="absolute inset-0 bg-[#00C49A]/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-md"></div>
                    <svg className="w-5 h-5 relative z-10 text-[#00C49A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                    <span className="relative z-10">Analítica IMX →</span>
                </a>

            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 flex flex-col gap-8">
                <StatsGrid />

                <div className="flex-1 animate-fade-in-up">
                    {activeTab === 'INJECTOR' && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full">
                            <div className="h-[700px] xl:h-[800px]">
                                <PromptGenerator />
                            </div>
                            <div className="h-[700px] xl:h-[800px]">
                                <ManualPostInjection />
                            </div>
                        </div>
                    )}
                    {activeTab === 'ARCHIVE' && (
                        <div className="min-h-[600px] h-full w-full">
                            <PostList />
                        </div>
                    )}
                    {activeTab === 'LEADS' && (
                        <div className="min-h-[600px] h-full w-full">
                            <LeadList />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminApp;
