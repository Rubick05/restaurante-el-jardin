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
        <Card className={`overflow-hidden flex flex-col h-full border-2 border-primary/20 shadow-md ${!item.disponible ? 'opacity-60 grayscale' : 'hover:shadow-lg hover:border-primary/40 transition-all'}`}>
            <div className="aspect-video bg-muted relative border-b border-primary/10">
                {(item.url_imagen || item.imagen_base64) ? (
                    <img
                        src={item.imagen_base64 || item.url_imagen}
                        alt={item.nombre}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 bg-secondary/30">
                        {/* Placeholder Rústico */}
                        <div className="text-center p-4">
                            <span className="text-4xl opacity-20">🍃</span>
                        </div>
                    </div>
                )}
                {!item.disponible && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center text-destructive font-bold border-4 border-double border-destructive/20 m-2">
                        AGOTADO
                    </div>
                )}
            </div>

            <CardContent className="p-4 flex-1 bg-card">
                <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className="font-serif font-bold text-lg leading-tight text-primary">{item.nombre}</h3>
                    <span className="font-bold text-lg text-foreground whitespace-nowrap bg-secondary px-2 py-0.5 rounded-md border border-primary/10">
                        {item.precio_actual} Bs
                    </span>
                </div>
                {item.categoria && (
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-primary/60 bg-primary/10 px-2 py-0.5 rounded mb-1">
                        {item.categoria}
                    </span>
                )}
                {item.descripcion ? (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 italic">
                        {item.descripcion}
                    </p>
                ) : null}
            </CardContent>

            <CardFooter className="p-4 pt-0 bg-card">
                <Button
                    className="w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                    size="lg"
                    disabled={!item.disponible}
                    onClick={() => onAdd(item)}
                >
                    <Plus className="w-5 h-5 mr-2" /> AGREGAR
                </Button>
            </CardFooter>
        </Card>
    );
}
