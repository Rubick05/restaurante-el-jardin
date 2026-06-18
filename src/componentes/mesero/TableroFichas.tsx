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
            nuevosItems: itemsEntregados,
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
            case 'pendiente': return { color: 'bg-muted/40 border-border', label: 'Pendiente', badge: 'secondary', borderColor: '#64748b' };
            case 'en_proceso': return { color: 'bg-blue-950/20 border-blue-900/50', label: 'Cocinando', badge: 'default', borderColor: '#3b82f6' };
            case 'listo': return { color: 'bg-green-950/20 border-green-900/50', label: '✓ Listo', badge: 'success', borderColor: '#22c55e' };
            case 'entregado': return { color: 'bg-amber-950/20 border-amber-900/50', label: 'Entregado', badge: 'outline', borderColor: '#c8903a' };
            default: return { color: 'bg-card border-border', label: estado, badge: 'outline', borderColor: '#4a7c3f' };
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-4 pb-24 space-y-4">
            {/* Indicador de mesero activo */}
            <div className="text-xs text-muted-foreground px-3 py-2 flex items-center gap-2 bg-amber-950/15 border border-amber-900/30 rounded-xl max-w-fit shadow-sm">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Sesión activa de Mesero:</span>
                <span className="font-bold text-foreground">{usuarioActual?.nombre}</span>
            </div>

            {pedidos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50 bg-card rounded-xl border-2 border-dashed border-border glow-gold">
                    <Utensils className="w-16 h-16 mb-4 text-primary" />
                    <p className="text-xl font-medium">No hay pedidos activos</p>
                    <p className="text-sm">Presiona el botón + para crear uno nuevo</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pedidos.map((pedido) => {
                        const status = getStatusInfo(pedido.estado);
                        const puedeEditar = ['pendiente', 'en_proceso', 'listo', 'entregado'].includes(pedido.estado);
                        const puedeCobrar = true;
                        const puedeEntregar = ['listo', 'en_proceso', 'pendiente'].includes(pedido.estado);
                        const esListo = pedido.estado === 'listo';

                        return (
                            <Card
                                key={pedido.id}
                                className={`transition-all hover:shadow-md border-l-4 relative group ${esListo ? 'ring-2 ring-green-500 shadow-green-950/20 shadow-md glow-emerald' : 'glow-gold bg-card'}`}
                                style={{ borderLeftColor: status.borderColor }}
                            >
                                {/* Alerta visual cuando está listo */}
                                {esListo && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-[11px] font-black px-4 py-1 rounded-full shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 ring-4 ring-background animate-bounce z-20 whitespace-nowrap">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        🔔 ¡ENTREGAR A MESA!
                                    </div>
                                )}

                                {/* Botones de acción (arriba a la derecha solo en PC, en móvil van abajo) */}
                                <div className="hidden sm:flex absolute top-3 right-3 z-10 items-center gap-1">
                                    {puedeEntregar && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                            onClick={(e) => handleEntregar(e, pedido)} title="Marcar como entregado">
                                            <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {puedeEditar && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-950/20"
                                            onClick={(e) => handleEditar(e, pedido)} title="Editar pedido">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {puedeCobrar && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-950/20"
                                            onClick={(e) => handleCobrar(e, pedido)} title="Cobrar pedido">
                                            <DollarSign className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-950/20"
                                        onClick={(e) => handleDelete(e, pedido.id)} title="Eliminar pedido">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <CardContent className="p-4 flex items-center gap-4 bg-card">
                                    {/* Letrero + Ficha */}
                                    <div className="flex flex-col items-center justify-center min-w-[70px] border-r pr-4 border-dashed border-border">
                                        <div className="text-5xl font-black text-amber-100 bg-gradient-to-br from-amber-900 to-amber-950 border border-amber-800 rounded-xl w-16 h-16 flex items-center justify-center shadow-md shadow-black/30 ring-1 ring-amber-700/30">
                                            {pedido.numero_letrero || '?'}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-2 font-mono uppercase tracking-wider font-bold">
                                            Mesa {pedido.numero_letrero || '?'}
                                        </div>
                                        <div className="text-[9px] text-primary/70 font-mono">
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
                                                        ? 'bg-green-600 text-white font-black animate-pulse shadow-sm shadow-green-950 ring-2 ring-green-500 ring-offset-1 flex items-center gap-1'
                                                        : 'text-foreground/85 bg-muted font-medium whitespace-nowrap'
                                                        }`}
                                                >
                                                    {i.cantidad}× {i.nombre_item}
                                                    {i.estado_item === 'listo' && <CheckCircle2 className="w-3 h-3 inline" />}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <div className="text-xs text-muted-foreground">{pedido.items?.length} items</div>
                                            <div className="font-bold text-emerald-400 text-sm bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/30">
                                                Bs {Number(pedido.total || 0).toFixed(2)}
                                            </div>
                                        </div>

                                        {pedido.notas ? (
                                            <div className="mt-2 text-xs text-amber-400 bg-amber-950/30 p-2 rounded border border-amber-900/50 flex items-start gap-1">
                                                <span className="font-bold shrink-0">Notas:</span>
                                                <span className="italic">{pedido.notas}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </CardContent>

                                {/* Fila Inferior para botones de acción SOLAMENTE EN MÓVIL */}
                                <div className="sm:hidden flex items-center justify-end gap-2 border-t border-border bg-muted/20 p-2 overflow-x-auto">
                                    {puedeEntregar && (
                                        <Button variant="outline" size="sm" className="h-9 px-3 text-primary border-primary/20 hover:bg-primary/10 bg-muted/10"
                                            onClick={(e) => handleEntregar(e, pedido)}>
                                            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Entregar
                                        </Button>
                                    )}
                                    {puedeEditar && (
                                        <Button variant="outline" size="sm" className="h-9 px-3 text-blue-400 border-blue-900/30 hover:bg-blue-950/20 bg-muted/10"
                                            onClick={(e) => handleEditar(e, pedido)}>
                                            <Pencil className="h-4 w-4 mr-1.5" /> Editar
                                        </Button>
                                    )}
                                    {puedeCobrar && (
                                        <Button variant="outline" size="sm" className="h-9 px-3 text-emerald-400 border-emerald-900/30 hover:bg-emerald-950/20 bg-muted/10"
                                            onClick={(e) => handleCobrar(e, pedido)}>
                                            <DollarSign className="h-4 w-4 mr-1" /> Cobrar
                                        </Button>
                                    )}
                                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-red-400 hover:text-red-500 hover:bg-red-950/20 bg-muted/10 border-red-900/30"
                                        onClick={(e) => handleDelete(e, pedido.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
