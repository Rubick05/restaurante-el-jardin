import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/cliente';
import { Button } from '@/componentes/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/componentes/ui/card';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Users, UserPlus, KeyRound, Trash2, Pencil, Eye, EyeOff } from 'lucide-react';

interface Usuario {
    id: string;
    nombre: string;
    usuario: string;
    password?: string;
    rol: string;
    creado_en: string;
}

export default function GestionUsuarios() {
    const queryClient = useQueryClient();

    const [modalAbierto, setModalAbierto] = useState(false);
    const [editando, setEditando] = useState<Usuario | null>(null);

    // Form fields
    const [nombre, setNombre] = useState('');
    const [usuario, setUsuario] = useState('');
    const [password, setPassword] = useState('');
    const [rol, setRol] = useState('camarero');
    const [errorForm, setErrorForm] = useState('');

    // Estado para ver/ocultar contraseñas
    const [mostrarPasswords, setMostrarPasswords] = useState<Record<string, boolean>>({});
    const [mostrarPasswordModal, setMostrarPasswordModal] = useState(false);

    const toggleMostrarPassword = (id: string) => {
        setMostrarPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
        queryKey: ['usuarios'],
        queryFn: () => api.get('/usuarios')
    });

    const mutarGuardar = useMutation({
        mutationFn: async (datos: any) => {
            if (editando) {
                // Solo enviamos password si se llenó
                const payload = { ...datos };
                if (!payload.password) delete payload.password;
                return api.put(`/usuarios/${editando.id}`, payload);
            }
            return api.post('/usuarios', datos);
        },
        onSuccess: (res: any) => {
            if (res?.error) throw new Error(res.error);
            queryClient.invalidateQueries({ queryKey: ['usuarios'] });
            cerrarModal();
        },
        onError: (err: any) => {
            setErrorForm(err.message || 'Error al guardar usuario');
        }
    });

    const mutarEliminar = useMutation({
        mutationFn: (id: string) => api.delete(`/usuarios/${id}`),
        onSuccess: (res: any) => {
            if (res?.error) throw new Error(res.error);
            queryClient.invalidateQueries({ queryKey: ['usuarios'] });
        },
        onError: (err: any) => {
            alert(err.message || 'Error al eliminar usuario');
        }
    });

    const abrirModal = (usr?: Usuario) => {
        if (usr) {
            setEditando(usr);
            setNombre(usr.nombre);
            setUsuario(usr.usuario);
            setRol(usr.rol);
            setPassword(usr.password || '');
        } else {
            setEditando(null);
            setNombre('');
            setUsuario('');
            setRol('camarero');
            setPassword('');
        }
        setMostrarPasswordModal(false);
        setErrorForm('');
        setModalAbierto(true);
    };

    const cerrarModal = () => {
        setModalAbierto(false);
        setEditando(null);
        setMostrarPasswordModal(false);
    };

    const handleGuardar = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorForm('');
        if (!editando && !password) {
            setErrorForm('El password es requerido para nuevos usuarios');
            return;
        }
        mutarGuardar.mutate({ nombre, usuario, password, rol });
    };

    const handleEliminar = (id: string, nombreUser: string) => {
        if (confirm(`¿Estás seguro de eliminar permanentemente al usuario "${nombreUser}"?`)) {
            mutarEliminar.mutate(id);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando usuarios...</div>;

    return (
        <div className="space-y-6 p-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" />
                    Gestión de Usuarios
                </h2>
                <Button onClick={() => abrirModal()} className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    Nuevo Usuario
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {usuarios.map(u => (
                    <Card key={u.id} className="relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${u.rol === 'administrador' ? 'bg-amber-600' :
                                u.rol === 'cocinero' ? 'bg-orange-500' : 'bg-green-600'
                            }`} />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex justify-between items-start">
                                <span>{u.nombre}</span>
                                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border">
                                    {u.rol === 'camarero' ? 'mesero' : u.rol}
                                </span>
                            </CardTitle>
                            <CardDescription className="text-sm">
                                @{u.usuario}
                            </CardDescription>

                            {/* Mostrar contraseña con opción de revelar */}
                            <div className="flex items-center justify-between text-xs bg-muted/40 p-2 rounded-lg border border-border/60 mt-2">
                                <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                                    <KeyRound className="w-3.5 h-3.5 text-primary" /> Clave:
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-foreground tracking-wider">
                                        {mostrarPasswords[u.id] ? (u.password || '(sin clave)') : '••••••••'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleMostrarPassword(u.id);
                                        }}
                                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                                        title={mostrarPasswords[u.id] ? "Ocultar contraseña" : "Ver contraseña"}
                                    >
                                        {mostrarPasswords[u.id] ? (
                                            <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                                        ) : (
                                            <Eye className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2 flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => abrirModal(u)}>
                                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => handleEliminar(u.id, u.nombre)}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Modal */}
            {modalAbierto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
                    <form onSubmit={handleGuardar} className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-md overflow-hidden glow-gold">
                        <div className="p-5 border-b border-border">
                            <h3 className="text-lg font-bold font-serif text-primary text-glow-gold">
                                {editando ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h3>
                        </div>

                        <div className="p-5 space-y-4">
                            {errorForm && (
                                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
                                    {errorForm}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="nombre" className="text-muted-foreground text-xs uppercase tracking-wider">Nombre y Apellido</Label>
                                <Input
                                    id="nombre"
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                    required
                                    className="bg-muted/30 border-border text-foreground focus:ring-primary"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="usr" className="text-muted-foreground text-xs uppercase tracking-wider">Username</Label>
                                    <Input
                                        id="usr"
                                        value={usuario}
                                        onChange={e => setUsuario(e.target.value)}
                                        required
                                        className="bg-muted/30 border-border text-foreground focus:ring-primary"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="rol" className="text-muted-foreground text-xs uppercase tracking-wider">Rol</Label>
                                    <select
                                        id="rol"
                                        className="flex h-10 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                                        value={rol}
                                        onChange={e => setRol(e.target.value)}
                                        required
                                    >
                                        <option value="camarero" className="bg-card text-foreground">Mesero</option>
                                        <option value="cocinero" className="bg-card text-foreground">Cocina</option>
                                        <option value="administrador" className="bg-card text-foreground">Administrador</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-border">
                                <Label htmlFor="pass" className="flex items-center justify-between text-primary text-xs uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5">
                                        <KeyRound className="w-3.5 h-3.5 text-primary" />
                                        Contraseña {editando && '(Visible / modificable)'}
                                    </span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="pass"
                                        type={mostrarPasswordModal ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required={!editando}
                                        placeholder={editando ? 'Contraseña actual...' : 'Indica una contraseña...'}
                                        className="bg-muted/30 border-border text-foreground focus:ring-primary pr-10 font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setMostrarPasswordModal(!mostrarPasswordModal)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        title={mostrarPasswordModal ? 'Ocultar' : 'Mostrar'}
                                    >
                                        {mostrarPasswordModal ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
                            <Button type="button" variant="outline" onClick={cerrarModal} className="border-border hover:bg-muted text-foreground">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={mutarGuardar.isPending} className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold">
                                {mutarGuardar.isPending ? 'Guardando...' : 'Guardar Usuario'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
