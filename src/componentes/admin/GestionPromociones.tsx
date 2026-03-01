import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Plus, Pencil, Trash2, Save, X, ImagePlus, Video } from 'lucide-react';
import { API_BASE_URL } from '@/hooks/useInicializacion';

export interface Promocion {
    id: string;
    titulo: string;
    tipo_media: 'imagen' | 'video';
    media_base64: string;
    activa: boolean;
    creado_en: string;
}

export default function GestionPromociones() {
    const queryClient = useQueryClient();
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [formulario, setFormulario] = useState<Partial<Promocion>>({});
    const [esNuevo, setEsNuevo] = useState(false);
    const inputMediaRef = useRef<HTMLInputElement>(null);

    const { data: promociones = [], isLoading } = useQuery({
        queryKey: ['promociones', 'admin'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/promociones`);
            if (!res.ok) throw new Error('Error cargando promociones');
            return await res.json() as Promocion[];
        },
    });

    const iniciarEdicion = (item?: Promocion) => {
        if (item) {
            setEditandoId(item.id);
            setFormulario({ ...item });
            setEsNuevo(false);
        } else {
            setEditandoId('nuevo');
            setFormulario({
                titulo: '',
                tipo_media: 'imagen',
                activa: true,
            });
            setEsNuevo(true);
        }
    };

    const procesarArchivo = (file: File) => {
        const isVideo = file.type.startsWith('video/');
        if (file.size > 20 * 1024 * 1024) { // 20MB limit para admin en frontend
            alert('El archivo es demasiado grande (Máximo 20MB).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            setFormulario(prev => ({
                ...prev,
                tipo_media: isVideo ? 'video' : 'imagen',
                media_base64: ev.target?.result as string,
                titulo: prev.titulo || file.name.replace(/\.[^.]+$/, '')
            }));
        };
        reader.readAsDataURL(file);
    };

    const guardar = async () => {
        if (!formulario.titulo || !formulario.media_base64) {
            alert('El título y la imagen/video son obligatorios.');
            return;
        }

        try {
            const url = esNuevo ? `${API_BASE_URL}/api/promociones` : `${API_BASE_URL}/api/promociones/${editandoId}`;
            const method = esNuevo ? 'POST' : 'PATCH';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formulario),
            });

            if (!res.ok) throw new Error(await res.text());

            queryClient.invalidateQueries({ queryKey: ['promociones'] });
            setEditandoId(null);
            setEsNuevo(false);
        } catch (e: any) {
            console.error(e);
            alert('Error al guardar: ' + e.message);
        }
    };

    const eliminar = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta promoción?')) return;
        try {
            await fetch(`${API_BASE_URL}/api/promociones/${id}`, { method: 'DELETE' });
            queryClient.invalidateQueries({ queryKey: ['promociones'] });
        } catch (e) {
            alert('Error al eliminar');
        }
    };

    const cambiarEstado = async (id: string, activa: boolean) => {
        try {
            await fetch(`${API_BASE_URL}/api/promociones/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activa }),
            });
            queryClient.invalidateQueries({ queryKey: ['promociones'] });
        } catch (e) {
            console.error(e);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando promociones...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight text-primary font-serif">Gestión de Promociones</h2>
                <Button onClick={() => iniciarEdicion()} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" /> Nueva Promoción
                </Button>
            </div>

            <div className="grid gap-6">
                {editandoId && (
                    <Card className="border-primary ring-2 ring-primary/20 sticky top-4 z-20 shadow-lg bg-background">
                        <CardHeader className="pb-2 border-b border-primary/10">
                            <CardTitle className="text-primary font-serif">
                                {esNuevo ? 'Nueva Promoción' : 'Editando Promoción'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Título (interno para la administración)</label>
                                <Input
                                    placeholder="Ej: Promo San Valentín"
                                    value={formulario.titulo || ''}
                                    onChange={e => setFormulario({ ...formulario, titulo: e.target.value })}
                                />
                            </div>

                            {/* Media Upload */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Imagen o Video Corto</label>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">

                                    {/* Vista Previa */}
                                    <div className="shrink-0">
                                        {formulario.media_base64 ? (
                                            <div className="relative group w-32 h-32 md:w-48 md:h-48 rounded-lg overflow-hidden border shadow-sm bg-black flex items-center justify-center">
                                                {formulario.tipo_media === 'video' ? (
                                                    <video src={formulario.media_base64} controls className="max-w-full max-h-full" />
                                                ) : (
                                                    <img src={formulario.media_base64} alt="preview" className="object-contain w-full h-full" />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setFormulario({ ...formulario, media_base64: undefined, tipo_media: 'imagen' })}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-32 h-32 md:w-48 md:h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground bg-slate-50 gap-2">
                                                <ImagePlus className="w-8 h-8" />
                                                <span className="text-xs">Sin archivo</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Controles */}
                                    <div className="flex-1 space-y-4">
                                        <input
                                            ref={inputMediaRef}
                                            type="file"
                                            accept="image/png, image/jpeg, image/webp, video/mp4, video/webm"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) procesarArchivo(file);
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => inputMediaRef.current?.click()}
                                            className="w-full sm:w-auto"
                                        >
                                            <ImagePlus className="w-4 h-4 mr-2" />
                                            {formulario.media_base64 ? 'Cambiar archivo' : 'Seleccionar Archivo'}
                                        </Button>
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p>Formatos aceptados:</p>
                                            <ul className="list-disc pl-4">
                                                <li><strong>Imágenes:</strong> JPG, PNG, WebP (Ideal para promos estáticas)</li>
                                                <li><strong>Videos:</strong> MP4, WebM (Cortos, menos de 20MB, para grupos en vivo)</li>
                                            </ul>
                                            <p className="mt-2 text-amber-600 font-medium">Nota: El archivo se visualizará en tamaño grande en la página web pública.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4 justify-end border-t">
                                <Button variant="outline" onClick={() => { setEditandoId(null); setEsNuevo(false); }}>
                                    <X className="w-4 h-4 mr-2" /> Cancelar
                                </Button>
                                <Button onClick={guardar} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                    <Save className="w-4 h-4 mr-2" /> Guardar Promoción
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Lista de promociones */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {promociones.map(promo => (
                        <Card key={promo.id} className={`overflow-hidden transition-all ${!promo.activa ? 'opacity-60 grayscale-[0.5]' : 'hover:shadow-md'}`}>
                            <div className="aspect-video w-full bg-black relative flex items-center justify-center border-b">
                                {promo.tipo_media === 'video' ? (
                                    <>
                                        <video src={promo.media_base64} className="object-contain w-full h-full" preload="metadata" />
                                        <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5 backdrop-blur-sm">
                                            <Video className="w-4 h-4 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <img src={promo.media_base64} alt={promo.titulo} className="object-contain w-full h-full" loading="lazy" />
                                )}
                                {!promo.activa && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                        <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm">Inactiva</span>
                                    </div>
                                )}
                            </div>
                            <CardContent className="p-4">
                                <h4 className="font-bold text-lg mb-4 truncate" title={promo.titulo}>{promo.titulo}</h4>
                                <div className="flex items-center justify-between">
                                    <label className="relative inline-flex items-center cursor-pointer" title="Activar/Desactivar visibilidad web">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={promo.activa}
                                            onChange={(e) => cambiarEstado(promo.id, e.target.checked)}
                                        />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                        <span className="ml-2 text-xs font-medium text-muted-foreground select-none">
                                            {promo.activa ? 'Visible en Web' : 'Oculta'}
                                        </span>
                                    </label>

                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => iniciarEdicion(promo)}>
                                            <Pencil className="w-4 h-4 text-primary/70" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => eliminar(promo.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {promociones.length === 0 && (
                        <div className="col-span-full border-2 border-dashed rounded-xl p-12 text-center flex flex-col items-center justify-center text-muted-foreground bg-slate-50/50">
                            <ImagePlus className="w-12 h-12 mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-foreground mb-1">Sin promociones</h3>
                            <p className="text-sm">Sube fotos o videos para anunciar platos o eventos en la página principal.</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
