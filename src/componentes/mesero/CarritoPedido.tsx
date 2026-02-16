import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Minus, Plus, Trash2, Send } from "lucide-react";

export interface ItemCarrito {
    id_elemento_menu: string;
    nombre: string;
    precio: number;
    cantidad: number;
}

interface Props {
    items: ItemCarrito[];
    onUpdateQuantity: (id: string, delta: number) => void;
    onSubmit: () => void;
    procesando: boolean;
    notaCliente: string;
    onNotaChange: (nota: string) => void;
}

export function CarritoPedido({ items, onUpdateQuantity, onSubmit, procesando, notaCliente, onNotaChange }: Props) {
    const total = items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

    return (
        <Card className="h-[calc(100vh-8rem)] flex flex-col sticky top-24">
            <CardHeader className="pb-4 border-b">
                <CardTitle className="flex justify-between items-center">
                    <span>Pedido Actual</span>
                    <span className="text-sm font-normal text-muted-foreground">Mesa 5</span>
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {items.length === 0 ? (
                    <div className="text-center text-muted-foreground mt-10">
                        <p>El pedido está vacío</p>
                        <p className="text-sm">Selecciona items del menú</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <div key={item.id_elemento_menu} className="flex gap-3 items-center bg-secondary/30 p-2 rounded-lg">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.nombre}</p>
                                <p className="text-sm text-muted-foreground">${item.precio.toFixed(2)} x {item.cantidad}</p>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => onUpdateQuantity(item.id_elemento_menu, -1)}
                                >
                                    {item.cantidad === 1 ? <Trash2 className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4" />}
                                </Button>
                                <span className="w-6 text-center text-sm font-bold">{item.cantidad}</span>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => onUpdateQuantity(item.id_elemento_menu, 1)}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </CardContent>

            <div className="flex justify-between items-center mb-4 text-lg font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
            </div>

            <div className="mb-4">
                <label className="text-sm font-medium mb-1 block">Notas / Cliente</label>
                <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Ej: Mesa 5, Alérgico al maní..."
                    value={notaCliente}
                    onChange={(e) => onNotaChange(e.target.value)}
                />
            </div>

            <Button
                className="w-full text-lg h-12"
                disabled={items.length === 0 || procesando}
                onClick={onSubmit}
            >
                <Send className="w-5 h-5 mr-2" />
                {procesando ? 'Enviando...' : 'Confirmar Pedido'}
            </Button>
        </Card >
    );
}
