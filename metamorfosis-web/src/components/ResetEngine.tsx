
import React, { useState, useEffect } from 'react';
import ManualFase0 from './ManualFase0';
import BioDashboard from './BioDashboard';

interface UserState {
    name: string;
    currentDay: number;
    completedDays: number[];
}

export default function ResetEngine() {
    const [activeTab, setActiveTab] = useState<'manual' | 'dashboard' | 'onboarding'>('onboarding');
    const [userState, setUserState] = useState<UserState>({
        name: '',
        currentDay: 1,
        completedDays: []
    });
    const [loading, setLoading] = useState(true);

    // Load state from LocalStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('metamorfosis_7d_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            setUserState(parsed);
            setActiveTab(parsed.name ? 'manual' : 'onboarding');
        } else {
            setActiveTab('onboarding');
        }
        setLoading(false);
    }, []);

    // Save state whenever it changes
    useEffect(() => {
        if (!loading && userState.name) {
            localStorage.setItem('metamorfosis_7d_state', JSON.stringify(userState));
        }
    }, [userState, loading]);

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const input = (document.getElementById('userNameInput') as HTMLInputElement).value;
        if (input.trim()) {
            setUserState(prev => ({ ...prev, name: input.trim() }));
            setActiveTab('manual');
        }
    };

    const handleCheckDay = (day: number) => {
        setUserState(prev => {
            const nextDay = day < 7 ? day + 1 : prev.currentDay;
            const newCompleted = [...prev.completedDays, day];
            return {
                ...prev,
                currentDay: nextDay,
                completedDays: newCompleted
            };
        });
        // Scroll to top to see feedback
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) return null;

    if (activeTab === 'onboarding') {
        return (
            <div className="min-h-[60vh] flex items-center justify-center p-4">
                <form onSubmit={handleNameSubmit} className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl animate-fade-in-up">
                    <div className="text-center mb-8">
                        <span className="text-4xl mb-4 block">🧬</span>
                        <h2 className="text-2xl font-bold text-white mb-2">Identificación Requerida</h2>
                        <p className="text-gray-400">Para iniciar el protocolo de reinicio, ingresa tu nombre.</p>
                    </div>
                    <input
                        id="userNameInput"
                        type="text"
                        placeholder="Tu Nombre..."
                        className="w-full bg-black border border-gray-700 rounded-xl px-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-[#00C49A] mb-6 text-center text-lg"
                        autoFocus
                    />
                    <button
                        type="submit"
                        className="w-full py-4 bg-[#00C49A] hover:bg-[#00a380] text-gray-900 font-black text-lg rounded-xl shadow-[0_0_15px_rgba(0,196,154,0.4)] transition-all transform hover:scale-[1.02]"
                    >
                        INICIAR SISTEMA
                    </button>
                </form>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* Navigation Tabs */}
            <div className="flex bg-gray-900/50 p-1 rounded-xl mb-8 border border-gray-800 backdrop-blur-sm sticky top-4 z-50 shadow-xl">
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'manual' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Manual Fase 0
                </button>
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-[#00C49A] text-gray-900 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Dashboard 7D
                </button>
            </div>

            {/* Content Area */}
            <div className="min-h-[50vh]">
                {activeTab === 'manual' && <ManualFase0 />}
                {activeTab === 'dashboard' && (
                    <BioDashboard
                        currentDay={userState.currentDay}
                        completedDays={userState.completedDays}
                        userName={userState.name}
                        onCheckDay={handleCheckDay}
                    />
                )}
            </div>
        </div>
    );
}
