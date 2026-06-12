import { useState, useRef, useCallback } from 'react';
import { Upload, Pencil, Trash2, Save, X, ImagePlus, Tag, CheckCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/hooks/useInicializacion';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Card, CardContent } from '@/componentes/ui/card';

// Interfaces alineadas con el nuevo schema
interface Promocion {
    id: string;
    titulo: string;
    subtitulo?: string;
    badge?: string;
    tipo: 'imagen' | 'video';
    imagen_url?: string;
    imagen_base64?: string;
    fecha_inicio: string;
    fecha_fin?: string;
    orden: number;
    creado_en: string;
}

const BADGE_CHIPS = ['Nuevo', 'Promo', 'Evento', 'Hoy', 'Especial'] as const;

export default function VistaLanding() {
    const queryClient = useQueryClient();

    // Estado del form
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [formulario, setFormulario] = useState<Partial<Promocion>>({
        titulo: '',
        subtitulo: '',
        badge: '',
        tipo: 'imagen',
        orden: 1,
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: '',
    });
    const inputImagenRef = useRef<HTMLInputElement>(null);
    const [archivoNombre, setArchivoNombre] = useState<string>('');
    const [arrastrando, setArrastrando] = useState(false);
    const [opcionesAvanzadas, setOpcionesAvanzadas] = useState(false);
    const [exito, setExito] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const { data: promociones = [], isLoading } = useQuery({
        queryKey: ['promociones', 'todas'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/promociones/todas`);
            if (res.ok) {
                return (await res.json()) as Promocion[];
            }
            return [];
        },
    });

    const resetFormulario = () => {
        setEditandoId(null);
        setFormulario({
            titulo: '',
            subtitulo: '',
            badge: '',
            tipo: 'imagen',
            orden: 1,
            fecha_inicio: new Date().toISOString().split('T')[0],
            fecha_fin: '',
        });
        setArchivoNombre('');
        setOpcionesAvanzadas(false);
    };

    const iniciarEdicion = (item: Promocion) => {
        setEditandoId(item.id);
        setFormulario({
            ...item,
            fecha_inicio: new Date(item.fecha_inicio).toISOString().split('T')[0],
            fecha_fin: item.fecha_fin ? new Date(item.fecha_fin).toISOString().split('T')[0] : '',
        });
        setArchivoNombre('');
        setOpcionesAvanzadas(true);
        // Scroll to top of page
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const procesarArchivo = useCallback((file: File) => {
        if (file.size > 10 * 1024 * 1024) {
            alert('El archivo es demasiado grande (Máx 10MB). Usa un enlace externo para archivos más pesados.');
            return;
        }
        const esVideo = file.type.startsWith('video/');
        const reader = new FileReader();
        reader.onload = (ev) => {
            setFormulario(prev => ({
                ...prev,
                imagen_base64: ev.target?.result as string,
                tipo: esVideo ? 'video' : 'imagen',
            }));
            setArchivoNombre(file.name);
        };
        reader.readAsDataURL(file);
    }, []);

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setArrastrando(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setArrastrando(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setArrastrando(false);
        const file = e.dataTransfer.files?.[0];
        if (file) procesarArchivo(file);
    }, [procesarArchivo]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) procesarArchivo(file);
    };

    const guardar = async () => {
        if (!formulario.titulo) {
            alert('El título es requerido');
            return;
        }

        setGuardando(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/promociones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editandoId && editandoId !== 'nuevo' ? editandoId : null,
                    titulo: formulario.titulo,
                    subtitulo: formulario.subtitulo || null,
                    badge: formulario.badge || null,
                    tipo: formulario.tipo,
                    imagen_base64: formulario.imagen_base64,
                    imagen_url: formulario.imagen_url,
                    orden: formulario.orden || 1,
                    fecha_inicio: formulario.fecha_inicio || new Date().toISOString().split('T')[0],
                    fecha_fin: formulario.fecha_fin || null,
                }),
            });

            if (!res.ok) throw new Error(await res.text());

            queryClient.invalidateQueries({ queryKey: ['promociones'] });
            resetFormulario();

            // Show success toast
            setExito(true);
            setTimeout(() => setExito(false), 3000);
        } catch (e) {
            console.error(e);
            alert('Error al guardar la promoción.');
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async (id: string, titulo: string) => {
        if (!confirm(`¿Eliminar "${titulo}"?`)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/promociones/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            queryClient.invalidateQueries({ queryKey: ['promociones'] });
        } catch (e) {
            console.error(e);
            alert('Error al eliminar.');
        }
    };

    const tienePreview = formulario.imagen_base64 || formulario.imagen_url;
    const esEdicion = editandoId !== null && editandoId !== 'nuevo';
    const promosActivas = promociones.filter(p => {
        const fin = p.fecha_fin ? new Date(p.fecha_fin) : null;
        return !fin || fin >= new Date();
    });
    const promosExpiradas = promociones.filter(p => {
        const fin = p.fecha_fin ? new Date(p.fecha_fin) : null;
        return fin && fin < new Date();
    });

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            {/* Success Toast */}
            {exito && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium">
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        ¡Promoción publicada en la web!
                    </div>
                </div>
            )}

            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                    📤 Publicar Promos
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Sube imágenes o videos y se mostrarán en la web del restaurante al instante.
                </p>
            </div>

            {/* Edit mode banner */}
            {esEdicion && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800">
                        ✏️ Editando: <strong>{formulario.titulo || '...'}</strong>
                    </span>
                    <button
                        onClick={resetFormulario}
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                        Cancelar
                    </button>
                </div>
            )}

            {/* Upload Zone */}
            <div
                className={`relative min-h-[200px] border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer
                    ${arrastrando
                        ? 'border-amber-400 bg-amber-50 scale-[1.01]'
                        : tienePreview
                            ? 'border-green-300 bg-green-50/50'
                            : 'border-slate-300 bg-slate-50 hover:border-amber-300 hover:bg-amber-50/30'
                    }`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => inputImagenRef.current?.click()}
            >
                <input
                    ref={inputImagenRef}
                    type="file"
                    accept="image/*,video/mp4,video/webm"
                    className="hidden"
                    onChange={handleFileInput}
                />

                {tienePreview ? (
                    <div className="flex flex-col items-center justify-center p-6 gap-3">
                        <div className="relative">
                            {formulario.tipo === 'video' ? (
                                <video
                                    src={formulario.imagen_base64 || formulario.imagen_url}
                                    className="w-40 h-32 object-cover rounded-xl shadow-md border border-slate-200"
                                    autoPlay loop muted playsInline
                                />
                            ) : (
                                <img
                                    src={formulario.imagen_base64 || formulario.imagen_url}
                                    alt="preview"
                                    className="w-40 h-32 object-cover rounded-xl shadow-md border border-slate-200"
                                />
                            )}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFormulario(prev => ({ ...prev, imagen_base64: undefined, imagen_url: undefined, tipo: 'imagen' }));
                                    setArchivoNombre('');
                                }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {archivoNombre && (
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">{archivoNombre}</p>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                inputImagenRef.current?.click();
                            }}
                            className="text-sm text-amber-600 hover:text-amber-800 font-medium underline underline-offset-2"
                        >
                            Cambiar archivo
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 gap-3 text-center">
                        <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
                            <Upload className={`w-8 h-8 ${arrastrando ? 'text-amber-500' : 'text-slate-400'}`} />
                        </div>
                        <div>
                            <p className="font-medium text-slate-700">
                                Arrastra una imagen aquí o toca para seleccionar
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Acepta imágenes y videos (máx 10MB)
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* URL externa input (alternative to file upload) */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 shrink-0">O usar URL:</span>
                <Input
                    placeholder="https://... (link de imagen o video)"
                    className="h-8 text-xs"
                    value={formulario.imagen_url || ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={e => {
                        const url = e.target.value;
                        const esVideo = /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes('video');
                        setFormulario(prev => ({ ...prev, imagen_url: url, tipo: esVideo ? 'video' : 'imagen' }));
                    }}
                />
            </div>

            {/* Express Form */}
            <div className="space-y-4">
                {/* Título */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                        Título <span className="text-red-500">*</span>
                    </label>
                    <Input
                        placeholder="Nombre de la promoción"
                        value={formulario.titulo || ''}
                        onChange={e => setFormulario(prev => ({ ...prev, titulo: e.target.value }))}
                        className="text-base h-11"
                    />
                </div>

                {/* Badge Chips */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        Etiqueta
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {BADGE_CHIPS.map(chip => (
                            <button
                                key={chip}
                                type="button"
                                onClick={() => setFormulario(prev => ({
                                    ...prev,
                                    badge: prev.badge === chip ? '' : chip,
                                }))}
                                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150
                                    ${formulario.badge === chip
                                        ? 'bg-amber-500 text-white shadow-sm scale-105'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {chip}
                            </button>
                        ))}
                        {/* Custom badge input */}
                        {formulario.badge && !BADGE_CHIPS.includes(formulario.badge as typeof BADGE_CHIPS[number]) && (
                            <span className="px-3.5 py-1.5 rounded-full text-sm font-medium bg-amber-500 text-white shadow-sm">
                                {formulario.badge}
                            </span>
                        )}
                    </div>
                </div>

                {/* Fecha expiración */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">
                        Fecha de expiración <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <Input
                        type="date"
                        value={formulario.fecha_fin || ''}
                        onChange={e => setFormulario(prev => ({ ...prev, fecha_fin: e.target.value }))}
                        className="h-10"
                    />
                    <p className="text-[11px] text-slate-400">
                        Se elimina automáticamente al vencer
                    </p>
                </div>

                {/* Opciones avanzadas */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setOpcionesAvanzadas(!opcionesAvanzadas)}
                        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <span>⚙️ Más opciones</span>
                        {opcionesAvanzadas
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />
                        }
                    </button>

                    {opcionesAvanzadas && (
                        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                            <div className="space-y-1.5 pt-3">
                                <label className="text-sm font-medium text-slate-600">Subtítulo</label>
                                <Input
                                    placeholder="Descripción breve (opcional)"
                                    value={formulario.subtitulo || ''}
                                    onChange={e => setFormulario(prev => ({ ...prev, subtitulo: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-600">Orden de aparición</label>
                                <Input
                                    type="number"
                                    placeholder="1"
                                    value={formulario.orden || 1}
                                    onChange={e => setFormulario(prev => ({ ...prev, orden: parseInt(e.target.value) || 1 }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-600">Fecha de inicio</label>
                                <Input
                                    type="date"
                                    value={formulario.fecha_inicio || ''}
                                    onChange={e => setFormulario(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-600">URL externa</label>
                                <Input
                                    placeholder="https://..."
                                    value={formulario.imagen_url || ''}
                                    onChange={e => {
                                        const url = e.target.value;
                                        const esVideo = /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes('video');
                                        setFormulario(prev => ({ ...prev, imagen_url: url, tipo: esVideo ? 'video' : 'imagen' }));
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Publish Button */}
                <Button
                    onClick={guardar}
                    disabled={!formulario.titulo || guardando}
                    className={`w-full h-14 text-base font-bold rounded-xl shadow-lg transition-all duration-200
                        ${esEdicion
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gradient-to-r from-amber-500 to-green-500 hover:from-amber-600 hover:to-green-600 text-white'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {guardando ? (
                        <span className="flex items-center gap-2">
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Publicando...
                        </span>
                    ) : esEdicion ? (
                        <span className="flex items-center gap-2">
                            <Save className="w-5 h-5" />
                            💾 Guardar Cambios
                        </span>
                    ) : (
                        '📤 Publicar en la Web'
                    )}
                </Button>

                {esEdicion && (
                    <button
                        onClick={resetFormulario}
                        className="w-full text-center text-sm text-slate-500 hover:text-slate-700 py-1"
                    >
                        <X className="w-3.5 h-3.5 inline mr-1" />
                        Cancelar edición
                    </button>
                )}
            </div>

            {/* Divider */}
            <hr className="border-slate-200" />

            {/* Active Promos Grid */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold font-serif text-slate-800">Promociones Activas</h3>
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                        {promosActivas.length}
                    </span>
                </div>

                {isLoading && (
                    <p className="text-slate-500 text-center py-8">Cargando...</p>
                )}

                {!isLoading && promosActivas.length === 0 && promosExpiradas.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                        <ImagePlus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No hay promociones aún</p>
                        <p className="text-sm text-slate-400 mt-1">Sube tu primera promo arriba ☝️</p>
                    </div>
                )}

                {/* Grid — 3 cols desktop, 2 cols mobile */}
                {promosActivas.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {promosActivas.map(promo => (
                            <PromoCard
                                key={promo.id}
                                promo={promo}
                                onEdit={() => iniciarEdicion(promo)}
                                onDelete={() => eliminar(promo.id, promo.titulo)}
                            />
                        ))}
                    </div>
                )}

                {/* Expired promos */}
                {promosExpiradas.length > 0 && (
                    <div className="space-y-3 mt-6">
                        <p className="text-xs uppercase tracking-widest text-slate-400 font-medium">
                            Expiradas ({promosExpiradas.length})
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {promosExpiradas.map(promo => (
                                <PromoCard
                                    key={promo.id}
                                    promo={promo}
                                    expirada
                                    onEdit={() => iniciarEdicion(promo)}
                                    onDelete={() => eliminar(promo.id, promo.titulo)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Promo Card subcomponent ──
function PromoCard({
    promo,
    expirada = false,
    onEdit,
    onDelete,
}: {
    promo: Promocion;
    expirada?: boolean;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <Card className={`overflow-hidden group ${expirada ? 'opacity-50 grayscale' : ''}`}>
            <div className="aspect-square bg-slate-100 relative">
                {promo.imagen_base64 || promo.imagen_url ? (
                    promo.tipo === 'video' ? (
                        <video
                            src={promo.imagen_base64 || promo.imagen_url}
                            className="w-full h-full object-cover"
                            autoPlay loop muted playsInline
                        />
                    ) : (
                        <img
                            src={promo.imagen_base64 || promo.imagen_url}
                            className="w-full h-full object-cover"
                            alt={promo.titulo}
                        />
                    )
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-200">
                        <ImagePlus className="w-8 h-8 text-slate-400" />
                    </div>
                )}

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="p-2.5 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors"
                        title="Editar"
                    >
                        <Pencil className="w-4 h-4 text-slate-700" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-2.5 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                </div>

                {/* Badges */}
                {expirada && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        Expirada
                    </div>
                )}
                {promo.badge && !expirada && (
                    <div className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded shadow font-medium">
                        {promo.badge}
                    </div>
                )}
            </div>
            <CardContent className="p-2.5">
                <p className="text-sm font-semibold text-slate-800 line-clamp-1">{promo.titulo}</p>
                {promo.subtitulo && (
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{promo.subtitulo}</p>
                )}
            </CardContent>
        </Card>
    );
}
