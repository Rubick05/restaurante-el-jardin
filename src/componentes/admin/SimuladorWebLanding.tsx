import React, { useState, useEffect } from 'react';
import { 
    Smartphone, Monitor, ExternalLink, Sparkles, Calendar, 
    MapPin, Phone, MessageCircle, Clock, ChevronRight, Eye, RefreshCw 
} from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { Badge } from '@/componentes/ui/badge';

interface SimuladorWebLandingProps {
    heroSlides: string[];
    promociones: any[];
    galeriaItems: any[];
    formularioPromo: any;
    mosaicoForm: any;
    seccionActiva: string;
}

export default function SimuladorWebLanding({
    heroSlides,
    promociones,
    galeriaItems,
    formularioPromo,
    mosaicoForm,
    seccionActiva,
}: SimuladorWebLandingProps) {
    const [dispositivo, setDispositivo] = useState<'movil' | 'escritorio'>('movil');
    const [slideActivo, setSlideActivo] = useState(0);
    const [seccionVisual, setSeccionVisual] = useState<'todo' | 'hero' | 'promos' | 'mosaico'>('todo');

    // Auto-rotar slide cada 5 segundos si hay más de uno
    useEffect(() => {
        if (!heroSlides || heroSlides.length <= 1) return;
        const interval = setInterval(() => {
            setSlideActivo(prev => (prev + 1) % heroSlides.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [heroSlides]);

    // Sincronizar foco con la pestaña activa del panel de administración
    useEffect(() => {
        if (seccionActiva === 'hero') setSeccionVisual('hero');
        else if (seccionActiva === 'promos') setSeccionVisual('promos');
        else if (seccionActiva === 'mosaico') setSeccionVisual('mosaico');
        else setSeccionVisual('todo');
    }, [seccionActiva]);

    const activeSlideUrl = heroSlides[slideActivo] || '/hero-el-jardin.jpg';

    // Promo en vivo (lo que se está editando en el formulario)
    const tienePromoEnEdicion = Boolean(
        formularioPromo.titulo || 
        formularioPromo.subtitulo || 
        formularioPromo.imagen_base64 || 
        formularioPromo.imagen_url
    );

    const promoBorrador = tienePromoEnEdicion ? {
        id: 'draft',
        titulo: formularioPromo.titulo || 'Título de tu anuncio...',
        subtitulo: formularioPromo.subtitulo || 'Descripción del evento o promoción...',
        badge: formularioPromo.badge || 'Vista Previa',
        tipo: formularioPromo.tipo || 'imagen',
        imagen_url: formularioPromo.imagen_url,
        imagen_base64: formularioPromo.imagen_base64,
        esBorrador: true,
    } : null;

    // Lista combinada de promociones a mostrar en el preview
    const listaPromosPreview = promoBorrador 
        ? [promoBorrador, ...promociones.filter(p => p.id !== formularioPromo.id)]
        : promociones;

    return (
        <div className="flex flex-col h-full bg-card/60 border border-border/80 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
            {/* Header de la Barra de Herramientas del Simulador */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        Vista Previa en Vivo
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-primary/20">
                        {dispositivo === 'movil' ? 'Móvil (375px)' : 'Escritorio'}
                    </Badge>
                </div>

                <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60">
                    <button
                        type="button"
                        onClick={() => setDispositivo('movil')}
                        title="Simular Celular"
                        className={`p-1.5 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                            dispositivo === 'movil' 
                                ? 'bg-background text-foreground shadow-sm font-semibold' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-[11px]">Celular</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setDispositivo('escritorio')}
                        title="Simular Escritorio"
                        className={`p-1.5 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                            dispositivo === 'escritorio' 
                                ? 'bg-background text-foreground shadow-sm font-semibold' 
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Monitor className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-[11px]">Escritorio</span>
                    </button>
                </div>

                <a
                    href="http://localhost:5173"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
                >
                    Abrir web <ExternalLink className="w-3 h-3" />
                </a>
            </div>

            {/* Filtros de sección rápida dentro del simulador */}
            <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1 text-[11px]">
                <span className="text-muted-foreground text-[10px] font-semibold mr-1">Enfoque:</span>
                {[
                    { id: 'todo', label: 'Toda la Web' },
                    { id: 'hero', label: 'Portada Hero' },
                    { id: 'promos', label: 'Promos & Eventos' },
                    { id: 'mosaico', label: 'Galería Cocina' },
                ].map(item => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setSeccionVisual(item.id as any)}
                        className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                            seccionVisual === item.id
                                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                                : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Contenedor del Dispositivo / Mockup */}
            <div className="flex-1 flex items-center justify-center min-h-[580px] max-h-[750px] overflow-hidden bg-gradient-to-b from-stone-950/80 to-stone-900/90 rounded-xl p-2 border border-stone-800 relative">
                {dispositivo === 'movil' ? (
                    /* ─── FRAME DE CELULAR ─── */
                    <div className="w-[340px] sm:w-[365px] h-[640px] bg-stone-950 rounded-[38px] p-2.5 shadow-2xl border-[5px] border-stone-800 flex flex-col relative select-none">
                        {/* Notch de bocina y cámara */}
                        <div className="w-32 h-4 bg-stone-900 rounded-b-xl mx-auto flex items-center justify-center gap-2 mb-1 z-30 shrink-0">
                            <div className="w-2.5 h-2.5 rounded-full bg-stone-950 border border-stone-800" />
                            <div className="w-10 h-1 bg-stone-800 rounded-full" />
                        </div>

                        {/* Pantalla interior scrolleable */}
                        <div className="flex-1 overflow-y-auto rounded-[28px] bg-[#121110] text-stone-100 font-sans border border-stone-800/80 shadow-inner relative flex flex-col scrollbar-thin scrollbar-thumb-stone-700">
                            {/* Navbar Simulado de El Jardín */}
                            <header className="sticky top-0 z-20 bg-stone-950/90 backdrop-blur-md border-b border-stone-800 px-3 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <img 
                                        src="/logo-el-jardin.jpg" 
                                        alt="Logo El Jardín" 
                                        className="w-7 h-7 rounded-full object-cover border border-amber-600/60"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                        }}
                                    />
                                    <div>
                                        <h4 className="text-xs font-black tracking-wide text-amber-100 font-serif leading-none">EL JARDÍN</h4>
                                        <span className="text-[8px] text-amber-500/90 tracking-widest font-bold uppercase block mt-0.5">TRADICIÓN K'OCHALA</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 text-[8px] bg-emerald-950 text-emerald-400 font-bold px-1.5 py-0.5 rounded-full border border-emerald-800/60">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                        Abierto
                                    </span>
                                </div>
                            </header>

                            {/* Contenido scrolleable de la Landing */}
                            <div className="space-y-4 pb-12">
                                {/* SECCIÓN 1: HERO */}
                                {(seccionVisual === 'todo' || seccionVisual === 'hero') && (
                                    <div className="relative min-h-[220px] bg-stone-900 overflow-hidden flex flex-col justify-end p-4 border-b border-stone-800 group">
                                        <img 
                                            src={activeSlideUrl} 
                                            alt="Hero Slide" 
                                            className="absolute inset-0 w-full h-full object-cover brightness-[0.45] transition-all duration-700" 
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />
                                        
                                        <div className="relative z-10 space-y-1.5">
                                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                Peña · Restaurant
                                            </span>
                                            <h2 className="text-xl font-bold font-serif text-white leading-tight">
                                                Tradición K'ochala
                                            </h2>
                                            <p className="text-[10px] text-stone-300 line-clamp-2">
                                                Especialistas en comida tradicional cochabambina. Jueves de Fideos Uchu y música folclórica en vivo.
                                            </p>

                                            <div className="flex items-center gap-2 pt-2">
                                                <button className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-black text-[10px] px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1 transition-transform active:scale-95">
                                                    <MessageCircle className="w-3 h-3" />
                                                    Reservar Mesa
                                                </button>
                                                <button className="bg-stone-900/80 border border-stone-700 text-stone-200 text-[10px] px-2.5 py-1.5 rounded-lg">
                                                    Ver Menú
                                                </button>
                                            </div>

                                            {/* Indicadores de slides */}
                                            {heroSlides.length > 1 && (
                                                <div className="flex items-center gap-1 pt-1 justify-center">
                                                    {heroSlides.map((_, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => setSlideActivo(i)}
                                                            className={`h-1 rounded-full transition-all ${
                                                                i === slideActivo ? 'w-4 bg-amber-400' : 'w-1.5 bg-stone-600'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* SECCIÓN 2: EVENTOS Y PROMOCIONES */}
                                {(seccionVisual === 'todo' || seccionVisual === 'promos') && (
                                    <div className="px-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-[9px] font-bold text-amber-500 tracking-wider uppercase">Cartelera Semanal</span>
                                                <h3 className="text-xs font-bold text-white font-serif">Eventos & Promociones</h3>
                                            </div>
                                            <span className="text-[9px] text-stone-400">({listaPromosPreview.length} activos)</span>
                                        </div>

                                        {/* Tarjeta destacada si se está editando en vivo */}
                                        {promoBorrador && (
                                            <div className="p-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 shadow-lg space-y-2 relative overflow-hidden animate-pulse">
                                                <div className="flex items-center justify-between">
                                                    <Badge className="bg-amber-500 text-stone-950 font-bold text-[9px] px-1.5 py-0">
                                                        ⚡ EDITANDO AHORA
                                                    </Badge>
                                                    {promoBorrador.badge && (
                                                        <span className="text-[9px] font-semibold text-amber-300">
                                                            {promoBorrador.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="aspect-video rounded-lg overflow-hidden bg-stone-900 border border-stone-800 relative">
                                                    {promoBorrador.imagen_base64 || promoBorrador.imagen_url ? (
                                                        <img 
                                                            src={promoBorrador.imagen_base64 || promoBorrador.imagen_url} 
                                                            alt="Preview borrador" 
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-500">
                                                            Subiendo imagen...
                                                        </div>
                                                    )}
                                                </div>
                                                <h4 className="text-xs font-bold text-white truncate">{promoBorrador.titulo}</h4>
                                                <p className="text-[10px] text-stone-300 line-clamp-2">{promoBorrador.subtitulo}</p>
                                                <button className="w-full bg-amber-500 text-stone-950 font-bold text-[10px] py-1 rounded-md flex items-center justify-center gap-1">
                                                    <MessageCircle className="w-3 h-3" /> ¡Me interesa!
                                                </button>
                                            </div>
                                        )}

                                        {/* Lista de promos publicadas */}
                                        <div className="space-y-2">
                                            {listaPromosPreview.filter(p => !p.esBorrador).slice(0, 3).map((promo, idx) => (
                                                <div key={promo.id || idx} className="p-2 rounded-lg bg-stone-900/80 border border-stone-800 flex gap-2.5 items-center">
                                                    <div className="w-14 h-14 rounded-md overflow-hidden bg-stone-800 shrink-0 border border-stone-700/60">
                                                        <img 
                                                            src={promo.imagen_base64 || promo.imagen_url || '/hero-el-jardin.jpg'} 
                                                            alt={promo.titulo} 
                                                            className="w-full h-full object-cover" 
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        {promo.badge && (
                                                            <span className="text-[8px] bg-amber-500/20 text-amber-400 font-bold px-1 py-0.2 rounded">
                                                                {promo.badge}
                                                            </span>
                                                        )}
                                                        <h5 className="text-[11px] font-bold text-stone-200 truncate mt-0.5">{promo.titulo}</h5>
                                                        <p className="text-[9px] text-stone-400 line-clamp-1">{promo.subtitulo || 'Especial cochabambino'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* SECCIÓN 3: GALERÍA MOSAICO */}
                                {(seccionVisual === 'todo' || seccionVisual === 'mosaico') && (
                                    <div className="px-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-[9px] font-bold text-amber-500 tracking-wider uppercase">Nuestra Cocina</span>
                                                <h3 className="text-xs font-bold text-white font-serif">Galería de Tradición</h3>
                                            </div>
                                            <span className="text-[9px] text-stone-400">({galeriaItems.length} platos)</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5">
                                            {galeriaItems.map((item, idx) => {
                                                const esAncho = item.span === 'span-2-col';
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        className={`relative rounded-lg overflow-hidden bg-stone-900 border border-stone-800 group ${
                                                            esAncho ? 'col-span-2 aspect-[2/1]' : 'aspect-square'
                                                        }`}
                                                    >
                                                        <img 
                                                            src={item.src} 
                                                            alt={item.nombre} 
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/20 to-transparent flex flex-col justify-end p-1.5">
                                                            <span className="text-[10px] font-bold text-white leading-tight">{item.nombre}</span>
                                                            {item.tagline && (
                                                                <span className="text-[8px] text-amber-300 truncate">{item.tagline}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* SECCIÓN 4: CONTACTO & UBICACIÓN (FACEBOOK IDENTITY) */}
                                {(seccionVisual === 'todo') && (
                                    <div className="mx-3 p-3 rounded-xl bg-stone-900/90 border border-stone-800 space-y-2">
                                        <h4 className="text-[11px] font-bold text-amber-400 font-serif">Ubicación y Contacto</h4>
                                        <div className="space-y-1.5 text-[9px] text-stone-300">
                                            <div className="flex items-start gap-1.5">
                                                <MapPin className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                                <span>Av. Final Melchor Pérez sud 3er puente mano derecha, Cochabamba</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                                                <span>Jueves: 11:00-23:00 · Sáb y Dom: 12:00-23:00</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Phone className="w-3 h-3 text-amber-500 shrink-0" />
                                                <span>+591 78418801</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Barra de pie simulada con WhatsApp flotante */}
                            <div className="sticky bottom-0 bg-stone-950/95 border-t border-stone-800 px-3 py-1.5 flex items-center justify-between text-[10px]">
                                <span className="text-stone-400 font-medium">Restaurante El Jardín</span>
                                <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1 text-[9px]">
                                    <MessageCircle className="w-2.5 h-2.5" /> +591 78418801
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ─── FRAME DE ESCRITORIO / PANTALLA COMPLETA ─── */
                    <div className="w-full h-full max-h-[640px] bg-stone-950 rounded-xl shadow-2xl border border-stone-800 flex flex-col overflow-hidden">
                        {/* Barra del navegador web */}
                        <div className="bg-stone-900 border-b border-stone-800 px-3 py-1.5 flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                            </div>
                            <div className="flex-1 max-w-sm mx-auto bg-stone-950 rounded-md px-3 py-0.5 text-[10px] text-stone-400 font-mono text-center border border-stone-800 flex items-center justify-center gap-1">
                                🔒 eljardintradicionkochala.bo
                            </div>
                        </div>

                        {/* Pantalla web scrolleable */}
                        <div className="flex-1 overflow-y-auto bg-[#121110] text-stone-100 p-4 space-y-6 scrollbar-thin scrollbar-thumb-stone-700">
                            {/* Header Web */}
                            <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                                <div className="flex items-center gap-3">
                                    <img src="/logo-el-jardin.jpg" alt="Logo" className="w-9 h-9 rounded-full object-cover border border-amber-600" />
                                    <div>
                                        <h3 className="font-serif font-black text-amber-200 text-sm">EL JARDÍN</h3>
                                        <p className="text-[9px] tracking-widest text-amber-500 uppercase font-bold">PEÑA · RESTAURANT · TRADICIÓN K'OCHALA</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-stone-300 font-medium">
                                    <span className="text-amber-400 font-bold">Inicio</span>
                                    <span>Nuestra Cocina</span>
                                    <span>Menú</span>
                                    <span>Eventos</span>
                                    <span>Contacto</span>
                                </div>
                            </div>

                            {/* Hero Banner Web */}
                            <div className="relative h-44 rounded-xl overflow-hidden flex items-center px-8 border border-stone-800">
                                <img src={activeSlideUrl} alt="Hero" className="absolute inset-0 w-full h-full object-cover brightness-[0.4]" />
                                <div className="relative z-10 space-y-2 max-w-md">
                                    <Badge className="bg-amber-500 text-stone-950 font-bold text-[10px]">Cochabamba, Bolivia</Badge>
                                    <h1 className="text-2xl font-serif font-bold text-white">Tradición K'ochala</h1>
                                    <p className="text-xs text-stone-300">Los mejores platos típicos, peña en vivo y fideos uchu los jueves.</p>
                                </div>
                            </div>

                            {/* Promociones Web */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-serif">Eventos de la Semana</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {listaPromosPreview.slice(0, 3).map((p, idx) => (
                                        <div key={p.id || idx} className="rounded-lg bg-stone-900 border border-stone-800 overflow-hidden space-y-1.5 p-2">
                                            <div className="aspect-video bg-stone-800 rounded overflow-hidden">
                                                <img src={p.imagen_base64 || p.imagen_url || '/hero-el-jardin.jpg'} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-bold text-amber-400">{p.badge || 'Evento'}</span>
                                            </div>
                                            <h5 className="text-xs font-bold text-stone-200 truncate">{p.titulo}</h5>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Galería Web */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-serif">Nuestra Cocina</h4>
                                <div className="grid grid-cols-4 gap-2">
                                    {galeriaItems.slice(0, 4).map((item, idx) => (
                                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-stone-900 border border-stone-800">
                                            <img src={item.src} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-end p-2">
                                                <span className="text-[10px] font-bold text-white truncate">{item.nombre}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
