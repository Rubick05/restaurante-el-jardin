import { useState, useRef } from 'react';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/cliente';
import { Button } from '@/componentes/ui/button';
import { Card, CardContent } from '@/componentes/ui/card';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Film, Image as ImageIcon, Trash2, Upload, AlertCircle, Play } from 'lucide-react';

interface Promo {
    id: string;
    tipo: 'imagen' | 'video';
    datos_base64: string;
    badge: string;
    titulo: string;
    subtitulo: string;
    orden: number;
}

export default function GestionPromociones() {
    const queryClient = useQueryClient();
    const inputRef = useRef<HTMLInputElement>(null);

    // Estado local para editar antes de guardar
    const [promosLocales, setPromosLocales] = useState<Partial<Promo>[]>([]);
    const [cargandoArchivo, setCargandoArchivo] = useState(false);
    const [error, setError] = useState('');

    const { isLoading, data: promosData } = useQuery<Promo[]>({
        queryKey: ['promociones'],
        queryFn: () => api.get('/promociones'),
    });

    // Sincronizar data del server con el estado local
    React.useEffect(() => {
        if (promosData && Array.isArray(promosData)) {
            setPromosLocales([...promosData].sort((a, b) => a.orden - b.orden));
        }
    }, [promosData]);

    const mutarGuardar = useMutation({
        mutationFn: () => api.post('/promociones', { promociones: promosLocales }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promociones'] });
            alert('¡Promociones publicadas con éxito en el sitio web!');
        },
        onError: (err: any) => {
            setError(err.message || 'Error al publicar promociones');
        }
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (promosLocales.length >= 5) {
            setError('Solo se permite un máximo de 5 promociones en el carrusel.');
            return;
        }

        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');

        if (!isVideo && !isImage) {
            setError('Formato no soportado. Por favor sube una imagen o video.');
            return;
        }

        // Validación de tamaño: 5MB img, 15MB video
        const maxMB = isVideo ? 15 : 5;
        if (file.size > maxMB * 1024 * 1024) {
            setError(`El archivo es demasiado pesado. Máximo permitido: ${maxMB}MB.`);
            return;
        }

        setCargandoArchivo(true);
        setError('');

        try {
            const base64 = await convertToBase64(file);

            const nuevaPromo: Partial<Promo> = {
                tipo: isVideo ? 'video' : 'imagen',
                datos_base64: base64,
                badge: 'Novedad',
                titulo: 'Nueva Promoción',
                subtitulo: '¡Visítanos para disfrutar esta oferta!',
            };

            setPromosLocales(prev => [...prev, nuevaPromo]);
        } catch (err) {
            setError('Error al leer el archivo. Intente con otro.');
        } finally {
            setCargandoArchivo(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleActualizarCampo = (index: number, campo: keyof Promo, valor: string) => {
        setPromosLocales(prev => {
            const copia = [...prev];
            copia[index] = { ...copia[index], [campo]: valor };
            return copia;
        });
    };

    const handleEliminar = (index: number) => {
        setPromosLocales(prev => prev.filter((_, i) => i !== index));
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando promociones...</div>;

    return (
        <div className="space-y-6 p-4 max-w-5xl mx-auto pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
                        <ImageIcon className="w-6 h-6 text-primary" />
                        Gestión de Carrusel Web
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Sube hasta 5 imágenes o videos para mostrar en la web pública.
                        Los cambios impactarán en tiempo real al darle a "Guardar y Publicar".
                    </p>
                </div>

                <div className="flex gap-2">
                    <input
                        type="file"
                        accept="image/*,video/mp4,video/webm"
                        className="hidden"
                        ref={inputRef}
                        onChange={handleFileChange}
                    />
                    <Button
                        variant="outline"
                        className="gap-2 shrink-0"
                        onClick={() => inputRef.current?.click()}
                        disabled={promosLocales.length >= 5 || cargandoArchivo}
                    >
                        <Upload className="w-4 h-4" />
                        {cargandoArchivo ? 'Subiendo...' : 'Añadir Archivo'}
                    </Button>
                    <Button
                        className="gap-2 shrink-0 bg-amber-700 hover:bg-amber-800"
                        onClick={() => mutarGuardar.mutate()}
                        disabled={mutarGuardar.isPending}
                    >
                        {mutarGuardar.isPending ? 'Publicando...' : 'Guardar y Publicar'}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="text-sm font-medium text-slate-500">
                Imágenes/Videos en uso: {promosLocales.length} / 5
            </div>

            {promosLocales.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <div className="flex gap-2 mb-4 text-slate-300">
                        <ImageIcon className="w-12 h-12" />
                        <Film className="w-12 h-12" />
                    </div>
                    <p className="text-slate-500 text-center max-w-sm">
                        No hay ninguna promoción en el carrusel web ahora mismo. Añade algunas imágenes o videos para atraer más clientes.
                    </p>
                    <Button
                        variant="secondary"
                        className="mt-6"
                        onClick={() => inputRef.current?.click()}
                    >
                        Seleccionar Archivos
                    </Button>
                </div>
            ) : (
                <div className="grid gap-6">
                    {promosLocales.map((promo, idx) => (
                        <Card key={idx} className="overflow-hidden bg-white hover:border-amber-200 transition-colors">
                            <div className="absolute top-4 left-4 z-10 bg-black/60 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-md">
                                #{idx + 1}
                            </div>
                            <div className="flex flex-col md:flex-row h-full">
                                {/* Vista previa */}
                                <div className="md:w-[320px] shrink-0 bg-black relative flex items-center justify-center overflow-hidden h-48 md:h-auto border-r border-slate-100">
                                    {promo.tipo === 'video' ? (
                                        <>
                                            <video
                                                src={promo.datos_base64}
                                                className="w-full h-full object-cover opacity-80"
                                                muted loop autoPlay playsInline
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white">
                                                    <Play className="w-5 h-5 ml-1" />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <img
                                            src={promo.datos_base64}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>

                                {/* Formulario para los textos overlay */}
                                <CardContent className="flex-1 p-6 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <h3 className="font-medium text-slate-800">Textos visibles en la web</h3>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:bg-red-50 hover:text-red-700 h-8 w-8"
                                            onClick={() => handleEliminar(idx)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5 md:col-span-2">
                                            <Label>Etiqueta / Badge</Label>
                                            <Input
                                                value={promo.badge}
                                                onChange={(e) => handleActualizarCampo(idx, 'badge', e.target.value)}
                                                placeholder="Ej. Promoción Exclusiva"
                                            />
                                        </div>
                                        <div className="space-y-1.5 md:col-span-2">
                                            <Label>Título Principal</Label>
                                            <Input
                                                value={promo.titulo}
                                                onChange={(e) => handleActualizarCampo(idx, 'titulo', e.target.value)}
                                                placeholder="Ej. Fines de semana de Peñas"
                                            />
                                        </div>
                                        <div className="space-y-1.5 md:col-span-2">
                                            <Label>Subtítulo</Label>
                                            <Input
                                                value={promo.subtitulo}
                                                onChange={(e) => handleActualizarCampo(idx, 'subtitulo', e.target.value)}
                                                placeholder="Ej. Disfruta los mejores grupos en vivo junto a tu familia."
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
