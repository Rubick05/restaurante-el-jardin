import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/cliente';
import { Button } from '@/componentes/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/componentes/ui/card';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Users, UserPlus, KeyRound, Trash2, Pencil } from 'lucide-react';

interface Usuario {
    id: string;
    nombre: string;
    usuario: string;
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
            setPassword('');
        } else {
            setEditando(null);
            setNombre('');
            setUsuario('');
            setRol('camarero');
            setPassword('');
        }
        setErrorForm('');
        setModalAbierto(true);
    };

    const cerrarModal = () => {
        setModalAbierto(false);
        setEditando(null);
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
                                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border">
                                    {u.rol}
                                </span>
                            </CardTitle>
                            <CardDescription className="text-sm">
                                @{u.usuario}
                            </CardDescription>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <form onSubmit={handleGuardar} className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b">
                            <h3 className="text-lg font-bold font-serif">
                                {editando ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h3>
                        </div>

                        <div className="p-5 space-y-4">
                            {errorForm && (
                                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                                    {errorForm}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label htmlFor="nombre">Nombre y Apellido</Label>
                                <Input
                                    id="nombre"
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="usr">Username</Label>
                                    <Input
                                        id="usr"
                                        value={usuario}
                                        onChange={e => setUsuario(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="rol">Rol</Label>
                                    <select
                                        id="rol"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                        value={rol}
                                        onChange={e => setRol(e.target.value)}
                                        required
                                    >
                                        <option value="camarero">Camarero</option>
                                        <option value="cocinero">Cocina</option>
                                        <option value="administrador">Administrador</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-2 border-t">
                                <Label htmlFor="pass" className="flex items-center gap-1.5 text-amber-700">
                                    <KeyRound className="w-3.5 h-3.5" />
                                    Contraseña {editando && '(Dejar en blanco para mantener actual)'}
                                </Label>
                                <Input
                                    id="pass"
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required={!editando}
                                    placeholder={editando ? '••••••••' : 'Indica una contraseña...'}
                                />
                            </div>
                        </div>

                        <div className="p-5 border-t bg-slate-50 flex justify-end gap-3">
                            <Button type="button" variant="outline" onClick={cerrarModal}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={mutarGuardar.isPending}>
                                {mutarGuardar.isPending ? 'Guardando...' : 'Guardar Usuario'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
