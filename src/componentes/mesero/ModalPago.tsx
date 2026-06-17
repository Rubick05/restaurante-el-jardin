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
    const tipoDocumento = 'recibo';
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
            imprimirRecibo();
            onConfirmarPago(metodoPago);
        }
    };

    const imprimirRecibo = () => {
        const lineas = items.map(
            i => `
            <tr>
                <td style="padding: 4px 0; font-size: 13px; font-weight: bold;">${i.cantidad}x</td>
                <td style="padding: 4px 0; font-size: 13px;">${i.nombre}</td>
                <td style="padding: 4px 0; text-align: right; font-family: monospace; font-size: 13px;">Bs ${Number(i.precio * i.cantidad).toFixed(2)}</td>
            </tr>`
        ).join("");

        const logoSvg = `
            <svg width="70" height="70" viewBox="0 0 100 100" fill="none" stroke="#f59e0b" stroke-width="2.5" style="margin: 0 auto; display: block;">
                <!-- Leaf / Garden logo -->
                <path d="M50 15 C30 35, 30 65, 50 85 C70 65, 70 35, 50 15 Z" fill="rgba(245, 158, 11, 0.05)" />
                <path d="M50 15 L50 85" stroke-dasharray="2 2" />
                <path d="M50 35 C42 40, 42 50, 50 55" />
                <path d="M50 45 C58 50, 58 60, 50 65" />
            </svg>
        `;

        const htmlContenido = `
            <html>
            <head>
                <title>Recibo Ficha</title>
                <style>
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        color: #000;
                        padding: 10px;
                        max-width: 300px;
                        margin: 0 auto;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 12px;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 8px;
                    }
                    .header h2 {
                        margin: 5px 0 2px 0;
                        font-size: 18px;
                        font-weight: bold;
                        letter-spacing: 1px;
                    }
                    .header p {
                        margin: 0;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .info {
                        font-size: 12px;
                        margin-bottom: 10px;
                        line-height: 1.4;
                    }
                    .table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 10px;
                    }
                    .table th {
                        border-bottom: 1px solid #000;
                        font-size: 11px;
                        text-align: left;
                        padding-bottom: 4px;
                        text-transform: uppercase;
                    }
                    .totales {
                        border-top: 1px dashed #000;
                        padding-top: 6px;
                        margin-top: 6px;
                        font-size: 12px;
                    }
                    .total-grande {
                        font-size: 14px;
                        font-weight: bold;
                        display: flex;
                        justify-content: space-between;
                        margin-top: 5px;
                        border-top: 1px solid #000;
                        padding-top: 5px;
                    }
                    .footer-text {
                        text-align: center;
                        font-size: 11px;
                        margin-top: 18px;
                        border-top: 1px dashed #000;
                        padding-top: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    ${logoSvg}
                    <h2>EL JARDÍN</h2>
                    <p>Peña - Restaurant</p>
                </div>
                <div class="info">
                    <strong>RECIBO DE VENTA</strong><br>
                    Fecha: ${new Date().toLocaleString("es-BO")}<br>
                    Cliente: ${razonSocial.trim() || "PÚBLICO GENERAL"}<br>
                    NIT/CI: ${nit.trim() || "0"}
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th style="width: 15%;">Cant</th>
                            <th style="width: 60%;">Detalle</th>
                            <th style="width: 25%; text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lineas}
                    </tbody>
                </table>
                <div class="totales">
                    <div class="total-grande">
                        <span>TOTAL A PAGAR:</span>
                        <span>Bs ${Number(total).toFixed(2)}</span>
                    </div>
                </div>
                <div class="info" style="margin-top: 8px; font-size: 11px;">
                    Método Pago: ${metodoPago === "qr" ? "Código QR" : "Efectivo"}
                </div>
                <div class="footer-text">
                    ¡Gracias por su visita!<br>
                    Cochabamba, Bolivia
                </div>
            </body>
            </html>
        `;

        const ventana = window.open('', 'PRINT', 'height=600,width=400');
        if (ventana) {
            ventana.document.write(htmlContenido);
            ventana.document.close();
            ventana.focus();
            setTimeout(() => {
                ventana.print();
                ventana.close();
            }, 250);
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

                    {/* Datos de Recibo (Facturación Opcional) */}
                    <div className="space-y-3 border border-border p-4 rounded-lg bg-muted/20">
                        <h4 className="font-semibold text-sm text-foreground border-b border-border pb-1.5 flex items-center gap-2">
                            Datos del Recibo
                        </h4>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">NIT / CI (Opcional)</label>
                                <input
                                    placeholder="Ej: 8329482012"
                                    className="w-full p-2.5 border border-border rounded-lg text-sm bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                                    value={nit}
                                    onChange={e => setNit(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Razón Social / Nombre (Opcional)</label>
                                <input
                                    placeholder="Ej: Juan Pérez"
                                    className="w-full p-2.5 border border-border rounded-lg text-sm bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                                    value={razonSocial}
                                    onChange={e => setRazonSocial(e.target.value)}
                                />
                            </div>
                        </div>
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

