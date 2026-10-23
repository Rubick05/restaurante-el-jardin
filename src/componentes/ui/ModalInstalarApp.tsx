import { useState, useEffect } from 'react';
import { Download, Smartphone, Apple, CheckCircle2, Share2, PlusSquare, X } from 'lucide-react';

interface Props {
    abierto: boolean;
    alCerrar: () => void;
}

export default function ModalInstalarApp({ abierto, alCerrar }: Props) {
    const [pestaña, setPestaña] = useState<'ios' | 'android'>('android');
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [instalada, setInstalada] = useState(false);
    const [esIos, setEsIos] = useState(false);

    useEffect(() => {
        // Detectar si está en iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const esDispositivoIos = /iphone|ipad|ipod/.test(userAgent);
        setEsIos(esDispositivoIos);
        if (esDispositivoIos) {
            setPestaña('ios');
        }

        // Detectar si ya está en modo Standalone PWA
        const esStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (esStandalone) {
            setInstalada(true);
        }

        // Capturar evento PWA en Android / Chrome
        const handleBeforeInstall = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }, []);

    if (!abierto) return null;

    const handleInstalarPWA = async () => {
        if (!deferredPrompt) {
            alert('Para instalar, pulsa en los 3 puntos de tu navegador (⋮) y selecciona "Añadir a la pantalla de inicio" o "Instalar aplicación".');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setInstalada(true);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Instalar El Jardín App</h3>
                            <p className="text-xs text-muted-foreground">Funciona en iPhone, iPad, Android y PC</p>
                        </div>
                    </div>
                    <button
                        onClick={alCerrar}
                        className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Switch de Plataformas */}
                <div className="px-6 pt-4 pb-2">
                    <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-2xl border border-border/50">
                        <button
                            onClick={() => setPestaña('android')}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                pestaña === 'android'
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Smartphone className="w-4 h-4" />
                            Android (APK / PWA)
                        </button>
                        <button
                            onClick={() => setPestaña('ios')}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                pestaña === 'ios'
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Apple className="w-4 h-4" />
                            iPhone / iPad (iOS)
                        </button>
                    </div>
                </div>

                {/* Contenido con scroll */}
                <div className="p-6 overflow-y-auto space-y-5 text-sm">
                    {instalada && (
                        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <span>¡Ya estás ejecutando la aplicación instalada!</span>
                        </div>
                    )}

                    {pestaña === 'ios' ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl space-y-3">
                                <div className="flex items-center gap-2 text-foreground font-semibold text-xs uppercase tracking-wider">
                                    <Apple className="w-4 h-4 text-primary" />
                                    Cómo instalar en iOS (Sin App Store y Gratis):
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    En iOS de Apple los archivos APK no pueden ejecutarse, pero puedes instalarla directamente como <strong className="text-foreground">PWA de pantalla completa</strong> desde Safari con estos 3 pasos:
                                </p>

                                <div className="space-y-2.5 pt-1">
                                    <div className="flex items-start gap-3 p-3 bg-card rounded-xl border border-border/50">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                            1
                                        </div>
                                        <div className="text-xs text-foreground">
                                            Abre este enlace desde el navegador <strong className="text-primary font-semibold">Safari</strong> en tu iPhone o iPad.
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 bg-card rounded-xl border border-border/50">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                            2
                                        </div>
                                        <div className="text-xs text-foreground flex-1">
                                            Toca el botón <strong className="text-primary font-semibold">Compartir</strong> en la barra inferior de Safari.
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded-md ml-1 text-muted-foreground">
                                                <Share2 className="w-3.5 h-3.5 text-primary" /> <span>Compartir</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 bg-card rounded-xl border border-border/50">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                            3
                                        </div>
                                        <div className="text-xs text-foreground flex-1">
                                            Desliza hacia abajo y pulsa <strong className="text-primary font-semibold">"Añadir a pantalla de inicio"</strong>.
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded-md ml-1 text-muted-foreground">
                                                <PlusSquare className="w-3.5 h-3.5 text-primary" /> <span>Añadir</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl text-xs text-primary/90 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>Aparecerá en el inicio de tu iPhone con el icono oficial y abrirá a pantalla completa sin barra de navegación.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                En Android dispones de dos opciones recomendadas: instalar la aplicación web ligera (PWA) o descargar el instalador nativo APK oficial.
                            </p>

                            {/* Opción 1: PWA Instantánea */}
                            <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                                        Opción 1: App Web Ligera (PWA)
                                    </span>
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full">
                                        Rápida y Ligera
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Se instala en segundos, se actualiza automáticamente y no ocupa espacio de almacenamiento.
                                </p>
                                <button
                                    onClick={handleInstalarPWA}
                                    className="w-full py-2.5 px-4 bg-secondary hover:bg-secondary/90 text-foreground font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition"
                                >
                                    <Smartphone className="w-4 h-4 text-primary" />
                                    Añadir a Pantalla de Inicio
                                </button>
                            </div>

                            {/* Opción 2: APK Nativo */}
                            <div className="p-4 bg-primary/10 border border-primary/30 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                                        Opción 2: APK Oficial Nativo
                                    </span>
                                    <span className="text-[10px] bg-primary/20 text-primary font-semibold px-2 py-0.5 rounded-full">
                                        Firma Oficial
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Compilado nativamente con Capacitor y firmado con Keystore de producción. Puedes sobreinstalar versiones nuevas sin perder datos.
                                </p>
                                <a
                                    href="https://github.com/Rubick05/restaurante-el-jardin/releases/download/latest-apk/El-Jardin-Restaurante.apk"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full py-2.5 px-4 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md active:scale-[0.99]"
                                >
                                    <Download className="w-4 h-4" />
                                    Descargar APK Oficial (v1.0)
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border/50 bg-muted/10 text-center">
                    <button
                        onClick={alCerrar}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                    >
                        Entendido, cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
