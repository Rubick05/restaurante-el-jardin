import { UsuarioApp } from './tipos-auth';

// Usuarios del sistema — el administrador puede gestionar estos datos desde el panel
// Formato: { id, nombre, usuario, password (texto plano para MVP), rol }
interface UsuarioSistema extends UsuarioApp {
    password: string;
}

export const USUARIOS_SISTEMA: UsuarioSistema[] = [
    {
        id: 'admin-01',
        nombre: 'Administrador',
        usuario: 'admin',
        password: 'admin123',
        rol: 'administrador',
    },
    {
        id: 'cocina-01',
        nombre: 'Cocina',
        usuario: 'cocina',
        password: 'cocina123',
        rol: 'cocinero',
    },
    {
        id: 'cam-01',
        nombre: 'Camarero 1',
        usuario: 'cam1',
        password: 'cam123',
        rol: 'camarero',
    },
    {
        id: 'cam-02',
        nombre: 'Camarero 2',
        usuario: 'cam2',
        password: 'cam456',
        rol: 'camarero',
    },
];

/**
 * Verifica credenciales y retorna el usuario (sin password) si son válidas.
 */
export function autenticarUsuario(usuario: string, password: string): UsuarioApp | null {
    const encontrado = USUARIOS_SISTEMA.find(
        u => u.usuario === usuario.trim().toLowerCase() && u.password === password
    );
    if (!encontrado) return null;
    const { password: _pw, ...usuarioSinPassword } = encontrado;
    return usuarioSinPassword;
}
