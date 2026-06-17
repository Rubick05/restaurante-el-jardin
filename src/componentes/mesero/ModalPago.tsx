import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/componentes/ui/dialog";
import { Button } from "@/componentes/ui/button";
import { ItemCarrito } from "./CarritoPedido";
import { QrCode, Banknote, CheckCircle2 } from "lucide-react";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: ItemCarrito[];
    total: number;
    onConfirmarPago: (metodo: 'efectivo' | 'qr') => void;
    procesando: boolean;
}

export function ModalPago({ open, onOpenChange, items, total, onConfirmarPago, procesando }: Props) {
    const [metodoPago, setMetodoPago] = useState<'efectivo' | 'qr' | null>(null);
    const [tipoDocumento, setTipoDocumento] = useState<'recibo' | 'factura'>('recibo');
    const [nit, setNit] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [qrImagen, setQrImagen] = useState<string | null>(null);

    // Leer la imagen QR del localStorage para consistencia
    useEffect(() => {
        if (open) {
            setQrImagen(localStorage.getItem('qr-restaurante-imagen'));
        }
    }, [open]);

    const handleConfirmar = () => {
        if (metodoPago) {
            if (tipoDocumento === 'recibo') {
                imprimirRecibo();
            }
            onConfirmarPago(metodoPago);
        }
    };

    const imprimirRecibo = () => {
        const contenido = `
            RESTAURANTE EL JARDÍN
            ${tipoDocumento === 'factura' ? 'FACTURA' : 'RECIBO DE VENTA'}
            --------------------------------
            Fecha: ${new Date().toLocaleString()}
            Cliente: ${razonSocial || 'S/N'}
            NIT/CI: ${nit || '0'}
            --------------------------------
            CANT   DETALLE       SUBTOTAL
            ${items.map(i => `${i.cantidad}      ${i.nombre.slice(0, 15).padEnd(15)} ${i.precio * i.cantidad}`).join('\n')}
            --------------------------------
            TOTAL: Bs ${Number(total).toFixed(2)}
            --------------------------------
            Gracias por su visita!
        `;

        const ventana = window.open('', 'PRINT', 'height=600,width=400');
        if (ventana) {
            ventana.document.write(`<html><head><title>Imprimir</title></head><body><pre>${contenido}</pre></body></html>`);
            ventana.document.close();
            ventana.focus();
            ventana.print();
            ventana.close();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-serif text-primary">Cobrar Ficha</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Resumen del Pedido */}
                    <div className="bg-muted/30 p-4 rounded-lg space-y-2 border border-border">
                        <div className="flex justify-between font-bold text-xl border-b border-border pb-2 text-foreground">
                            <span>Total a Pagar</span>
                            <span className="text-primary font-mono">Bs {Number(total).toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground pt-1">
                            {items.length} items en la orden
                        </div>
                    </div>

                    {/* Datos de Facturación */}
                    <div className="space-y-3 border border-border p-3 rounded-lg bg-muted/20">
                        <h4 className="font-semibold text-sm text-foreground">Documento</h4>
                        <div className="flex gap-2 mb-2">
                            <Button
                                size="sm"
                                variant={tipoDocumento === 'recibo' ? 'default' : 'outline'}
                                onClick={() => setTipoDocumento('recibo')}
                                className="flex-1 font-semibold"
                            >
                                Recibo
                            </Button>
                            <Button
                                size="sm"
                                variant={tipoDocumento === 'factura' ? 'default' : 'outline'}
                                onClick={() => setTipoDocumento('factura')}
                                className="flex-1 font-semibold"
                            >
                                Factura
                            </Button>
                        </div>

                        {tipoDocumento === 'factura' && (
                            <div className="space-y-2 animate-in slide-in-from-top-2">
                                <input
                                    placeholder="NIT / CI"
                                    className="w-full p-2 border border-border rounded text-sm bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                                    value={nit}
                                    onChange={e => setNit(e.target.value)}
                                />
                                <input
                                    placeholder="Razón Social / Nombre"
                                    className="w-full p-2 border border-border rounded text-sm bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                                    value={razonSocial}
                                    onChange={e => setRazonSocial(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Selección de Método de Pago */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-foreground">Método de Pago</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setMetodoPago('efectivo')}
                                className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all font-semibold text-sm
                                    ${metodoPago === 'efectivo'
                                        ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400 shadow-md scale-[1.02]'
                                        : 'border-border bg-card text-foreground hover:bg-muted'
                                    }`}
                            >
                                <Banknote className={`w-6 h-6 ${metodoPago === 'efectivo' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                                Efectivo
                            </button>
                            <button
                                onClick={() => setMetodoPago('qr')}
                                className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all font-semibold text-sm
                                    ${metodoPago === 'qr'
                                        ? 'border-blue-500 bg-blue-950/20 text-blue-400 shadow-md scale-[1.02]'
                                        : 'border-border bg-card text-foreground hover:bg-muted'
                                    }`}
                            >
                                <QrCode className={`w-6 h-6 ${metodoPago === 'qr' ? 'text-blue-400' : 'text-muted-foreground'}`} />
                                QR
                            </button>
                        </div>
                    </div>

                    {/* Vista Previa QR */}
                    {metodoPago === 'qr' && (
                        <div className="flex flex-col items-center justify-center p-4 bg-card border border-border rounded-lg gap-2 animate-in fade-in">
                            {qrImagen ? (
                                <img
                                    src={qrImagen}
                                    alt="QR de pago"
                                    className="w-40 h-40 object-contain rounded-lg border border-border shadow"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center bg-muted rounded-lg w-40 h-40 text-muted-foreground gap-2">
                                    <QrCode className="w-12 h-12" />
                                    <p className="text-[10px] text-center px-2">No se cargó QR en el sistema.</p>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">Escanea el QR del restaurante</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={procesando} className="w-full sm:w-auto">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmar}
                        disabled={!metodoPago || procesando}
                        className="w-full sm:w-auto font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow"
                    >
                        {procesando ? '...' : `Imprimir y Cobrar`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

