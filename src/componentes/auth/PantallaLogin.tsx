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

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setCargando(true);

        const resultado = await login(usuario, password);
        if (resultado.exito) {
            navigate('/', { replace: true });
        } else {
            setError(resultado.error || 'Credenciales incorrectas');
            setCargando(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient lighting effect */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-sm relative z-10">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 border border-primary/20 rounded-2xl shadow-lg mb-4 glow-gold">
                        <UtensilsCrossed className="w-10 h-10 text-primary text-glow-gold" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground font-serif tracking-wide">El Jardín</h1>
                    <p className="text-muted-foreground text-sm mt-1">Sistema de Gestión</p>
                </div>

                {/* Card de Login */}
                <div className="bg-card rounded-2xl shadow-2xl border border-border/80 p-8 glow-gold">
                    <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
                        Iniciar Sesión
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Usuario */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Usuario
                            </label>
                            <input
                                type="text"
                                value={usuario}
                                onChange={e => setUsuario(e.target.value)}
                                placeholder="Ej: admin, cam1, cocina"
                                autoComplete="username"
                                required
                                className="w-full px-4 py-2.5 rounded-lg bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition"
                            />
                        </div>

                        {/* Contraseña */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                                    className="w-full px-4 py-2.5 pr-10 rounded-lg bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setMostrarPassword(!mostrarPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-2.5 rounded-lg animate-in fade-in slide-in-from-top-1">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Botón */}
                        <button
                            type="submit"
                            disabled={cargando}
                            className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-[0.99] transition-transform"
                        >
                            {cargando ? (
                                <span className="animate-spin border-2 border-primary-foreground border-t-transparent rounded-full w-4 h-4" />
                            ) : (
                                <LogIn className="w-4 h-4" />
                            )}
                            {cargando ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-muted-foreground/30 mt-6">
                    Restaurante El Jardín · Sistema Interno
                </p>
            </div>
        </div>
    );
}
