import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // If the user lands here but is already authenticated in Firebase,
        // redirect them automatically if the cookie isn't set, or set the cookie and redirect.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // Ensure the Astro cookie exists so the SSR doesn't block them
                document.cookie = "admin_session=firebase_auth; path=/; max-age=86400";
                window.location.href = '/admin/dashboard';
            }
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // On success, Firebase Auth saves the session in IndexedDB.
            // We set a frontend cookie so Astro's SSR allows access to the dashboard HTML.
            document.cookie = "admin_session=firebase_auth; path=/; max-age=86400";
            window.location.href = '/admin/dashboard';
        } catch (error: any) {
            console.error('Login error:', error);
            setErrorMsg('Credenciales inválidas o usuario sin permisos.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md w-full bg-gray-900 border border-blue-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-12 -top-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>

            <div className="flex flex-col items-center mb-8">
                <span className="text-4xl mb-4">🛡️</span>
                <h1 className="text-2xl font-black text-white uppercase tracking-widest text-center">Protocolo de<br /><span className="text-blue-500">Autorización</span></h1>
                <p className="text-xs text-gray-500 font-mono mt-2 uppercase tracking-widest">Firebase Identity Required</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Correo de Administrador</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                        placeholder="admin@metamorfosis.com"
                        className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-center tracking-widest focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Clave de Acceso</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••••••"
                        className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-blue-500 font-mono text-center tracking-widest focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>

                {errorMsg && (
                    <p className="text-red-500 text-xs text-center animate-pulse">{errorMsg}</p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-black uppercase tracking-widest rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.2)] transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Autenticando...
                        </>
                    ) : (
                        'Desbloquear Sistema'
                    )}
                </button>
            </form>
        </div>
    );
};

export default AdminLogin;
