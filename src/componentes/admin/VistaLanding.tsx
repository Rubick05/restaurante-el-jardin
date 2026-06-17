import { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    Upload, Pencil, Trash2, Save, X, ImagePlus, Tag, 
    CheckCircle, ChevronDown, ChevronUp, Sparkles, 
    MonitorSmartphone, Plus, Image, Grid, FileText 
} from 'lucide-react';
import { API_BASE_URL } from '@/hooks/useInicializacion';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/componentes/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/componentes/ui/tabs';
import { Label } from '@/componentes/ui/label';
import { Badge } from '@/componentes/ui/badge';

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

interface GaleriaItem {
    id?: string;
    src: string;
    nombre: string;
    span: string;
    tagline?: string;
    detalles?: string;
}

const BADGE_CHIPS = ['Nuevo', 'Promo', 'Evento', 'Hoy', 'Especial'] as const;

export default function VistaLanding() {
    const queryClient = useQueryClient();
    const [seccionActiva, setSeccionActiva] = useState('promos');

    // ────────────────────────────────────────────────────────────────
    // ESTADOS: PROMOCIONES
    // ────────────────────────────────────────────────────────────────
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [formularioPromo, setFormularioPromo] = useState<Partial<Promocion>>({
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

    // ────────────────────────────────────────────────────────────────
    // ESTADOS: HERO SLIDESHOW
    // ────────────────────────────────────────────────────────────────
    const inputHeroRef = useRef<HTMLInputElement>(null);
    const [heroUrl, setHeroUrl] = useState('');
    const [guardandoHero, setGuardandoHero] = useState(false);

    // ────────────────────────────────────────────────────────────────
    // ESTADOS: GALERÍA MOSAICO
    // ────────────────────────────────────────────────────────────────
    const inputMosaicoRef = useRef<HTMLInputElement>(null);
    const [mosaicoForm, setMosaicoForm] = useState<Partial<GaleriaItem>>({
        src: '',
        nombre: '',
        span: 'span-1',
        tagline: '',
        detalles: ''
    });
    const [mosaicoArchivoNombre, setMosaicoArchivoNombre] = useState('');
    const [guardandoMosaico, setGuardandoMosaico] = useState(false);
    const [editandoMosaicoIndex, setEditandoMosaicoIndex] = useState<number | null>(null);

    // ────────────────────────────────────────────────────────────────
    // QUERIES
    // ────────────────────────────────────────────────────────────────
    // Promociones
    const { data: promociones = [], isLoading: cargandoPromos } = useQuery({
        queryKey: ['promociones', 'todas'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/promociones/todas`);
            if (res.ok) {
                return (await res.json()) as Promocion[];
            }
            return [];
        },
    });

    // Web Config (Hero Slides y Galería)
    const { data: webConfig = {}, isLoading: cargandoConfig } = useQuery({
        queryKey: ['web-config'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/web-config`);
            if (res.ok) {
                return await res.json();
            }
            return {};
        }
    });

    const heroSlides: string[] = webConfig.hero_slides || [
        '/hero-bg.jpg', '/musica.jpg', '/pampaku.jpg', '/lambreado.jpg'
    ];

    const galeriaItems: GaleriaItem[] = webConfig.galeria_mosaico || [
        { src: '/charque.jpg', nombre: 'Charque', span: 'span-2-col', tagline: 'Carne deshidratada crujiente', detalles: 'Con mote, huevo y queso.' },
        { src: '/pampaku.jpg', nombre: 'Pampaku', span: 'span-1', tagline: 'Cocción tradicional bajo tierra', detalles: 'Mix de carnes y tubérculos.' }
    ];

    // ────────────────────────────────────────────────────────────────
    // METODOS: PROMOCIONES
    // ────────────────────────────────────────────────────────────────
    const resetFormularioPromo = () => {
        setEditandoId(null);
        setFormularioPromo({
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

    const iniciarEdicionPromo = (item: Promocion) => {
        setEditandoId(item.id);
        setFormularioPromo({
            ...item,
            fecha_inicio: new Date(item.fecha_inicio).toISOString().split('T')[0],
            fecha_fin: item.fecha_fin ? new Date(item.fecha_fin).toISOString().split('T')[0] : '',
        });
        setArchivoNombre('');
        setOpcionesAvanzadas(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const procesarArchivoPromo = useCallback((file: File) => {
        if (file.size > 10 * 1024 * 1024) {
            alert('El archivo es demasiado grande (Máx 10MB).');
            return;
        }
        const esVideo = file.type.startsWith('video/');
        const reader = new FileReader();
        reader.onload = (ev) => {
            setFormularioPromo(prev => ({
                ...prev,
                imagen_base64: ev.target?.result as string,
                tipo: esVideo ? 'video' : 'imagen',
            }));
            setArchivoNombre(file.name);
        };
        reader.readAsDataURL(file);
    }, []);

    const guardarPromo = async () => {
        if (!formularioPromo.titulo) {
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
                    titulo: formularioPromo.titulo,
                    subtitulo: formularioPromo.subtitulo || null,
                    badge: formularioPromo.badge || null,
                    tipo: formularioPromo.tipo,
                    imagen_base64: formularioPromo.imagen_base64,
                    imagen_url: formularioPromo.imagen_url,
                    orden: formularioPromo.orden || 1,
                    fecha_inicio: formularioPromo.fecha_inicio || new Date().toISOString().split('T')[0],
                    fecha_fin: formularioPromo.fecha_fin || null,
                }),
            });

            if (!res.ok) throw new Error(await res.text());

            queryClient.invalidateQueries({ queryKey: ['promociones'] });
            resetFormularioPromo();
            setExito(true);
            setTimeout(() => setExito(false), 3000);
        } catch (e) {
            alert('Error al guardar la promoción.');
        } finally {
            setGuardando(false);
        }
    };

    const eliminarPromo = async (id: string, titulo: string) => {
        if (!confirm(`¿Eliminar "${titulo}"?`)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/promociones/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            queryClient.invalidateQueries({ queryKey: ['promociones'] });
        } catch (e) {
            alert('Error al eliminar.');
        }
    };

    // ────────────────────────────────────────────────────────────────
    // METODOS: HERO SLIDESHOW
    // ────────────────────────────────────────────────────────────────
    const procesarArchivoHero = (file: File) => {
        if (file.size > 8 * 1024 * 1024) {
            alert('El archivo es demasiado grande (Máx 8MB).');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target?.result as string;
            await guardarHeroSlides([...heroSlides, base64]);
        };
        reader.readAsDataURL(file);
    };

    const guardarHeroSlides = async (nuevosSlides: string[]) => {
        setGuardandoHero(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/web-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clave: 'hero_slides', valor: nuevosSlides })
            });
            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ['web-config'] });
                setHeroUrl('');
            } else {
                alert('No se pudo guardar la configuración del Hero.');
            }
        } catch {
            alert('Error de red al guardar configuración.');
        } finally {
            setGuardandoHero(false);
        }
    };

    const eliminarHeroSlide = async (indexAEliminar: number) => {
        if (!confirm('¿Eliminar esta foto de la portada principal?')) return;
        const filtrados = heroSlides.filter((_, i) => i !== indexAEliminar);
        await guardarHeroSlides(filtrados);
    };

    // ────────────────────────────────────────────────────────────────
    // METODOS: GALERÍA MOSAICO
    // ────────────────────────────────────────────────────────────────
    const procesarArchivoMosaico = (file: File) => {
        if (file.size > 8 * 1024 * 1024) {
            alert('El archivo es demasiado grande (Máx 8MB).');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setMosaicoForm(prev => ({
                ...prev,
                src: ev.target?.result as string
            }));
            setMosaicoArchivoNombre(file.name);
        };
        reader.readAsDataURL(file);
    };

    const guardarGaleriaMosaico = async (nuevaGaleria: GaleriaItem[]) => {
        setGuardandoMosaico(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/web-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clave: 'galeria_mosaico', valor: nuevaGaleria })
            });
            if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ['web-config'] });
                setMosaicoForm({ src: '', nombre: '', span: 'span-1', tagline: '', detalles: '' });
                setMosaicoArchivoNombre('');
                setEditandoMosaicoIndex(null);
            } else {
                alert('No se pudo guardar la galería.');
            }
        } catch {
            alert('Error de red al guardar la galería.');
        } finally {
            setGuardandoMosaico(false);
        }
    };

    const handleAñadirMosaico = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mosaicoForm.src) {
            alert('Debes subir o introducir una imagen para el mosaico');
            return;
        }
        if (!mosaicoForm.nombre) {
            alert('El nombre del plato/evento es requerido');
            return;
        }

        const item: GaleriaItem = {
            src: mosaicoForm.src,
            nombre: mosaicoForm.nombre.trim(),
            span: mosaicoForm.span || 'span-1',
            tagline: mosaicoForm.tagline?.trim() || '',
            detalles: mosaicoForm.detalles?.trim() || ''
        };

        let nuevaLista = [...galeriaItems];
        if (editandoMosaicoIndex !== null) {
            nuevaLista[editandoMosaicoIndex] = item;
        } else {
            nuevaLista.push(item);
        }

        await guardarGaleriaMosaico(nuevaLista);
    };

    const iniciarEdicionMosaico = (item: GaleriaItem, index: number) => {
        setMosaicoForm(item);
        setEditandoMosaicoIndex(index);
        setMosaicoArchivoNombre('Imagen cargada');
    };

    const eliminarMosaicoItem = async (indexAEliminar: number) => {
        if (!confirm('¿Eliminar esta foto de la galería?')) return;
        const filtrados = galeriaItems.filter((_, i) => i !== indexAEliminar);
        await guardarGaleriaMosaico(filtrados);
    };

    const tienePreview = formularioPromo.imagen_base64 || formularioPromo.imagen_url;
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
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Toast de Exito */}
            {exito && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium">
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        ¡Cambios publicados en la web pública!
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-lg p-2">
                    <MonitorSmartphone className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold font-serif text-foreground">Gestión Web</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Controla y actualiza los contenidos de la página pública jardin-web de forma dinámica
                    </p>
                </div>
            </div>

            <Tabs value={seccionActiva} onValueChange={setSeccionActiva} className="w-full">
                <TabsList className="bg-muted w-full sm:w-auto grid grid-cols-3">
                    <TabsTrigger value="promos" className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4" />
                        Promociones y Avisos
                    </TabsTrigger>
                    <TabsTrigger value="hero" className="flex items-center gap-1.5">
                        <Image className="w-4 h-4" />
                        Portada Hero
                    </TabsTrigger>
                    <TabsTrigger value="mosaico" className="flex items-center gap-1.5">
                        <Grid className="w-4 h-4" />
                        Galería Mosaico
                    </TabsTrigger>
                </TabsList>

                {/* ──────────────────────────────────────────────────────── */}
                {/* TAB 1: PROMOCIONES Y AVISOS */}
                {/* ──────────────────────────────────────────────────────── */}
                <TabsContent value="promos" className="mt-4 space-y-6">
                    {esEdicion && (
                        <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                            <span className="text-foreground font-medium">
                                ✏️ Editando Promoción: <strong>{formularioPromo.titulo || '...'}</strong>
                            </span>
                            <button onClick={resetFormularioPromo} className="text-primary hover:underline font-semibold">
                                Cancelar
                            </button>
                        </div>
                    )}

                    <Card className="bg-card border-border">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base text-foreground">Crear / Publicar Promoción o Evento</CardTitle>
                            <CardDescription className="text-muted-foreground">Sube fotos o videos breves de los eventos del restaurante</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4">
                            {/* Upload area */}
                            <div
                                className={`relative min-h-[160px] border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer flex flex-col items-center justify-center p-6
                                    ${arrastrando
                                        ? 'border-primary bg-primary/5 scale-[1.01]'
                                        : tienePreview
                                            ? 'border-emerald-500/30 bg-emerald-500/5'
                                            : 'border-border bg-muted/20 hover:border-primary/50'
                                    }`}
                                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                                onDragEnter={e => { e.preventDefault(); setArrastrando(true); }}
                                onDragLeave={e => { e.preventDefault(); setArrastrando(false); }}
                                onDrop={e => {
                                    e.preventDefault();
                                    setArrastrando(false);
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) procesarArchivoPromo(file);
                                }}
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
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="relative">
                                            {formularioPromo.tipo === 'video' ? (
                                                <video
                                                    src={formularioPromo.imagen_base64 || formularioPromo.imagen_url}
                                                    className="w-40 h-28 object-cover rounded-lg shadow-md border border-border"
                                                    autoPlay loop muted playsInline
                                                />
                                            ) : (
                                                <img
                                                    src={formularioPromo.imagen_base64 || formularioPromo.imagen_url}
                                                    alt="preview"
                                                    className="w-40 h-28 object-cover rounded-lg shadow-md border border-border"
                                                />
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFormularioPromo(prev => ({ ...prev, imagen_base64: undefined, imagen_url: undefined, tipo: 'imagen' }));
                                                    setArchivoNombre('');
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md hover:bg-red-700"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                        {archivoNombre && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{archivoNombre}</p>}
                                        <span className="text-xs text-primary hover:underline">Cambiar archivo</span>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                        <p className="text-sm font-medium text-foreground text-center">
                                            Arrastra un archivo aquí o haz clic para seleccionar
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">Imágenes y videos (máx 10MB)</p>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>O URL externa:</span>
                                <Input
                                    placeholder="https://... (link de imagen/video)"
                                    className="h-8 text-xs bg-background border-border text-foreground"
                                    value={formularioPromo.imagen_url || ''}
                                    onChange={e => {
                                        const url = e.target.value;
                                        const esVideo = /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes('video');
                                        setFormularioPromo(prev => ({ ...prev, imagen_url: url, tipo: esVideo ? 'video' : 'imagen' }));
                                    }}
                                />
                            </div>

                            {/* Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="promo-titulo" className="text-xs">Título de la Promo <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="promo-titulo"
                                        placeholder="Título del anuncio"
                                        value={formularioPromo.titulo || ''}
                                        onChange={e => setFormularioPromo(prev => ({ ...prev, titulo: e.target.value }))}
                                        className="bg-background border-border text-foreground"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Etiqueta (Badge)</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {BADGE_CHIPS.map(chip => (
                                            <button
                                                key={chip}
                                                type="button"
                                                onClick={() => setFormularioPromo(prev => ({
                                                    ...prev,
                                                    badge: prev.badge === chip ? '' : chip,
                                                }))}
                                                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all
                                                    ${formularioPromo.badge === chip
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                                                    }`}
                                            >
                                                {chip}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Opciones avanzadas */}
                            <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
                                <button
                                    type="button"
                                    onClick={() => setOpcionesAvanzadas(!opcionesAvanzadas)}
                                    className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-semibold text-muted-foreground hover:bg-accent/30 transition-colors"
                                >
                                    <span>⚙️ Opciones Avanzadas</span>
                                    {opcionesAvanzadas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                {opcionesAvanzadas && (
                                    <div className="p-3 border-t border-border space-y-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="promo-sub" className="text-xs">Subtítulo / Descripción:</Label>
                                            <Input
                                                id="promo-sub"
                                                placeholder="Subtítulo detallado"
                                                value={formularioPromo.subtitulo || ''}
                                                onChange={e => setFormularioPromo(prev => ({ ...prev, subtitulo: e.target.value }))}
                                                className="bg-background border-border text-foreground text-xs"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="promo-orden" className="text-xs">Orden (Prioridad):</Label>
                                                <Input
                                                    id="promo-orden"
                                                    type="number"
                                                    value={formularioPromo.orden || 1}
                                                    onChange={e => setFormularioPromo(prev => ({ ...prev, orden: parseInt(e.target.value) || 1 }))}
                                                    className="bg-background border-border text-foreground text-xs font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="promo-fin" className="text-xs">Fecha Fin (Expiración):</Label>
                                                <Input
                                                    id="promo-fin"
                                                    type="date"
                                                    value={formularioPromo.fecha_fin || ''}
                                                    onChange={e => setFormularioPromo(prev => ({ ...prev, fecha_fin: e.target.value }))}
                                                    className="bg-background border-border text-foreground text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={guardarPromo}
                                disabled={!formularioPromo.titulo || guardando}
                                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold h-11"
                            >
                                {guardando ? 'Publicando...' : esEdicion ? '💾 Guardar Cambios' : '📤 Publicar Promoción en la Web'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Lista de Promos */}
                    <div className="space-y-3">
                        <h3 className="font-serif font-bold text-lg text-foreground">Promociones Publicadas</h3>
                        {cargandoPromos ? (
                            <p className="text-center text-muted-foreground text-sm py-4">Cargando...</p>
                        ) : promosActivas.length === 0 && promosExpiradas.length === 0 ? (
                            <p className="text-center text-muted-foreground text-sm py-4 bg-card border border-border rounded-lg">No hay promociones creadas.</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {promosActivas.map(p => (
                                    <div key={p.id} className="bg-card border border-border rounded-lg overflow-hidden flex flex-col group relative">
                                        <div className="aspect-video bg-muted relative">
                                            {p.imagen_base64 || p.imagen_url ? (
                                                p.tipo === 'video' ? (
                                                    <video src={p.imagen_base64 || p.imagen_url} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                                                ) : (
                                                    <img src={p.imagen_base64 || p.imagen_url} className="w-full h-full object-cover" alt={p.titulo} />
                                                )
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><ImagePlus className="w-8 h-8 text-muted-foreground" /></div>
                                            )}
                                            {p.badge && <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">{p.badge}</span>}
                                        </div>
                                        <div className="p-3 flex-1 flex flex-col justify-between">
                                            <div>
                                                <h4 className="font-semibold text-sm text-foreground truncate">{p.titulo}</h4>
                                                {p.subtitulo && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{p.subtitulo}</p>}
                                            </div>
                                            <div className="flex gap-2 mt-3 pt-2 border-t border-border">
                                                <Button size="sm" variant="outline" className="flex-1 text-xs border-border hover:bg-accent" onClick={() => iniciarEdicionPromo(p)}>Editar</Button>
                                                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-500 hover:bg-red-500/10 p-2" onClick={() => eliminarPromo(p.id, p.titulo)}><Trash2 className="w-4 h-4" /></Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ──────────────────────────────────────────────────────── */}
                {/* TAB 2: PORTADA HERO SLIDESHOW */}
                {/* ──────────────────────────────────────────────────────── */}
                <TabsContent value="hero" className="mt-4 space-y-6">
                    <Card className="bg-card border-border">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base text-foreground">Imágenes de Portada (Slideshow)</CardTitle>
                            <CardDescription className="text-muted-foreground">Administra el fondo rotativo de la pantalla de bienvenida. Se recomienda tamaño horizontal de buena resolución.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4">
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                {/* Selector de archivos */}
                                <div className="w-full sm:w-1/2">
                                    <input
                                        ref={inputHeroRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) procesarArchivoHero(file);
                                        }}
                                    />
                                    <Button
                                        onClick={() => inputHeroRef.current?.click()}
                                        className="w-full h-24 border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/10 flex flex-col gap-2 items-center justify-center rounded-xl bg-muted/5 text-foreground"
                                    >
                                        <ImagePlus className="w-6 h-6 text-primary" />
                                        <span className="text-xs font-semibold">Subir nueva imagen</span>
                                    </Button>
                                </div>

                                {/* O subir por link */}
                                <div className="w-full sm:w-1/2 space-y-2">
                                    <Label htmlFor="hero-link" className="text-xs text-muted-foreground">O introduce una URL externa de la foto:</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="hero-link"
                                            placeholder="https://.../imagen.jpg"
                                            value={heroUrl}
                                            onChange={e => setHeroUrl(e.target.value)}
                                            className="bg-background border-border text-foreground text-xs"
                                        />
                                        <Button
                                            disabled={!heroUrl.trim() || guardandoHero}
                                            onClick={() => guardarHeroSlides([...heroSlides, heroUrl.trim()])}
                                            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 font-bold"
                                        >
                                            Añadir
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Listado visual */}
                            <div className="space-y-3">
                                <Label className="text-xs font-bold text-foreground">Slideshow Actual ({heroSlides.length} fotos):</Label>
                                {cargandoConfig ? (
                                    <p className="text-center text-sm text-muted-foreground py-4">Cargando...</p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {heroSlides.map((slide, idx) => (
                                            <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-border group">
                                                <img src={slide} className="w-full h-full object-cover" alt={`Slide ${idx + 1}`} />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-400 hover:text-red-500 hover:bg-red-500/10 p-2"
                                                        onClick={() => eliminarHeroSlide(idx)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                                                    #{idx + 1}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ──────────────────────────────────────────────────────── */}
                {/* TAB 3: GALERÍA MOSAICO */}
                {/* ──────────────────────────────────────────────────────── */}
                <TabsContent value="mosaico" className="mt-4 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Formulario */}
                        <Card className="bg-card border-border h-fit">
                            <CardHeader className="p-4">
                                <CardTitle className="text-base text-foreground flex items-center gap-1.5">
                                    <Plus className="w-5 h-5 text-primary" />
                                    {editandoMosaicoIndex !== null ? 'Editar Elemento' : 'Añadir a Galería'}
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">Configura un recuadro de la Galería Mosaico</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <form onSubmit={handleAñadirMosaico} className="space-y-4">
                                    {/* Upload area */}
                                    <div
                                        onClick={() => inputMosaicoRef.current?.click()}
                                        className="h-28 border border-dashed border-border rounded-lg bg-muted/10 flex flex-col items-center justify-center cursor-pointer p-4 hover:border-primary/50 text-center"
                                    >
                                        <input
                                            ref={inputMosaicoRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) procesarArchivoMosaico(file);
                                            }}
                                        />
                                        {mosaicoForm.src ? (
                                            <div className="flex items-center gap-3">
                                                <img src={mosaicoForm.src} className="w-16 h-16 object-cover rounded border border-border" />
                                                <div className="text-left">
                                                    <span className="text-xs text-primary font-bold block">Foto cargada</span>
                                                    <span className="text-[10px] text-muted-foreground block truncate max-w-[120px]">{mosaicoArchivoNombre}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <ImagePlus className="w-6 h-6 text-primary mb-1" />
                                                <span className="text-xs font-semibold text-foreground">Subir Foto</span>
                                                <span className="text-[10px] text-muted-foreground">O introduce link abajo</span>
                                            </>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="mos-link" className="text-[10px] text-muted-foreground">URL Externa de la foto (Opcional):</Label>
                                        <Input
                                            id="mos-link"
                                            placeholder="https://.../foto.jpg"
                                            value={mosaicoForm.src && !mosaicoForm.src.startsWith('data:') ? mosaicoForm.src : ''}
                                            onChange={e => setMosaicoForm(prev => ({ ...prev, src: e.target.value }))}
                                            className="bg-background border-border text-foreground text-xs"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="mos-nombre" className="text-xs">Nombre plato / evento <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="mos-nombre"
                                            placeholder="Ej. Charque K'Full"
                                            value={mosaicoForm.nombre || ''}
                                            onChange={e => setMosaicoForm(prev => ({ ...prev, nombre: e.target.value }))}
                                            className="bg-background border-border text-foreground text-xs"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5 col-span-2">
                                            <Label htmlFor="mos-span" className="text-xs">Tamaño de Cuadrícula:</Label>
                                            <select
                                                id="mos-span"
                                                value={mosaicoForm.span}
                                                onChange={e => setMosaicoForm(prev => ({ ...prev, span: e.target.value }))}
                                                className="w-full bg-background border border-border text-foreground rounded-md p-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                            >
                                                <option value="span-1">Cuadrado estándar (1x1)</option>
                                                <option value="span-2-col">Ancho (2 columnas x 1)</option>
                                                <option value="span-2-row">Alto (1 columna x 2)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="mos-tagline" className="text-xs">Línea descriptiva corta:</Label>
                                        <Input
                                            id="mos-tagline"
                                            placeholder="Ej. Tradicional y crujiente"
                                            value={mosaicoForm.tagline || ''}
                                            onChange={e => setMosaicoForm(prev => ({ ...prev, tagline: e.target.value }))}
                                            className="bg-background border-border text-foreground text-xs"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="mos-detalles" className="text-xs">Detalle emergente completo:</Label>
                                        <Input
                                            id="mos-detalles"
                                            placeholder="Ej. Servido con mote, queso criollo..."
                                            value={mosaicoForm.detalles || ''}
                                            onChange={e => setMosaicoForm(prev => ({ ...prev, detalles: e.target.value }))}
                                            className="bg-background border-border text-foreground text-xs"
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            type="submit"
                                            disabled={guardandoMosaico || !mosaicoForm.nombre || !mosaicoForm.src}
                                            className="flex-1 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs"
                                        >
                                            {editandoMosaicoIndex !== null ? '💾 Guardar Elemento' : '➕ Añadir Elemento'}
                                        </Button>
                                        {editandoMosaicoIndex !== null && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setMosaicoForm({ src: '', nombre: '', span: 'span-1', tagline: '', detalles: '' });
                                                    setEditandoMosaicoIndex(null);
                                                    setMosaicoArchivoNombre('');
                                                }}
                                                className="border-border hover:bg-accent text-foreground text-xs"
                                            >
                                                Cancelar
                                            </Button>
                                        )}
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Listado en Mosaico */}
                        <Card className="col-span-1 lg:col-span-2 bg-card border-border">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-base text-foreground">Galería Mosaico Actual ({galeriaItems.length})</CardTitle>
                                <CardDescription className="text-muted-foreground">Listado de fotos de la cocina en la página web pública</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                {cargandoConfig ? (
                                    <p className="text-center text-sm text-muted-foreground py-8">Cargando...</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {galeriaItems.map((item, index) => {
                                            const spanLabel = item.span === 'span-2-col' ? 'Ancho (2x1)' : item.span === 'span-2-row' ? 'Alto (1x2)' : 'Estándar (1x1)';
                                            return (
                                                <div key={index} className="flex gap-3 p-2 border border-border rounded-lg bg-muted/10 hover:bg-accent/10 transition-colors">
                                                    <img src={item.src} className="w-16 h-16 object-cover rounded border border-border shrink-0" alt={item.nombre} />
                                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                        <div>
                                                            <div className="flex justify-between items-start">
                                                                <h4 className="font-semibold text-xs text-foreground truncate">{item.nombre}</h4>
                                                                <Badge className="text-[9px] bg-primary/20 text-primary border-none p-0.5">{spanLabel}</Badge>
                                                            </div>
                                                            {item.tagline && <p className="text-[10px] text-muted-foreground truncate">{item.tagline}</p>}
                                                        </div>
                                                        <div className="flex justify-end gap-1.5">
                                                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-border hover:bg-accent" onClick={() => iniciarEdicionMosaico(item, index)}>Editar</Button>
                                                            <Button size="sm" variant="ghost" className="h-6 text-red-400 hover:text-red-500 hover:bg-red-500/10 px-2" onClick={() => eliminarMosaicoItem(index)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );

    function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            if (seccionActiva === 'promos') procesarArchivoPromo(file);
        }
    }
}
