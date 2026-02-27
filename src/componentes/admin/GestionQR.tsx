import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/componentes/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { QrCode, Upload, Trash2, RefreshCw, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// QR se guarda en una entry especial de elementosMenu con id='qr-restaurante'
const QR_KEY = 'qr-restaurante-imagen';
const QR_UPDATED_KEY = 'qr-restaurante-fecha';

export default function GestionQR() {
    const queryClient = useQueryClient();
    const inputRef = useRef<HTMLInputElement>(null);
    const [subiendo, setSubiendo] = useState(false);

    // Leer QR del localStorage
    const { data: qrData } = useQuery({
        queryKey: ['qr-admin'],
        queryFn: () => ({
            imagen: localStorage.getItem(QR_KEY),
            fecha: localStorage.getItem(QR_UPDATED_KEY),
        }),
    });

    const handleSubirQR = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona una imagen');
            return;
        }
        setSubiendo(true);

        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target?.result as string;
            localStorage.setItem(QR_KEY, base64);
            localStorage.setItem(QR_UPDATED_KEY, new Date().toISOString());
            queryClient.invalidateQueries({ queryKey: ['qr-admin'] });
            setSubiendo(false);
        };
        reader.readAsDataURL(file);
    };

    const handleEliminar = () => {
        if (!confirm('¿Eliminar el QR actual?')) return;
        localStorage.removeItem(QR_KEY);
        localStorage.removeItem(QR_UPDATED_KEY);
        queryClient.invalidateQueries({ queryKey: ['qr-admin'] });
    };

    const fechaActualizacion = qrData?.fecha
        ? format(new Date(qrData.fecha), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })
        : null;

    // Calcula si el QR tiene más de 7 días (vencido)
    const qrVencido = qrData?.fecha
        ? (Date.now() - new Date(qrData.fecha).getTime()) > 7 * 24 * 60 * 60 * 1000
        : false;

    return (
        <div className="space-y-6 p-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
                    <QrCode className="w-6 h-6 text-primary" />
                    Gestión de QR
                </h2>
            </div>

            <p className="text-sm text-muted-foreground">
                Sube la imagen QR del menú o de tu negocio. Se recomienda renovarla cada semana.
                El QR se guarda en este dispositivo.
            </p>

            {/* Alerta de QR vencido */}
            {qrVencido && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-amber-800 text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span>El QR tiene más de 7 días. Se recomienda renovarlo.</span>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                {/* Previsualización */}
                <Card className="overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Vista previa del QR</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {qrData?.imagen ? (
                            <div className="space-y-3">
                                <img
                                    src={qrData.imagen}
                                    alt="QR del restaurante"
                                    className="w-full max-w-[240px] mx-auto rounded-lg border shadow-sm"
                                />
                                {fechaActualizacion && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-center">
                                        <Calendar className="w-3 h-3" />
                                        Actualizado: {fechaActualizacion}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 opacity-40">
                                <QrCode className="w-16 h-16 mb-3 text-slate-300" />
                                <p className="text-sm text-muted-foreground">Sin QR cargado</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Acciones */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Acciones</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleSubirQR}
                        />

                        <Button
                            className="w-full gap-2"
                            onClick={() => inputRef.current?.click()}
                            disabled={subiendo}
                        >
                            <Upload className="w-4 h-4" />
                            {qrData?.imagen ? 'Reemplazar QR' : 'Subir QR'}
                        </Button>

                        {qrData?.imagen && (
                            <Button
                                variant="destructive"
                                className="w-full gap-2"
                                onClick={handleEliminar}
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar QR
                            </Button>
                        )}

                        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                            <p>• Formatos aceptados: PNG, JPG, WebP</p>
                            <p>• Se recomienda renovar el QR cada semana</p>
                            <p>• El QR se guarda en este dispositivo</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
