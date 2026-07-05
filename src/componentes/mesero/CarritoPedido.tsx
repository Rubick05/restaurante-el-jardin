import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Minus, Plus, Trash2, Send } from "lucide-react";

export interface ItemCarrito {
    id_elemento_menu: string;
    nombre: string;
    precio: number;
    cantidad: number;
    categoria?: string;
    instrucciones?: string;
}

interface Props {
    items: ItemCarrito[];
    onUpdateQuantity: (id: string, delta: number, instrucciones?: string) => void;
    onSubmit: () => void;
    procesando: boolean;
    notaCliente: string;
    onNotaChange: (nota: string) => void;
}

export function CarritoPedido({ items, onUpdateQuantity, onSubmit, procesando, notaCliente, onNotaChange }: Props) {
    const total = items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

    return (
        <Card className="h-auto md:h-[calc(100vh-8rem)] flex flex-col md:sticky md:top-24">
            <CardHeader className="pb-4 border-b bg-card">
                <CardTitle className="flex justify-between items-center text-base md:text-lg">
                    <span>Pedido Actual</span>
                    <span className="text-sm font-normal text-muted-foreground">Mesa {items[0]?.instrucciones?.match(/Mesa\s+(\d+)/)?.[1] || '?'}</span>
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-none md:flex-1 overflow-y-auto p-4 space-y-4">
                {items.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">
                        <p>El pedido está vacío</p>
                        <p className="text-sm">Selecciona items del menú</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <div key={item.id_elemento_menu + '-' + (item.instrucciones || '')} className="flex gap-3 items-center bg-secondary/30 p-2.5 rounded-lg border border-border/10">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm md:text-base truncate">{item.nombre}</p>
                                <p className="text-xs md:text-sm text-muted-foreground">Bs {Number(item.precio).toFixed(2)} x {item.cantidad}</p>
                                {item.instrucciones && (
                                    <p className="text-xs text-amber-400 italic font-medium mt-1">
                                        Nota: {item.instrucciones}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 hover:bg-destructive/10"
                                    onClick={() => onUpdateQuantity(item.id_elemento_menu, -1, item.instrucciones)}
                                >
                                    {item.text_color_or_something_maybe_deleted = item.cantidad === 1 ? <Trash2 className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4" />}
                                </Button>
                                <span className="w-5 text-center text-sm font-bold">{item.cantidad}</span>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 hover:bg-primary/10"
                                    onClick={() => onUpdateQuantity(item.id_elemento_menu, 1, item.instrucciones)}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </CardContent>

            <div className="p-4 border-t bg-card space-y-4">
                <div className="flex justify-between items-center text-base md:text-lg font-bold">
                    <span>Total</span>
                    <span className="text-emerald-400 font-mono">Bs {Number(total).toFixed(2)}</span>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Notas / Cliente</label>
                    <textarea
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Ej: Alérgico al maní, sin cebolla..."
                        value={notaCliente}
                        onChange={(e) => onNotaChange(e.target.value)}
                    />
                </div>

                <Button
                    className="w-full text-base md:text-lg h-12 font-bold"
                    disabled={items.length === 0 || procesando}
                    onClick={onSubmit}
                >
                    <Send className="w-5 h-5 mr-2" />
                    {procesando ? 'Enviando...' : 'Confirmar Pedido'}
                </Button>
            </div>
        </Card>
    );
}

