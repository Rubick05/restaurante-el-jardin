import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, Pedido } from '@/lib/bd/bd-local';
import { Card, CardContent } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Clock, Hash, Trash2, Utensils } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { format } from 'date-fns';

interface Props {
    onPedidoSelect: (pedido: Pedido) => void;
}

export default function TableroFichas({ onPedidoSelect }: Props) {
    const queryClient = useQueryClient();
    const { data: pedidos = [] } = useQuery({
        queryKey: ['pedidos-activos'],
        queryFn: async () => {
            const pedidosActivos = await bdLocal.pedidos
                .where('estado')
                .anyOf(['pendiente', 'en_proceso', 'listo', 'entregado'])
                .toArray();

            // Ordenar: Más antiguos primero (FIFO - El orden en que pidieron)
            return pedidosActivos.sort((a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime());
        },
        refetchInterval: 5000
    });

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("¿Estás seguro de ELIMINAR este pedido?")) {
            await bdLocal.pedidos.delete(id);
            queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['resumen-dia'] });
        }
    };

    const getStatusInfo = (estado: string) => {
        switch (estado) {
            case 'pendiente': return { color: 'bg-gray-100 border-gray-300', label: 'Pendiente', badge: 'secondary' };
            case 'en_proceso': return { color: 'bg-blue-50 border-blue-200', label: 'Cocinando', badge: 'default' };
            case 'listo': return { color: 'bg-green-50 border-green-200', label: 'Listo', badge: 'success' };
            case 'entregado': return { color: 'bg-orange-50 border-orange-200', label: 'Entregado', badge: 'outline' };
            default: return { color: 'bg-white', label: estado, badge: 'outline' };
        }
    };

    return (
        <div className="flex flex-col gap-3 p-4 pb-24 max-w-3xl mx-auto">
            {pedidos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50 bg-slate-50 rounded-xl border-2 border-dashed">
                    <Utensils className="w-16 h-16 mb-4 text-slate-300" />
                    <p className="text-xl font-medium">No hay pedidos activos</p>
                    <p className="text-sm">Presiona el botón + para crear uno nuevo</p>
                </div>
            )}

            {pedidos.map((pedido) => {
                const status = getStatusInfo(pedido.estado);
                return (
                    <Card
                        key={pedido.id}
                        className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.99] border-l-4 relative group`}
                        style={{ borderLeftColor: status.label === 'Pendiente' ? '#64748b' : status.label === 'Cocinando' ? '#3b82f6' : status.label === 'Listo' ? '#22c55e' : '#f97316' }}
                        onClick={() => onPedidoSelect(pedido)}
                    >
                        <div className="absolute top-3 right-3 z-10">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => handleDelete(e, pedido.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>

                        <CardContent className="p-4 flex items-center gap-4">
                            {/* Columna Izquierda: Identificadores */}
                            <div className="flex flex-col items-center justify-center min-w-[70px] border-r pr-4 border-dashed border-slate-200">
                                {/* GRANDE: Letrero Físico */}
                                <div className="text-5xl font-black text-slate-800 bg-slate-100 rounded-lg w-16 h-16 flex items-center justify-center shadow-sm">
                                    {pedido.numero_letrero || '?'}
                                </div>
                                {/* PEQUEÑO: Número de Ficha Secuencial */}
                                <div className="text-[10px] text-muted-foreground mt-2 font-mono">
                                    Ficha #{pedido.numero_ficha}
                                </div>
                            </div>

                            {/* Columna Central: Resumen y Estado */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={status.badge as any} className="uppercase text-[10px] tracking-wide">
                                            {status.label}
                                        </Badge>
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(pedido.creado_en), 'HH:mm')}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-sm font-medium text-slate-700 line-clamp-2 my-1">
                                    {pedido.items?.map(i => `${i.cantidad} ${i.nombre_item}`).join(', ')}
                                </div>

                                <div className="flex items-center justify-between mt-2">
                                    <div className="text-xs text-slate-500">
                                        {pedido.items?.length} items
                                    </div>
                                    <div className="font-bold text-green-700 text-sm bg-green-50 px-2 py-0.5 rounded">
                                        ${pedido.total.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
