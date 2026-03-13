import { MonitorSmartphone } from 'lucide-react';

export default function VistaLanding() {
    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center justify-between shrink-0">
                <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
                    <MonitorSmartphone className="w-6 h-6 text-primary" />
                    Sitio Web Público
                </h2>
                <a
                    href="https://jardin-web-flax.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-amber-600 hover:text-amber-800 underline"
                >
                    Abrir en nueva pestaña
                </a>
            </div>
            
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <iframe 
                    src="https://jardin-web-flax.vercel.app/" 
                    className="w-full h-full border-0"
                    title="Landing Page El Jardín"
                />
            </div>
        </div>
    );
}
