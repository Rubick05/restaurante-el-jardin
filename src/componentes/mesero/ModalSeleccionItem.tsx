import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/componentes/ui/dialog";
import { Button } from "@/componentes/ui/button";
import { ElementoMenu } from "@/lib/bd/bd-local";
import { Minus, Plus } from "lucide-react";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: ElementoMenu | null;
    cantidadInicial?: number;
    onConfirmar: (cantidad: number, notas?: string) => void;
}

export function ModalSeleccionItem({ open, onOpenChange, item, cantidadInicial = 1, onConfirmar }: Props) {
    const [cantidad, setCantidad] = useState(1);
    const [notas, setNotas] = useState("");

    // Resetear al abrir
    useEffect(() => {
        if (open) {
            setCantidad(cantidadInicial);
            setNotas("");
        }
    }, [open, cantidadInicial, item]);

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{item.nombre}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4">
                    {/* Imagen y Precio */}
                    <div className="flex gap-4 items-center">
                        <div className="w-24 h-24 bg-slate-200 rounded-lg overflow-hidden shrink-0">
                            {item.url_imagen ? (
                                <img src={item.url_imagen} alt={item.nombre} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Sin img</div>
                            )}
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-primary">Bs ${item.precio_actual.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">{item.descripcion}</p>
                        </div>
                    </div>

                    {/* Selector Cantidad */}
                    <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-lg"
                            onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                        >
                            <Minus className="h-6 w-6" />
                        </Button>
                        <span className="text-3xl font-bold w-16 text-center">{cantidad}</span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-lg"
                            onClick={() => setCantidad(cantidad + 1)}
                        >
                            <Plus className="h-6 w-6" />
                        </Button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-center">
                        <span className="text-lg font-medium text-muted-foreground mr-2">Subtotal:</span>
                        <span className="text-2xl font-bold">Bs ${(item.precio_actual * cantidad).toFixed(2)}</span>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        className="w-full h-12 text-lg font-bold"
                        onClick={() => {
                            onConfirmar(cantidad, notas);
                            onOpenChange(false);
                        }}
                    >
                        Agregar al Pedido
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

