export type RolUsuario = 'administrador' | 'cocinero' | 'camarero';

export interface UsuarioApp {
    id: string;
    nombre: string;
    usuario: string;
    rol: RolUsuario;
}
