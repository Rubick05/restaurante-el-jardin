import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, ElementoMenu } from '@/lib/bd/bd-local';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function GestionMenu() {
  const queryClient = useQueryClient();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Partial<ElementoMenu>>({});
  const [esNuevo, setEsNuevo] = useState(false);

  const { data: menu = [] } = useQuery({
    queryKey: ['menu'], // 🔥 IMPORTANTE: Mismo key que usa el Mesero
    queryFn: () => bdLocal.elementosMenu.toArray()
  });

  const iniciarEdicion = (item?: ElementoMenu) => {
    if (item) {
      setEditandoId(item.id);
      setFormulario({ ...item });
      setEsNuevo(false);
    } else {
      setEditandoId('nuevo');
      setFormulario({
        nombre: '',
        categoria: 'Platos Fuertes',
        precio_actual: 0,
        disponible: true,
        descripcion: ''
      });
      setEsNuevo(true);
    }
  };

  const guardar = async () => {
    if (!formulario.nombre || !formulario.precio_actual) return;

    try {
      if (esNuevo) {
        await bdLocal.elementosMenu.add({
          id: uuidv4(),
          id_restaurante: 'demo-tenant',
          nombre: formulario.nombre,
          categoria: formulario.categoria || 'General',
          precio_actual: Number(formulario.precio_actual),
          disponible: formulario.disponible ?? true,
          descripcion: formulario.descripcion,
          actualizado_en: new Date().toISOString(),
          // Campos opcionales
          url_imagen: formulario.url_imagen
        } as ElementoMenu);
      } else {
        await bdLocal.elementosMenu.update(editandoId!, {
          ...formulario,
          precio_actual: Number(formulario.precio_actual), // Asegurar número
          actualizado_en: new Date().toISOString()
        });
      }

      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setEditandoId(null);
      setEsNuevo(false);
    } catch (e) {
      console.error(e);
      alert('Error al guardar');
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este plato?')) return;
    await bdLocal.elementosMenu.delete(id);
    queryClient.invalidateQueries({ queryKey: ['menu'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Gestión del Menú</h2>
        <Button onClick={() => iniciarEdicion()}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo Plato
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Formulario de Edición / Creación (Tarjeta Especial) */}
        {(esNuevo || editandoId) && (
          <Card className="border-primary ring-2 ring-primary/20">
            <CardHeader className="pb-2">
              <CardTitle>{esNuevo ? 'Nuevo Plato' : 'Editando Plato'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Nombre del plato"
                value={formulario.nombre || ''}
                onChange={e => setFormulario({ ...formulario, nombre: e.target.value })}
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Precio"
                  className="w-24"
                  value={formulario.precio_actual || ''}
                  onChange={e => setFormulario({ ...formulario, precio_actual: parseFloat(e.target.value) })}
                />
                <Input
                  placeholder="Categoría"
                  className="flex-1"
                  value={formulario.categoria || ''}
                  onChange={e => setFormulario({ ...formulario, categoria: e.target.value })}
                />
              </div>
              <Input
                placeholder="Descripción corta"
                value={formulario.descripcion || ''}
                onChange={e => setFormulario({ ...formulario, descripcion: e.target.value })}
              />
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={guardar}>
                  <Save className="w-4 h-4 mr-2" /> Guardar
                </Button>
                <Button variant="outline" onClick={() => { setEditandoId(null); setEsNuevo(false); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Items Existentes */}
        {menu.map(item => (
          <Card key={item.id} className={editandoId === item.id ? 'hidden' : ''}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 text-sm">
              <span className="font-semibold text-muted-foreground">{item.categoria}</span>
              {item.disponible ? (
                <span className="text-green-600 text-xs px-2 py-1 bg-green-100 rounded-full">Activo</span>
              ) : (
                <span className="text-red-600 text-xs px-2 py-1 bg-red-100 rounded-full">Agotado</span>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg">{item.nombre}</h3>
                <span className="font-mono font-bold">${item.precio_actual.toFixed(2)}</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-4">
                {item.descripcion || 'Sin descripción'}
              </p>

              <div className="flex gap-2 border-t pt-4">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => iniciarEdicion(item)}>
                  <Pencil className="w-4 h-4 mr-2" /> Editar
                </Button>
                <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => eliminar(item.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
