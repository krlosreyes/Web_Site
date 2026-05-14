import React, { useState } from 'react';

/**
 * Form de acceso al panel admin.
 *
 * Single-factor: solo `ADMIN_PASSWORD`. El componente delega TODO al endpoint
 * `POST /api/admin/login.ts`, que valida con constant-time, aplica rate limit
 * y emite la cookie HttpOnly+Secure+SameSite=Strict. El cliente no setea
 * cookies por su cuenta y no usa Firebase Auth.
 *
 * Antes este componente hacía Firebase signInWithEmailAndPassword + setear
 * `document.cookie` directo con el código admin. Ese flow:
 *   - bypassaba el rate limiting del servidor,
 *   - producía cookies sin HttpOnly (lectura JS expuesta),
 *   - pretendía "doble factor" pero la única validación server-side era el
 *     código admin, así que el factor Firebase no aportaba seguridad real.
 * Ver specs/SPEC-003-admin-auth-contract.md.
 */
const AdminLogin: React.FC = () => {
    const [adminCode, setAdminCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password: adminCode }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                if (res.status === 429) {
                    setErrorMsg(
                        data.error ||
                            'Demasiados intentos. Espera un minuto e intenta de nuevo.'
                    );
                } else if (res.status === 401) {
                    setErrorMsg('Código de acceso inválido.');
                } else if (res.status === 400) {
                    setErrorMsg(data.error || 'Solicitud inválida.');
                } else {
                    setErrorMsg(data.error || 'Error de autenticación.');
                }
                return;
            }

            // El servidor ya seteó la cookie HttpOnly via Set-Cookie.
            window.location.href = data.redirect || '/admin/dashboard';
        } catch (err) {
            console.error('Login error:', err);
            setErrorMsg('Error de red. Intentá de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md w-full bg-gray-900 border border-blue-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-12 -top-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>

            <div className="flex flex-col items-center mb-8">
                <span className="text-4xl mb-4">🛡️</span>
                <h1 className="text-2xl font-black text-white uppercase tracking-widest text-center">
                    Acceso<br />
                    <span className="text-blue-500">Admin</span>
                </h1>
                <p className="text-xs text-gray-500 font-mono mt-2 uppercase tracking-widest">
                    Código de Acceso Requerido
                </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
                <div>
                    <label className="block text-xs font-bold text-[#00C49A] uppercase tracking-widest mb-2">
                        <span className="flex items-center gap-2">
                            <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="3"
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                            Código de Acceso
                        </span>
                    </label>
                    <input
                        type="password"
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        required
                        autoFocus
                        placeholder="••••••••••••"
                        minLength={8}
                        className="w-full bg-black border border-[#00C49A]/30 rounded-lg px-4 py-3 text-[#00C49A] font-mono text-center tracking-widest focus:outline-none focus:border-[#00C49A] transition-colors"
                    />
                </div>

                {errorMsg && (
                    <p className="text-red-500 text-xs text-center">{errorMsg}</p>
                )}

                <button
                    type="submit"
                    disabled={isLoading || adminCode.length < 8}
                    className="w-full py-3 bg-accent hover:bg-accent-strong disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.2)] transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
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
