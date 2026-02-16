import { ElementoMenu } from "@/lib/bd/bd-local";
import { Card, CardContent, CardFooter } from "@/componentes/ui/card";
import { Button } from "@/componentes/ui/button";
import { Plus } from "lucide-react";

interface Props {
    item: ElementoMenu;
    onAdd: (item: ElementoMenu) => void;
}

export function TarjetaMenu({ item, onAdd }: Props) {
    return (
        <Card className={`overflow-hidden flex flex-col h-full ${!item.disponible ? 'opacity-60 grayscale' : ''}`}>
            <div className="aspect-video bg-slate-200 relative">
                {item.url_imagen ? (
                    <img
                        src={item.url_imagen}
                        alt={item.nombre}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                        Sin Imagen
                    </div>
                )}
                {!item.disponible && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">
                        AGOTADO
                    </div>
                )}
            </div>

            <CardContent className="p-4 flex-1">
                <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold leading-tight">{item.nombre}</h3>
                    <span className="font-bold text-primary whitespace-nowrap">
                        ${item.precio_actual.toFixed(2)}
                    </span>
                </div>
                {item.descripcion && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {item.descripcion}
                    </p>
                )}
            </CardContent>

            <CardFooter className="p-4 pt-0">
                <Button
                    className="w-full font-bold bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                    disabled={!item.disponible}
                    onClick={() => onAdd(item)}
                >
                    <Plus className="w-5 h-5 mr-2" /> AGREGAR AL PEDIDO
                </Button>
            </CardFooter>
        </Card>
    );
}
