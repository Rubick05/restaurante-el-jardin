import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pedido, ItemPedido } from '@/lib/bd/bd-local';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Button } from '@/componentes/ui/button';
import { Clock, CheckCircle2, ChefHat, ArrowRight } from 'lucide-react';


// Nota: Necesito crear el componente Badge si no existe, o usar un div simple por ahora.
// Usaré un div con clases de tailwind para no complicar.

interface Props {
    pedido: Pedido & { items: ItemPedido[] };
    onAvanzarEstado: (id: string, estadoActual: string) => void;
}

export function TarjetaPedidoCocina({ pedido, onAvanzarEstado }: Props) {
    const tiempoTranscurrido = formatDistanceToNow(new Date(pedido.creado_en), { locale: es, addSuffix: true });

    // Calcular si está demorado (> 20 mins)
    const esDemorado = new Date().getTime() - new Date(pedido.creado_en).getTime() > 20 * 60 * 1000;

    return (
        <Card className={`w-full mb-4 border-l-4 ${esDemorado ? 'border-l-destructive' : 'border-l-primary'}`}>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <span>Mesa {pedido.id_mesa.replace('mesa-', '')}</span>
                        <span className="text-sm font-normal text-muted-foreground">#{pedido.numero_pedido.slice(-4)}</span>
                    </CardTitle>
                    <div className="flex items-center text-xs text-muted-foreground bg-slate-100 px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3 mr-1" />
                        {tiempoTranscurrido}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pb-2">
                <ul className="space-y-1">
                    {pedido.items.map((item, idx) => (
                        <li key={idx} className="flex gap-2 items-start text-sm">
                            <span className="font-bold w-6 text-center bg-slate-200 rounded text-xs py-0.5">{item.cantidad}</span>
                            <span className="flex-1">{item.nombre_item}</span>
                        </li>
                    ))}
                </ul>
                {pedido.notas && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-100 rounded text-xs text-yellow-800">
                        Nota: {pedido.notas}
                    </div>
                )}
            </CardContent>

            <CardFooter className="pt-2">
                <Button
                    className="w-full"
                    size="sm"
                    onClick={() => onAvanzarEstado(pedido.id, pedido.estado)}
                >
                    {pedido.estado === 'pendiente' && (
                        <>
                            <ChefHat className="w-4 h-4 mr-2" /> Empezar
                        </>
                    )}
                    {pedido.estado === 'en_proceso' && (
                        <>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Terminar
                        </>
                    )}
                    {pedido.estado === 'listo' && (
                        <>
                            <ArrowRight className="w-4 h-4 mr-2" /> Entregar
                        </>
                    )}
                </Button>
            </CardFooter>
        </Card>
    );
}
