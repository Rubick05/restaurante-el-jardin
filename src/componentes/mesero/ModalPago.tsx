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

    const handleConfirmar = () => {
        if (metodoPago) {
            onConfirmarPago(metodoPago);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Confirmar y Pagar</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Resumen del Pedido */}
                    <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                        <h4 className="font-semibold text-sm mb-2">Resumen del Pedido</h4>
                        {items.map((item) => (
                            <div key={item.id_elemento_menu} className="flex justify-between text-sm">
                                <span>{item.cantidad} x {item.nombre}</span>
                                <span>${(item.precio * item.cantidad).toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                            <span>Total a Pagar</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Selección de Método de Pago */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Método de Pago</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant={metodoPago === 'efectivo' ? 'default' : 'outline'}
                                className="h-24 flex flex-col gap-2"
                                onClick={() => setMetodoPago('efectivo')}
                            >
                                <Banknote className="w-8 h-8" />
                                Efectivo
                            </Button>
                            <Button
                                variant={metodoPago === 'qr' ? 'default' : 'outline'}
                                className="h-24 flex flex-col gap-2"
                                onClick={() => setMetodoPago('qr')}
                            >
                                <QrCode className="w-8 h-8" />
                                QR / Digital
                            </Button>
                        </div>
                    </div>

                    {/* Vista Previa QR */}
                    {metodoPago === 'qr' && (
                        <div className="flex flex-col items-center justify-center p-4 bg-white border rounded-lg animate-in fade-in zoom-in duration-300">
                            <div className="w-48 h-48 bg-slate-100 flex items-center justify-center mb-2">
                                <QrCode className="w-32 h-32 text-slate-800" />
                            </div>
                            <p className="text-xs text-muted-foreground text-center">Escanea para pagar con tu app favorita</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={procesando}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmar}
                        disabled={!metodoPago || procesando}
                        className="w-full sm:w-auto font-bold bg-green-600 hover:bg-green-700"
                    >
                        {procesando ? 'Procesando...' : `Pagar $${total.toFixed(2)}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
