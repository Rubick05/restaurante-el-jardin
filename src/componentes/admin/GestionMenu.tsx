import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, ElementoMenu } from '@/lib/bd/bd-local';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Plus, Pencil, Trash2, Save, X, ImagePlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { API_BASE_URL, normalizarMenu } from '@/hooks/useInicializacion';

export default function GestionMenu() {
  const queryClient = useQueryClient();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Partial<ElementoMenu>>({});
  const [esNuevo, setEsNuevo] = useState(false);
  const inputImagenRef = useRef<HTMLInputElement>(null);

  const { data: menu = [] } = useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      // Siempre cargar desde servidor para que el admin vea los datos reales
      try {
        const res = await fetch(`${API_BASE_URL}/api/menu`);
        if (res.ok) {
          const items = await res.json() as ElementoMenu[];
          await bdLocal.elementosMenu.bulkPut(items);
          return items;
        }
      } catch { /* offline */ }
      return bdLocal.elementosMenu.toArray();
    },
    staleTime: 10_000,
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
        categoria: 'Plato Fuerte',
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
      const elemento: ElementoMenu = {
        id: esNuevo ? uuidv4() : editandoId!,
        id_restaurante: 'demo-tenant',
        nombre: formulario.nombre!,
        categoria: formulario.categoria || 'General',
        precio_actual: Number(formulario.precio_actual),
        disponible: formulario.disponible ?? true,
        descripcion: formulario.descripcion,
        actualizado_en: new Date().toISOString(),
        url_imagen: formulario.url_imagen,
        imagen_base64: formulario.imagen_base64,
      } as ElementoMenu;

      // ── Guardar en SERVIDOR primero ──
      const res = await fetch(`${API_BASE_URL}/api/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(elemento),
      });
      if (!res.ok) throw new Error(await res.text());
      const guardado = await res.json() as ElementoMenu;

      // Cache local
      await bdLocal.elementosMenu.put(guardado);

      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setEditandoId(null);
      setEsNuevo(false);
    } catch (e) {
      console.error(e);
      alert('Error al guardar en el servidor. Verifica la conexión.');
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este plato?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/menu/${id}`, { method: 'DELETE' });
    } catch { /* offline */ }
    await bdLocal.elementosMenu.delete(id);
    queryClient.invalidateQueries({ queryKey: ['menu'] });
  };

  const CATEGORIAS_MENU = ['Plato Fuerte', 'Caldos', 'Refrescos', 'Cervezas'];



  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight text-primary font-serif">Gestión del Menú</h2>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={async () => {
              const paso1 = confirm('⚠️ ATENCIÓN: ¿Borrar TODOS los pedidos del día?\n\nEl menú NO se borrará. No se puede deshacer.');
              if (!paso1) return;
              await bdLocal.pedidos.clear();
              await bdLocal.colaSincronizacion.clear();
              queryClient.clear();
              alert('✅ Pedidos borrados. La página se recargará.');
              window.location.reload();
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" /> Borrar Pedidos del Día
          </Button>

          <Button onClick={() => iniciarEdicion()} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Plato
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {editandoId && (
          <Card className="border-primary ring-2 ring-primary/20 sticky top-4 z-20 shadow-lg bg-background">
            <CardHeader className="pb-2 border-b border-primary/10">
              <CardTitle className="text-primary font-serif">
                {esNuevo ? 'Nuevo Plato' : 'Editando Plato'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre del Plato</label>
                  <Input
                    placeholder="Ej: Pique Macho (Entero)"
                    value={formulario.nombre || ''}
                    onChange={e => setFormulario({ ...formulario, nombre: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Producto</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={formulario.categoria || 'Plato Fuerte'}
                    onChange={e => setFormulario({ ...formulario, categoria: e.target.value })}
                  >
                    {CATEGORIAS_MENU.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Imagen del plato */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Imagen del Plato (opcional)</label>
                <div className="flex items-center gap-3">
                  {formulario.imagen_base64 ? (
                    <div className="relative group">
                      <img
                        src={formulario.imagen_base64}
                        alt="preview"
                        className="w-24 h-24 object-cover rounded-lg border shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setFormulario({ ...formulario, imagen_base64: undefined })}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground bg-slate-50">
                      <ImagePlus className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={inputImagenRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setFormulario({ ...formulario, imagen_base64: ev.target?.result as string });
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => inputImagenRef.current?.click()}
                    >
                      <ImagePlus className="w-4 h-4 mr-2" />
                      {formulario.imagen_base64 ? 'Cambiar imagen' : 'Subir imagen'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG o WebP. Se guardará en la base de datos local.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Precio (Bs)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={formulario.precio_actual || ''}
                    onChange={e => setFormulario({ ...formulario, precio_actual: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descripción</label>
                  <Input
                    placeholder="Ingredientes, tamaño, notas..."
                    value={formulario.descripcion || ''}
                    onChange={e => setFormulario({ ...formulario, descripcion: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <Button variant="outline" onClick={() => { setEditandoId(null); setEsNuevo(false); }}>
                  <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
                <Button onClick={guardar} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista plana de todos los items, ordenada por categoría */}
        <Card className="border-primary/20 shadow-sm bg-card/50">
          <CardContent className="p-0">
            <div className="divide-y divide-primary/10">
              {[...menu].sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '') || a.nombre.localeCompare(b.nombre)).map(item => (
                <div key={item.id} className={`flex items-center justify-between p-4 hover:bg-muted/30 transition-colors ${!item.disponible ? 'opacity-60 bg-muted/20' : ''}`}>
                  {/* Miniatura de imagen */}
                  {item.imagen_base64 ? (
                    <img
                      src={item.imagen_base64}
                      alt={item.nombre}
                      className="w-12 h-12 object-cover rounded-lg border shadow-sm mr-3 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg border bg-slate-100 mr-3 shrink-0 flex items-center justify-center text-slate-300">
                      <ImagePlus className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary/60 bg-primary/10 px-2 py-0.5 rounded">
                        {item.categoria || 'General'}
                      </span>
                      <h4 className="font-bold text-foreground truncate">{item.nombre}</h4>
                      <span className="text-sm font-mono text-muted-foreground bg-secondary px-2 rounded">
                        {item.precio_actual} Bs
                      </span>
                    </div>
                    {item.descripcion && (
                      <p className="text-sm text-muted-foreground truncate">{item.descripcion}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="relative inline-flex items-center cursor-pointer" title="Activar/Desactivar">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={item.disponible}
                        onChange={async (e) => {
                          await bdLocal.elementosMenu.update(item.id, { disponible: e.target.checked });
                          queryClient.invalidateQueries({ queryKey: ['menu'] });
                        }}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      <span className="ml-2 text-sm font-medium text-muted-foreground min-w-[3rem]">
                        {item.disponible ? 'Activo' : 'Baja'}
                      </span>
                    </label>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => iniciarEdicion(item)}>
                        <Pencil className="w-4 h-4 text-primary/70" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => eliminar(item.id)}>
                        <Trash2 className="w-4 h-4 text-destructive/70" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {menu.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg font-medium">No hay items en el menú</p>
                  <p className="text-sm">Agrega un nuevo plato o carga el menú predeterminado</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div >
  );
}
