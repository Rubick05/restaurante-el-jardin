import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/componentes/ui/dialog";
import { Button } from "@/componentes/ui/button";
import { ItemCarrito } from "./CarritoPedido";
import { QrCode, Banknote } from "lucide-react";

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

    const handleConfirmar = () => {
        if (metodoPago) {
            if (tipoDocumento === 'recibo') {
                imprimirRecibo();
            }
            // Aquí se guardaría la info de facturación en el pedido si fuera necesario expandir la firma de onConfirmarPago
            // Por ahora, asumimos que el backend/store lo maneja o que lo imprimimos.
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
            TOTAL: $${total.toFixed(2)}
            --------------------------------
            Gracias por su visita!
        `;

        // Forma sencilla de imprimir: abrir ventana nueva
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
                    <DialogTitle>Cobrar Ficha</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Resumen del Pedido */}
                    <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between font-bold text-xl border-b pb-2">
                            <span>Total a Pagar</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground pt-2">
                            {items.length} items en la orden
                        </div>
                    </div>

                    {/* Datos de Facturación */}
                    <div className="space-y-2 border p-3 rounded-lg bg-slate-50">
                        <h4 className="font-semibold text-sm">Documento</h4>
                        <div className="flex gap-2 mb-2">
                            <Button
                                size="sm"
                                variant={tipoDocumento === 'recibo' ? 'default' : 'outline'}
                                onClick={() => setTipoDocumento('recibo')}
                                className="flex-1"
                            >
                                Recibo
                            </Button>
                            <Button
                                size="sm"
                                variant={tipoDocumento === 'factura' ? 'default' : 'outline'}
                                onClick={() => setTipoDocumento('factura')}
                                className="flex-1"
                            >
                                Factura
                            </Button>
                        </div>

                        {tipoDocumento === 'factura' && (
                            <div className="space-y-2 animate-in slide-in-from-top-2">
                                <input
                                    placeholder="NIT / CI"
                                    className="w-full p-2 border rounded text-sm"
                                    value={nit}
                                    onChange={e => setNit(e.target.value)}
                                />
                                <input
                                    placeholder="Razón Social / Nombre"
                                    className="w-full p-2 border rounded text-sm"
                                    value={razonSocial}
                                    onChange={e => setRazonSocial(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Selección de Método de Pago */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Método de Pago</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant={metodoPago === 'efectivo' ? 'default' : 'outline'}
                                className="h-20 flex flex-col gap-1"
                                onClick={() => setMetodoPago('efectivo')}
                            >
                                <Banknote className="w-6 h-6" />
                                Efectivo
                            </Button>
                            <Button
                                variant={metodoPago === 'qr' ? 'default' : 'outline'}
                                className="h-20 flex flex-col gap-1"
                                onClick={() => setMetodoPago('qr')}
                            >
                                <QrCode className="w-6 h-6" />
                                QR
                            </Button>
                        </div>
                    </div>

                    {/* Vista Previa QR */}
                    {metodoPago === 'qr' && (
                        <div className="flex flex-col items-center justify-center p-4 bg-white border rounded-lg">
                            <QrCode className="w-24 h-24 text-slate-800" />
                            <p className="text-xs text-muted-foreground mt-2">Escanea el QR del negocio</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={procesando}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmar}
                        disabled={!metodoPago || procesando}
                        className="w-full sm:w-auto font-bold bg-green-600 hover:bg-green-700"
                    >
                        {procesando ? '...' : `Imprimir y Cobrar`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
