import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/componentes/ui/dialog";
import { Button } from "@/componentes/ui/button";
import { Badge } from "@/componentes/ui/badge";
import { Pedido, bdLocal } from "@/lib/bd/bd-local";
import { useQueryClient } from "@tanstack/react-query";
import { USUARIOS_SISTEMA } from "@/lib/auth/usuarios";

function nombreMesero(idMesero: string): string {
    const usuario = USUARIOS_SISTEMA.find(u => u.id === idMesero);
    return usuario?.nombre ?? idMesero;
}
import {
    QrCode,
    Banknote,
    CheckCircle2,
    Receipt,
    UtensilsCrossed,
    Coffee,
    Hash,
} from "lucide-react";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pedido: Pedido;
    onCobrado: () => void;
}

type MetodoPago = "efectivo" | "qr" | null;
type TipoDoc = "recibo" | "factura";

// Categorías que se consideran bebidas/consumo
const CATEGORIAS_BEBIDA = ["bebida", "cerveza", "refresco", "trago", "jugo", "agua", "gaseosa", "vino", "cocktail"];

function esCategoriaBebida(categoria?: string): boolean {
    if (!categoria) return false;
    const cat = categoria.toLowerCase();
    return CATEGORIAS_BEBIDA.some(b => cat.includes(b));
}

export function ModalCobro({ open, onOpenChange, pedido, onCobrado }: Props) {
    const queryClient = useQueryClient();
    const [metodoPago, setMetodoPago] = useState<MetodoPago>(null);
    const tipoDoc = "recibo";
    const [nit, setNit] = useState("");
    const [razonSocial, setRazonSocial] = useState("");
    const [procesando, setProcesando] = useState(false);
    const [cobrado, setCobrado] = useState(false);
    const [qrImagen, setQrImagen] = useState<string | null>(null);

    // Leer la imagen QR subida por el admin desde localStorage
    useEffect(() => {
        if (open) {
            setQrImagen(localStorage.getItem('qr-restaurante-imagen'));
        }
    }, [open]);

    const items = pedido.items || [];

    // Separar platos y bebidas
    const platos = items.filter(i => !esCategoriaBebida(i.categoria));
    const bebidas = items.filter(i => esCategoriaBebida(i.categoria));

    const subtotalPlatos = platos.reduce((acc, i) => acc + i.subtotal, 0);
    const subtotalBebidas = bebidas.reduce((acc, i) => acc + i.subtotal, 0);
    const total = pedido.total;

    const handleConfirmar = async () => {
        if (!metodoPago) return;
        setProcesando(true);

        try {
            // Actualizar localmente
            const datosUpdate = {
                estado: "pagado" as const,
                actualizado_en: new Date().toISOString(),
                datos_facturacion: {
                    tipo: tipoDoc as any,
                    nit_ci: nit.trim() || undefined,
                    razon_social: razonSocial.trim() || undefined,
                },
            };

            await bdLocal.pedidos.update(pedido.id, datosUpdate);

            // Sincronizar inmediatamente con el servidor
            try {
                const { API_BASE_URL } = await import('@/hooks/useInicializacion');
                await fetch(`${API_BASE_URL}/api/pedidos/${pedido.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datosUpdate),
                });
            } catch (error) {
                console.warn("Cobro local guardado, modo offline activo.", error);
            }

            // Invalidar queries para refrescar vistas
            queryClient.invalidateQueries({ queryKey: ["pedidos-activos"] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-cocina"] });
            queryClient.invalidateQueries({ queryKey: ["resumen-dia"] });
            queryClient.invalidateQueries({ queryKey: ["items-cocina"] });

            // Imprimir recibo
            imprimirRecibo();

            setCobrado(true);
        } catch (err) {
            console.error(err);
            alert("Error al registrar el cobro");
        } finally {
            setProcesando(false);
        }
    };

    const imprimirRecibo = () => {
        const lineas = items.map(
            i => `
            <tr>
                <td style="padding: 4px 0; font-size: 13px; font-weight: bold;">${i.cantidad}x</td>
                <td style="padding: 4px 0; font-size: 13px;">${i.nombre_item}</td>
                <td style="padding: 4px 0; text-align: right; font-family: monospace; font-size: 13px;">Bs ${Number(i.subtotal).toFixed(2)}</td>
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
                <title>Recibo Ficha #${pedido.numero_ficha}</title>
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
                    Ficha: #${pedido.numero_ficha} · Letrero: ${pedido.numero_letrero || "?"}<br>
                    Camarero: ${nombreMesero(pedido.id_mesero)}<br>
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
                    ${subtotalPlatos > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>Subtotal Platos:</span>
                        <span>Bs ${Number(subtotalPlatos).toFixed(2)}</span>
                    </div>` : ''}
                    ${subtotalBebidas > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>Subtotal Bebidas:</span>
                        <span>Bs ${Number(subtotalBebidas).toFixed(2)}</span>
                    </div>` : ''}
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

        const ventana = window.open("", "PRINT", "height=700,width=400");
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

    const handleCerrar = () => {
        if (cobrado) {
            onCobrado();
        } else {
            onOpenChange(false);
        }
        // Reset state
        setMetodoPago(null);
        setNit("");
        setRazonSocial("");
        setCobrado(false);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleCerrar(); }}>
            <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-serif text-primary">
                        <Receipt className="w-5 h-5 text-primary text-glow-gold" />
                        Cobrar Pedido
                        <Badge variant="outline" className="ml-2 font-mono border-primary/20 text-primary">
                            Ficha #{pedido.numero_ficha} · Letrero {pedido.numero_letrero || "?"}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>

                {cobrado ? (
                    /* ── Pantalla de éxito ── */
                    <div className="flex flex-col items-center justify-center py-10 gap-4">
                        <CheckCircle2 className="w-20 h-20 text-emerald-400" />
                        <p className="text-2xl font-bold text-foreground">¡Cobrado!</p>
                        <p className="text-muted-foreground text-center">
                            El pedido fue marcado como <strong>pagado</strong> correctamente.
                        </p>
                        <Button onClick={handleCerrar} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground w-full font-bold">
                            Cerrar
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-5 py-2">

                        {/* ── Resumen de Platos ── */}
                        {platos.length > 0 && (
                            <div className="rounded-lg border border-border overflow-hidden">
                                <div className="bg-amber-950/20 px-4 py-2 flex items-center gap-2 border-b border-border">
                                    <UtensilsCrossed className="w-4 h-4 text-primary" />
                                    <span className="font-semibold text-sm text-amber-400">Platos</span>
                                </div>
                                <div className="divide-y divide-border">
                                    {platos.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center px-4 py-2 text-sm">
                                            <span className="flex-1">
                                                <span className="font-bold text-foreground">{item.cantidad}×</span>{" "}
                                                {item.nombre_item}
                                            </span>
                                            <span className="font-mono text-foreground/90">Bs {Number(item.subtotal).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-amber-950/30 px-4 py-2 flex justify-between text-sm font-semibold border-t border-border text-amber-400">
                                    <span>Subtotal platos</span>
                                    <span>Bs {Number(subtotalPlatos).toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {/* ── Resumen de Bebidas / Consumo ── */}
                        {bebidas.length > 0 && (
                            <div className="rounded-lg border border-border overflow-hidden">
                                <div className="bg-blue-950/20 px-4 py-2 flex items-center gap-2 border-b border-border">
                                    <Coffee className="w-4 h-4 text-blue-400" />
                                    <span className="font-semibold text-sm text-blue-300">Bebidas y Consumo</span>
                                </div>
                                <div className="divide-y divide-border">
                                    {bebidas.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center px-4 py-2 text-sm">
                                            <span className="flex-1">
                                                <span className="font-bold text-foreground">{item.cantidad}×</span>{" "}
                                                {item.nombre_item}
                                            </span>
                                            <span className="font-mono text-foreground/90">Bs {Number(item.subtotal).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-blue-950/30 px-4 py-2 flex justify-between text-sm font-semibold border-t border-border text-blue-300">
                                    <span>Subtotal bebidas</span>
                                    <span>Bs {Number(subtotalBebidas).toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {/* ── Total ── */}
                        <div className="bg-primary text-primary-foreground rounded-xl px-5 py-4 flex justify-between items-center glow-gold">
                            <span className="text-lg font-bold">TOTAL A PAGAR</span>
                            <span className="text-3xl font-black">Bs {Number(total).toFixed(2)}</span>
                        </div>

                        {/* ── Datos de Recibo (Facturación Opcional) ── */}
                        <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/30">
                            <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground border-b border-border pb-1.5">
                                <Hash className="w-4 h-4 text-primary" /> Datos del Recibo
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

                        {/* ── Método de Pago ── */}
                        <div className="space-y-3">
                            <h4 className="font-semibold text-sm text-foreground">Método de Pago</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setMetodoPago("efectivo")}
                                    className={`h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all font-semibold text-sm
                                        ${metodoPago === "efectivo"
                                            ? "border-emerald-500 bg-emerald-950/20 text-emerald-400 shadow-md scale-[1.02]"
                                            : "border-border bg-card text-foreground hover:bg-muted"
                                        }`}
                                >
                                    <Banknote className={`w-8 h-8 ${metodoPago === "efectivo" ? "text-emerald-400" : "text-muted-foreground"}`} />
                                    Efectivo
                                </button>
                                <button
                                    onClick={() => setMetodoPago("qr")}
                                    className={`h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all font-semibold text-sm
                                        ${metodoPago === "qr"
                                            ? "border-blue-500 bg-blue-950/20 text-blue-400 shadow-md scale-[1.02]"
                                            : "border-border bg-card text-foreground hover:bg-muted"
                                        }`}
                                >
                                    <QrCode className={`w-8 h-8 ${metodoPago === "qr" ? "text-blue-400" : "text-muted-foreground"}`} />
                                    Código QR
                                </button>
                            </div>
                        </div>

                        {/* ── Vista QR ── */}
                        {metodoPago === "qr" && (
                            <div className="flex flex-col items-center justify-center p-4 bg-card border-2 border-blue-900/40 rounded-xl gap-3 animate-in fade-in">
                                {qrImagen ? (
                                    <img
                                        src={qrImagen}
                                        alt="QR de pago"
                                        className="w-52 h-52 object-contain rounded-lg border border-border shadow"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center bg-muted rounded-xl w-52 h-52 text-muted-foreground gap-2">
                                        <QrCode className="w-14 h-14" />
                                        <p className="text-xs text-center px-4">El admin no ha subido un QR aún. Ve a Gestión QR.</p>
                                    </div>
                                )}
                                <p className="text-sm text-muted-foreground text-center">Muestra este QR al cliente</p>
                                <p className="font-bold text-blue-400 text-lg">Bs {Number(total).toFixed(2)}</p>
                            </div>
                        )}
                    </div>
                )}

                {!cobrado && (
                    <DialogFooter className="flex-col gap-2 sm:flex-row pt-2">
                        <Button
                            variant="ghost"
                            onClick={handleCerrar}
                            disabled={procesando}
                            className="w-full sm:w-auto"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirmar}
                            disabled={!metodoPago || procesando}
                            className="w-full sm:w-auto font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base shadow-md"
                        >
                            {procesando ? (
                                "Procesando..."
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
                                    Confirmar Cobro · Bs {Number(total).toFixed(2)}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}

