import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [adminCode, setAdminCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        try {
            // 1. Verificar identidad con Firebase Auth
            await signInWithEmailAndPassword(auth, email, password);
            
            // 2. El código de administrador se guarda en la cookie para que el servidor valide
            document.cookie = `admin_session=${encodeURIComponent(adminCode)}; path=/; max-age=86400`;
            window.location.href = '/admin/dashboard';
        } catch (error: any) {
            console.error('Login error:', error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                setErrorMsg('Credenciales de Firebase inválidas.');
            } else if (error.code === 'auth/user-not-found') {
                setErrorMsg('Este correo no está registrado.');
            } else {
                setErrorMsg('Error de autenticación. Intenta de nuevo.');
            }
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
                <p className="text-xs text-gray-500 font-mono mt-2 uppercase tracking-widest">Doble Factor Requerido</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
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
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Contraseña Firebase</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••••••"
                        className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-center tracking-widest focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-[#00C49A] uppercase tracking-widest mb-2">
                        <span className="flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                            Código de Acceso Admin
                        </span>
                    </label>
                    <input
                        type="password"
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        required
                        placeholder="Código secreto"
                        className="w-full bg-black border border-[#00C49A]/30 rounded-lg px-4 py-3 text-[#00C49A] font-mono text-center tracking-widest focus:outline-none focus:border-[#00C49A] transition-colors"
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
