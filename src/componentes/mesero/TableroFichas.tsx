import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, Pedido } from '@/lib/bd/bd-local';
import { useAuth } from '@/lib/auth/contexto-auth';
import { Card, CardContent } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Clock, Trash2, Utensils, Pencil, DollarSign, CheckCircle2 } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { format } from 'date-fns';
import { API_BASE_URL } from '@/hooks/useInicializacion';
import { useNotificacionMesero } from '@/hooks/useNotificacionMesero';

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

    // ── NOTIFICACIONES (Vibración / Sonido) ────────────────────────
    useNotificacionMesero(pedidos);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('¿Eliminar este pedido permanentemente? (Desaparecerá también de cocina)')) {
            // Eliminar localmente
            await bdLocal.pedidos.delete(id);

            // Eliminar del servidor
            try {
                await fetch(`${API_BASE_URL}/api/pedidos/${id}`, {
                    method: 'DELETE'
                });
            } catch (err) {
                console.error("No se pudo eliminar del servidor:", err);
            }

            // Refrescar vistas
            queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
        }
    };

    const handleEntregar = async (e: React.MouseEvent, pedido: Pedido) => {
        e.stopPropagation();

        // Marcar el pedido y todos sus items como entregados
        const itemsEntregados = (pedido.items || []).map(it => ({
            ...it,
            estado_item: "entregado" as const
        }));

        const updateData = {
            estado: "entregado" as const,
            items: itemsEntregados,
            actualizado_en: new Date().toISOString()
        };

        // 1. Actualizar localmente
        await bdLocal.pedidos.update(pedido.id, updateData);

        // 2. Sincronizar con servidor
        try {
            await fetch(`${API_BASE_URL}/api/pedidos/${pedido.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
        } catch (err) {
            console.warn("Entregado local guardado, offline", err);
        }

        queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });
        queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
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
                const puedeEntregar = ['listo', 'en_proceso', 'pendiente'].includes(pedido.estado);
                const esListo = pedido.estado === 'listo';

                return (
                    <Card
                        key={pedido.id}
                        className={`transition-all hover:shadow-md border-l-4 relative group ${esListo ? 'ring-2 ring-green-400 shadow-green-100 shadow-md' : ''}`}
                        style={{ borderLeftColor: status.borderColor }}
                    >
                        {/* Alerta visual cuando está listo */}
                        {esListo && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[11px] font-black px-4 py-1 rounded-full shadow-lg shadow-green-300/50 flex items-center gap-1.5 ring-4 ring-white animate-bounce">
                                <CheckCircle2 className="w-4 h-4" />
                                ¡PEDIDO COMPLETO LISTO!
                            </div>
                        )}

                        {/* Botones de acción (arriba a la derecha solo en PC, en móvil van abajo) */}
                        <div className="hidden sm:flex absolute top-3 right-3 z-10 items-center gap-1">
                            {puedeEntregar && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-orange-600 hover:bg-orange-50"
                                    onClick={(e) => handleEntregar(e, pedido)} title="Marcar como entregado">
                                    <CheckCircle2 className="h-4 w-4" />
                                </Button>
                            )}
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
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={status.badge as any} className="uppercase text-[10px] tracking-wide">
                                        {status.label}
                                    </Badge>
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        {format(new Date(pedido.creado_en), 'HH:mm')}
                                    </span>
                                </div>

                                <div className="text-sm font-medium my-2 flex flex-wrap gap-1.5">
                                    {pedido.items?.map(i => (
                                        <span
                                            key={i.id}
                                            className={`px-2 py-0.5 rounded-md text-[11px] uppercase tracking-wider ${i.estado_item === 'listo'
                                                ? 'bg-green-500 text-white font-black animate-pulse shadow-sm shadow-green-300 ring-2 ring-green-400 ring-offset-1 flex items-center gap-1'
                                                : 'text-slate-600 bg-slate-100 font-medium whitespace-nowrap'
                                                }`}
                                        >
                                            {i.cantidad}× {i.nombre_item}
                                            {i.estado_item === 'listo' && <CheckCircle2 className="w-3 h-3 inline" />}
                                        </span>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between mt-2">
                                    <div className="text-xs text-slate-500">{pedido.items?.length} items</div>
                                    <div className="font-bold text-green-700 text-sm bg-green-50 px-2 py-0.5 rounded">
                                        Bs {Number(pedido.total || 0).toFixed(2)}
                                    </div>
                                </div>

                                {pedido.notas && (
                                    <div className="mt-2 text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-100 flex items-start gap-1">
                                        <span className="font-bold shrink-0">Notas:</span>
                                        <span className="italic">{pedido.notas}</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>

                        {/* Fila Inferior para botones de acción SOLAMENTE EN MÓVIL */}
                        <div className="sm:hidden flex items-center justify-end gap-2 border-t bg-slate-50/50 p-2 overflow-x-auto">
                            {puedeEntregar && (
                                <Button variant="outline" size="sm" className="h-9 px-3 text-orange-600 border-orange-200 hover:bg-orange-50 bg-white"
                                    onClick={(e) => handleEntregar(e, pedido)}>
                                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> Entregar
                                </Button>
                            )}
                            {puedeEditar && (
                                <Button variant="outline" size="sm" className="h-9 px-3 text-muted-foreground hover:text-blue-600 bg-white"
                                    onClick={(e) => handleEditar(e, pedido)}>
                                    <Pencil className="h-4 w-4 mr-1.5" /> Editar
                                </Button>
                            )}
                            {puedeCobrar && (
                                <Button variant="outline" size="sm" className="h-9 px-3 text-green-700 border-green-200 hover:bg-green-50 bg-white"
                                    onClick={(e) => handleCobrar(e, pedido)}>
                                    <DollarSign className="h-4 w-4 mr-1" /> Cobrar
                                </Button>
                            )}
                            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 bg-white border-red-100"
                                onClick={(e) => handleDelete(e, pedido.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
