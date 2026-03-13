import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UsuarioApp } from '@/lib/auth/tipos-auth';
import { api } from '@/lib/api/cliente';

const CLAVE_SESION = 'restaurante_sesion_usuario';

interface ContextoAuthType {
    usuarioActual: UsuarioApp | null;
    login: (usuario: string, password: string) => Promise<{ exito: boolean; error?: string }>;
    logout: () => void;
    cargando: boolean;
}

const ContextoAuth = createContext<ContextoAuthType | null>(null);

export function ProveedorAuth({ children }: { children: ReactNode }) {
    const [usuarioActual, setUsuarioActual] = useState<UsuarioApp | null>(null);
    const [cargando, setCargando] = useState(true);

    // Restaurar sesión al cargar la app
    useEffect(() => {
        try {
            const sesionGuardada = localStorage.getItem(CLAVE_SESION);
            if (sesionGuardada) {
                const usuario = JSON.parse(sesionGuardada) as UsuarioApp;
                setUsuarioActual(usuario);
            }
        } catch {
            localStorage.removeItem(CLAVE_SESION);
        } finally {
            setCargando(false);
        }
    }, []);

    const login = async (usuario: string, password: string): Promise<{ exito: boolean; error?: string }> => {
        try {
            const res: any = await api.post('/usuarios/login', { usuario, password });

            if (res.ok && res.usuario) {
                setUsuarioActual(res.usuario);
                localStorage.setItem(CLAVE_SESION, JSON.stringify(res.usuario));
                return { exito: true };
            }
            return { exito: false, error: 'Usuario o contraseña incorrectos' };
        } catch (error: any) {
            return { exito: false, error: error.message || 'Error de conexión' };
        }
    };

    const logout = () => {
        setUsuarioActual(null);
        localStorage.removeItem(CLAVE_SESION);
    };

    return (
        <ContextoAuth.Provider value={{ usuarioActual, login, logout, cargando }}>
            {children}
        </ContextoAuth.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(ContextoAuth);
    if (!ctx) throw new Error('useAuth debe usarse dentro de ProveedorAuth');
    return ctx;
}
