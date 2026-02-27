import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, Pedido } from '@/lib/bd/bd-local';
import { useAuth } from '@/lib/auth/contexto-auth';
import { Card, CardContent } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Clock, Trash2, Utensils, Pencil, DollarSign, CheckCircle2 } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { format } from 'date-fns';

interface Props {
    onPedidoSelect: (pedido: Pedido) => void;
    onCobrarPedido: (pedido: Pedido) => void;
}

export default function TableroFichas({ onPedidoSelect, onCobrarPedido }: Props) {
    const queryClient = useQueryClient();
    // ── FILTRO ESTRICTO: solo los pedidos del mesero logueado ──────────────
    const { usuarioActual } = useAuth();
    const idMeseroActual = usuarioActual?.id ?? '';

    const { data: pedidos = [] } = useQuery({
        queryKey: ['pedidos-activos', idMeseroActual],
        queryFn: async () => {
            if (!idMeseroActual) return [];
            // Cargar SOLO los pedidos activos de ESTE mesero
            const todos = await bdLocal.pedidos
                .filter(p =>
                    p.id_mesero === idMeseroActual &&
                    ['pendiente', 'en_proceso', 'listo', 'entregado'].includes(p.estado)
                )
                .toArray();
            // FIFO: más antiguos primero
            return todos.sort((a, b) =>
                new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime()
            );
        },
        refetchInterval: 3000,
        enabled: !!idMeseroActual,
    });

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('¿Eliminar este pedido?')) {
            await bdLocal.pedidos.delete(id);
            queryClient.invalidateQueries({ queryKey: ['pedidos-activos', idMeseroActual] });
            queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
        }
    };

    const handleEditar = (e: React.MouseEvent, pedido: Pedido) => {
        e.stopPropagation();
        onPedidoSelect(pedido);
    };

    const handleCobrar = (e: React.MouseEvent, pedido: Pedido) => {
        e.stopPropagation();
        onCobrarPedido(pedido);
    };

    const getStatusInfo = (estado: string) => {
        switch (estado) {
            case 'pendiente': return { color: 'bg-gray-50 border-gray-200', label: 'Pendiente', badge: 'secondary', borderColor: '#64748b' };
            case 'en_proceso': return { color: 'bg-blue-50 border-blue-200', label: 'Cocinando', badge: 'default', borderColor: '#3b82f6' };
            case 'listo': return { color: 'bg-green-50 border-green-200', label: '✓ Listo', badge: 'success', borderColor: '#22c55e' };
            case 'entregado': return { color: 'bg-orange-50 border-orange-200', label: 'Entregado', badge: 'outline', borderColor: '#f97316' };
            default: return { color: 'bg-white', label: estado, badge: 'outline', borderColor: '#e2e8f0' };
        }
    };

    return (
        <div className="flex flex-col gap-3 p-4 pb-24 max-w-3xl mx-auto">
            {/* Indicador de mesero activo */}
            <div className="text-xs text-muted-foreground px-1 flex items-center gap-1">
                <span>Mostrando pedidos de:</span>
                <span className="font-semibold text-foreground">{usuarioActual?.nombre}</span>
            </div>

            {pedidos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50 bg-slate-50 rounded-xl border-2 border-dashed">
                    <Utensils className="w-16 h-16 mb-4 text-slate-300" />
                    <p className="text-xl font-medium">No hay pedidos activos</p>
                    <p className="text-sm">Presiona el botón + para crear uno nuevo</p>
                </div>
            )}

            {pedidos.map((pedido) => {
                const status = getStatusInfo(pedido.estado);
                const puedeEditar = ['pendiente', 'en_proceso', 'listo', 'entregado'].includes(pedido.estado);
                const puedeCobrar = true;
                const esListo = pedido.estado === 'listo';

                return (
                    <Card
                        key={pedido.id}
                        className={`transition-all hover:shadow-md border-l-4 relative group ${esListo ? 'ring-2 ring-green-400 shadow-green-100 shadow-md' : ''}`}
                        style={{ borderLeftColor: status.borderColor }}
                    >
                        {/* Alerta visual cuando está listo */}
                        {esListo && (
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow animate-bounce">
                                ¡LISTO PARA ENTREGAR!
                            </div>
                        )}

                        {/* Botones de acción */}
                        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                            {puedeEditar && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                                    onClick={(e) => handleEditar(e, pedido)} title="Editar pedido">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                            {puedeCobrar && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-700 hover:bg-green-50"
                                    onClick={(e) => handleCobrar(e, pedido)} title="Cobrar pedido">
                                    <DollarSign className="h-4 w-4" />
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => handleDelete(e, pedido.id)} title="Eliminar pedido">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>

                        <CardContent className="p-4 flex items-center gap-4">
                            {/* Letrero + Ficha */}
                            <div className="flex flex-col items-center justify-center min-w-[70px] border-r pr-4 border-dashed border-slate-200">
                                <div className="text-5xl font-black text-slate-800 bg-slate-100 rounded-lg w-16 h-16 flex items-center justify-center shadow-sm">
                                    {pedido.numero_letrero || '?'}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-2 font-mono">
                                    Ficha #{pedido.numero_ficha}
                                </div>
                            </div>

                            {/* Resumen */}
                            <div className="flex-1 min-w-0 pr-20">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={status.badge as any} className="uppercase text-[10px] tracking-wide">
                                        {status.label}
                                    </Badge>
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        {format(new Date(pedido.creado_en), 'HH:mm')}
                                    </span>
                                </div>

                                <div className="text-sm font-medium text-slate-700 line-clamp-2 my-1">
                                    {pedido.items?.map(i => `${i.cantidad}× ${i.nombre_item}`).join(', ')}
                                </div>

                                <div className="flex items-center justify-between mt-2">
                                    <div className="text-xs text-slate-500">{pedido.items?.length} items</div>
                                    <div className="font-bold text-green-700 text-sm bg-green-50 px-2 py-0.5 rounded">
                                        Bs {pedido.total.toFixed(2)}
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-2">
                                    {puedeEditar && (
                                        <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                                            <Pencil className="w-2.5 h-2.5" /> Editar
                                        </span>
                                    )}
                                    <span className="text-[10px] text-green-600 flex items-center gap-0.5 ml-1">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> Cobrar
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
