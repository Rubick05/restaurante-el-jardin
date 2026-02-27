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
    const [tipoDoc, setTipoDoc] = useState<TipoDoc>("recibo");
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
            // Actualizar estado del pedido a 'pagado'
            await bdLocal.pedidos.update(pedido.id, {
                estado: "pagado",
                actualizado_en: new Date().toISOString(),
                sincronizado: false,
                datos_facturacion: {
                    tipo: tipoDoc,
                    nit_ci: nit || undefined,
                    razon_social: razonSocial || undefined,
                },
            });

            // Invalidar queries para refrescar vistas
            queryClient.invalidateQueries({ queryKey: ["pedidos-activos"] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-cocina"] });
            queryClient.invalidateQueries({ queryKey: ["resumen-dia"] });
            queryClient.invalidateQueries({ queryKey: ["items-cocina"] });

            // Imprimir recibo si corresponde
            if (tipoDoc === "recibo") {
                imprimirRecibo();
            }

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
            i => `${String(i.cantidad).padEnd(4)} ${i.nombre_item.slice(0, 20).padEnd(20)} Bs ${i.subtotal.toFixed(2)}`
        ).join("\n");

        const contenido = `
RESTAURANTE EL JARDÍN
${tipoDoc === "factura" ? "FACTURA" : "RECIBO DE VENTA"}
Ficha #${pedido.numero_ficha} - Letrero: ${pedido.numero_letrero || "?"}
--------------------------------
Fecha: ${new Date().toLocaleString("es-BO")}
Cliente: ${razonSocial || "S/N"}
NIT/CI: ${nit || "0"}
--------------------------------
CANT DETALLE              SUBTOTAL
${lineas}
--------------------------------
PLATOS:   Bs ${subtotalPlatos.toFixed(2)}
BEBIDAS:  Bs ${subtotalBebidas.toFixed(2)}
--------------------------------
TOTAL:    Bs ${total.toFixed(2)}
Método:   ${metodoPago === "qr" ? "QR" : "Efectivo"}
--------------------------------
¡Gracias por su visita!
        `.trim();

        const ventana = window.open("", "PRINT", "height=700,width=400");
        if (ventana) {
            ventana.document.write(
                `<html><head><title>Recibo</title><style>body{font-family:monospace;white-space:pre;font-size:13px;padding:16px}</style></head><body>${contenido}</body></html>`
            );
            ventana.document.close();
            ventana.focus();
            ventana.print();
            ventana.close();
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
        setTipoDoc("recibo");
        setNit("");
        setRazonSocial("");
        setCobrado(false);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleCerrar(); }}>
            <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Receipt className="w-5 h-5 text-green-600" />
                        Cobrar Pedido
                        <Badge variant="outline" className="ml-2 font-mono">
                            Ficha #{pedido.numero_ficha} · Letrero {pedido.numero_letrero || "?"}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>

                {cobrado ? (
                    /* ── Pantalla de éxito ── */
                    <div className="flex flex-col items-center justify-center py-10 gap-4">
                        <CheckCircle2 className="w-20 h-20 text-green-500" />
                        <p className="text-2xl font-bold text-green-700">¡Cobrado!</p>
                        <p className="text-muted-foreground text-center">
                            El pedido fue marcado como <strong>pagado</strong> correctamente.
                        </p>
                        <Button onClick={handleCerrar} className="mt-4 bg-green-600 hover:bg-green-700 w-full">
                            Cerrar
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-5 py-2">

                        {/* ── Resumen de Platos ── */}
                        {platos.length > 0 && (
                            <div className="rounded-lg border overflow-hidden">
                                <div className="bg-orange-50 px-4 py-2 flex items-center gap-2 border-b">
                                    <UtensilsCrossed className="w-4 h-4 text-orange-600" />
                                    <span className="font-semibold text-sm text-orange-800">Platos</span>
                                </div>
                                <div className="divide-y">
                                    {platos.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center px-4 py-2 text-sm">
                                            <span className="flex-1">
                                                <span className="font-bold text-slate-700">{item.cantidad}×</span>{" "}
                                                {item.nombre_item}
                                            </span>
                                            <span className="font-mono text-slate-700">Bs {item.subtotal.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-orange-50/50 px-4 py-2 flex justify-between text-sm font-semibold border-t">
                                    <span>Subtotal platos</span>
                                    <span>Bs {subtotalPlatos.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {/* ── Resumen de Bebidas / Consumo ── */}
                        {bebidas.length > 0 && (
                            <div className="rounded-lg border overflow-hidden">
                                <div className="bg-blue-50 px-4 py-2 flex items-center gap-2 border-b">
                                    <Coffee className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold text-sm text-blue-800">Bebidas y Consumo</span>
                                </div>
                                <div className="divide-y">
                                    {bebidas.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center px-4 py-2 text-sm">
                                            <span className="flex-1">
                                                <span className="font-bold text-slate-700">{item.cantidad}×</span>{" "}
                                                {item.nombre_item}
                                            </span>
                                            <span className="font-mono text-slate-700">Bs {item.subtotal.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-blue-50/50 px-4 py-2 flex justify-between text-sm font-semibold border-t">
                                    <span>Subtotal bebidas</span>
                                    <span>Bs {subtotalBebidas.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        {/* ── Total ── */}
                        <div className="bg-slate-900 text-white rounded-xl px-5 py-4 flex justify-between items-center">
                            <span className="text-lg font-bold">TOTAL A PAGAR</span>
                            <span className="text-3xl font-black">Bs {total.toFixed(2)}</span>
                        </div>

                        {/* ── Tipo de Documento ── */}
                        <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                <Hash className="w-4 h-4" /> Documento
                            </h4>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={tipoDoc === "recibo" ? "default" : "outline"}
                                    onClick={() => setTipoDoc("recibo")}
                                    className="flex-1"
                                >
                                    Recibo
                                </Button>
                                <Button
                                    size="sm"
                                    variant={tipoDoc === "factura" ? "default" : "outline"}
                                    onClick={() => setTipoDoc("factura")}
                                    className="flex-1"
                                >
                                    Factura
                                </Button>
                            </div>
                            {tipoDoc === "factura" && (
                                <div className="space-y-2 animate-in slide-in-from-top-2 pt-1">
                                    <input
                                        placeholder="NIT / CI"
                                        className="w-full p-2 border rounded text-sm bg-white"
                                        value={nit}
                                        onChange={e => setNit(e.target.value)}
                                    />
                                    <input
                                        placeholder="Razón Social / Nombre"
                                        className="w-full p-2 border rounded text-sm bg-white"
                                        value={razonSocial}
                                        onChange={e => setRazonSocial(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* ── Método de Pago ── */}
                        <div className="space-y-3">
                            <h4 className="font-semibold text-sm">Método de Pago</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setMetodoPago("efectivo")}
                                    className={`h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all font-semibold text-sm
                                        ${metodoPago === "efectivo"
                                            ? "border-green-500 bg-green-50 text-green-700 shadow-md scale-[1.02]"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                        }`}
                                >
                                    <Banknote className={`w-8 h-8 ${metodoPago === "efectivo" ? "text-green-600" : "text-slate-400"}`} />
                                    Efectivo
                                </button>
                                <button
                                    onClick={() => setMetodoPago("qr")}
                                    className={`h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all font-semibold text-sm
                                        ${metodoPago === "qr"
                                            ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md scale-[1.02]"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                        }`}
                                >
                                    <QrCode className={`w-8 h-8 ${metodoPago === "qr" ? "text-blue-600" : "text-slate-400"}`} />
                                    Código QR
                                </button>
                            </div>
                        </div>

                        {/* ── Vista QR ── */}
                        {metodoPago === "qr" && (
                            <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-blue-200 rounded-xl gap-3 animate-in fade-in">
                                {qrImagen ? (
                                    <img
                                        src={qrImagen}
                                        alt="QR de pago"
                                        className="w-52 h-52 object-contain rounded-lg border shadow"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center bg-slate-100 rounded-xl w-52 h-52 text-slate-400 gap-2">
                                        <QrCode className="w-14 h-14" />
                                        <p className="text-xs text-center px-4">El admin no ha subido un QR aún. Ve a Gestión QR.</p>
                                    </div>
                                )}
                                <p className="text-sm text-muted-foreground text-center">Muestra este QR al cliente</p>
                                <p className="font-bold text-blue-700 text-lg">Bs {total.toFixed(2)}</p>
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
                            className="w-full sm:w-auto font-bold bg-green-600 hover:bg-green-700 text-white h-12 text-base"
                        >
                            {procesando ? (
                                "Procesando..."
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
                                    Confirmar Cobro · Bs ${total.toFixed(2)}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}

