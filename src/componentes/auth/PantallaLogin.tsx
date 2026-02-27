import { useState, FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/contexto-auth';
import { UtensilsCrossed, LogIn, Eye, EyeOff } from 'lucide-react';

export default function PantallaLogin() {
    const { login, usuarioActual } = useAuth();
    const navigate = useNavigate();
    const [usuario, setUsuario] = useState('');
    const [password, setPassword] = useState('');
    const [mostrarPassword, setMostrarPassword] = useState(false);
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    // Si ya hay sesión activa, redirigir directo
    if (usuarioActual) {
        return <Navigate to="/" replace />;
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setCargando(true);

        setTimeout(() => {
            const resultado = login(usuario, password);
            if (resultado.exito) {
                navigate('/', { replace: true });
            } else {
                setError(resultado.error || 'Credenciales incorrectas');
                setCargando(false);
            }
        }, 300);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-800 rounded-2xl shadow-lg mb-4">
                        <UtensilsCrossed className="w-10 h-10 text-amber-100" />
                    </div>
                    <h1 className="text-3xl font-bold text-amber-900 font-serif">El Jardín</h1>
                    <p className="text-amber-700 text-sm mt-1">Sistema de Gestión</p>
                </div>

                {/* Card de Login */}
                <div className="bg-white rounded-2xl shadow-xl border border-amber-200 p-8">
                    <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
                        Iniciar Sesión
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Usuario */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                                Usuario
                            </label>
                            <input
                                type="text"
                                value={usuario}
                                onChange={e => setUsuario(e.target.value)}
                                placeholder="Ej: admin, cam1, cocina"
                                autoComplete="username"
                                required
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm transition"
                            />
                        </div>

                        {/* Contraseña */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    type={mostrarPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                    className="w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setMostrarPassword(!mostrarPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Botón */}
                        <button
                            type="submit"
                            disabled={cargando}
                            className="w-full bg-amber-800 hover:bg-amber-900 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
                        >
                            {cargando ? (
                                <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
                            ) : (
                                <LogIn className="w-4 h-4" />
                            )}
                            {cargando ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-amber-700/60 mt-6">
                    Restaurante El Jardín · Sistema Interno
                </p>
            </div>
        </div>
    );
}
