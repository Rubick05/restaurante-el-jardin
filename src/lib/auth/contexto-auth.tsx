import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UsuarioApp } from '@/lib/auth/tipos-auth';
import { autenticarUsuario } from '@/lib/auth/usuarios';

const CLAVE_SESION = 'restaurante_sesion_usuario';

interface ContextoAuthType {
    usuarioActual: UsuarioApp | null;
    login: (usuario: string, password: string) => { exito: boolean; error?: string };
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

    const login = (usuario: string, password: string): { exito: boolean; error?: string } => {
        const encontrado = autenticarUsuario(usuario, password);
        if (!encontrado) {
            return { exito: false, error: 'Usuario o contraseña incorrectos' };
        }
        setUsuarioActual(encontrado);
        localStorage.setItem(CLAVE_SESION, JSON.stringify(encontrado));
        return { exito: true };
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
