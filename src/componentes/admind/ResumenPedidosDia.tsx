import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, Pedido } from '@/lib/bd/bd-local';
import { USUARIOS_SISTEMA } from '@/lib/auth/usuarios';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Button } from '@/componentes/ui/button';
import { Calendar, DollarSign, Hash, MapPin, X, UtensilsCrossed, UserCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { API_BASE_URL } from '@/hooks/useInicializacion';

function nombreMesero(idMesero: string): string {
    const usuario = USUARIOS_SISTEMA.find(u => u.id === idMesero);
    return usuario?.nombre ?? idMesero;
}

export default function ResumenPedidosDia() {
    const queryClient = useQueryClient();
    const [procesando, setProcesando] = useState(false);

    const { data: pedidosDia = [], isLoading, refetch } = useQuery({
        queryKey: ['pedidos-dia'],
        queryFn: async (): Promise<Pedido[]> => {
            // Intentar cargar desde servidor primero
            try {
                const res = await fetch(`${API_BASE_URL}/api/pedidos?hoy=true`);
                if (res.ok) {
                    const data = await res.json();
                    // Sincronizar en IndexedDB local
                    for (const p of data as Pedido[]) {
                        await bdLocal.pedidos.put(p);
                    }
                    return (data as Pedido[]).sort((a, b) => a.numero_ficha - b.numero_ficha);
                }
            } catch {
                // Sin red: usar IndexedDB local
            }
            // Fallback: IndexedDB local
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const todos = await bdLocal.pedidos
                .where('creado_en')
                .above(hoy.toISOString())
                .toArray();
            return todos.sort((a, b) => a.numero_ficha - b.numero_ficha);
        },
        refetchInterval: 10000
    });

    const totalDia = pedidosDia.reduce((acc, p) => acc + p.total, 0);
    const totalItems = pedidosDia.reduce((acc, p) => acc + (p.items?.length || 0), 0);

    const cerrarDia = async () => {
        if (!confirm('¿Cerrar el día? Se guardará el resumen para el historial y todos los pedidos quedarán archivados.')) return;
        setProcesando(true);
        try {
            const apiUrl = API_BASE_URL;

            if (apiUrl) {
                // Cerrar vía servidor
                const res = await fetch(`${apiUrl}/api/pedidos/cerrar-dia`, { method: 'POST' });
                if (!res.ok) throw new Error('Error del servidor');
                const data = await res.json();
                await queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
                await queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
                await queryClient.invalidateQueries({ queryKey: ['dias-cerrados'] });
                alert(`✅ Día cerrado. Total: Bs ${data.total_recaudado?.toFixed(2)}`);
            } else {
                // Offline: cerrar localmente
                const hoy = new Date();
                const fechaStr = hoy.toISOString().slice(0, 10);
                for (const pedido of pedidosDia) {
                    if (pedido.estado !== 'pagado') {
                        await bdLocal.pedidos.update(pedido.id, {
                            estado: 'pagado',
                            actualizado_en: new Date().toISOString()
                        });
                    }
                }
                await bdLocal.diasCerrados.put({
                    id: fechaStr,
                    fecha: fechaStr,
                    total_recaudado: totalDia,
                    total_pedidos: pedidosDia.length,
                    total_items: totalItems,
                    pedidos_snapshot: JSON.stringify(pedidosDia),
                    cerrado_en: new Date().toISOString(),
                });
                await queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
                await queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
                await queryClient.invalidateQueries({ queryKey: ['dias-cerrados'] });
                alert(`✅ Día cerrado. Total recaudado: Bs ${totalDia.toFixed(2)}\n${pedidosDia.length} pedidos archivados.`);
            }
        } catch {
            alert('Error al cerrar el día');
        } finally {
            setProcesando(false);
        }
    };

    const getEstadoBadge = (estado: string) => {
        const map: Record<string, { label: string; className: string }> = {
            pendiente: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
            en_proceso: { label: 'En Proceso', className: 'bg-blue-100 text-blue-800 border-blue-200' },
            listo: { label: 'Listo', className: 'bg-green-100 text-green-800 border-green-200' },
            entregado: { label: 'Entregado', className: 'bg-slate-100 text-slate-600 border-slate-200' },
            pagado: { label: 'Pagado ✓', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
            cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700 border-red-200' },
        };
        return map[estado] || { label: estado, className: 'bg-gray-100 text-gray-600' };
    };

    return (
        <div className="space-y-4">
            {/* Encabezado responsive */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 font-serif">
                        <Calendar className="w-6 h-6 sm:w-8 sm:h-8" />
                        Pedidos del Día
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        onClick={cerrarDia}
                        disabled={procesando || pedidosDia.length === 0}
                        className="bg-blue-600 hover:bg-blue-700"
                        size="sm"
                    >
                        <X className="mr-1.5 h-4 w-4" />
                        Cerrar Día
                    </Button>
                </div>
            </div>

            {/* Cards de Resumen — 3 columnas en desktop, 2 en tablet, 1 en móvil */}
            <div className="grid grid-cols-3 gap-3">
                <Card>
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                        <Hash className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 shrink-0" />
                        <div>
                            <div className="text-xl sm:text-2xl font-bold">{pedidosDia.length}</div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">Pedidos</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                        <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 shrink-0" />
                        <div>
                            <div className="text-xl sm:text-2xl font-bold">Bs {totalDia.toFixed(0)}</div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">Total Día</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                        <UtensilsCrossed className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 shrink-0" />
                        <div>
                            <div className="text-xl sm:text-2xl font-bold">{totalItems}</div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">Items</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de pedidos */}
            <Card>
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base">Listado de Pedidos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="text-center p-8 text-muted-foreground">Cargando pedidos...</div>
                    ) : pedidosDia.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground">
                            Sin pedidos registrados hoy
                        </div>
                    ) : (
                        <>
                            {/* Vista TABLA en desktop */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="text-left p-3 text-sm font-semibold">Ficha</th>
                                            <th className="text-left p-3 text-sm font-semibold">Letrero</th>
                                            <th className="text-left p-3 text-sm font-semibold">Hora</th>
                                            <th className="text-left p-3 text-sm font-semibold">Mesero</th>
                                            <th className="text-left p-3 text-sm font-semibold">Items</th>
                                            <th className="text-right p-3 text-sm font-semibold">Total</th>
                                            <th className="text-center p-3 text-sm font-semibold">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pedidosDia.map(pedido => {
                                            const estado = getEstadoBadge(pedido.estado);
                                            return (
                                                <tr key={pedido.id} className="border-b hover:bg-slate-50 transition-colors">
                                                    <td className="p-3">
                                                        <span className="font-mono font-bold text-lg">#{pedido.numero_ficha}</span>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="font-black text-2xl text-slate-800">{pedido.numero_letrero || '-'}</span>
                                                    </td>
                                                    <td className="p-3 text-sm">{format(new Date(pedido.creado_en), 'HH:mm')}</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-1.5 text-sm">
                                                            <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                                            <span>{nombreMesero(pedido.id_mesero)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-sm text-muted-foreground">{pedido.items?.length || 0} items</td>
                                                    <td className="p-3 text-right font-bold text-green-700">Bs {pedido.total.toFixed(2)}</td>
                                                    <td className="p-3 text-center">
                                                        <Badge className={`text-xs border ${estado.className}`}>{estado.label}</Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Vista CARDS en móvil */}
                            <div className="sm:hidden divide-y">
                                {pedidosDia.map(pedido => {
                                    const estado = getEstadoBadge(pedido.estado);
                                    return (
                                        <div key={pedido.id} className="p-4 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-bold text-xl">#{pedido.numero_ficha}</span>
                                                    {pedido.numero_letrero && (
                                                        <div className="flex items-center gap-1 text-slate-600">
                                                            <MapPin className="w-3 h-3" />
                                                            <span className="font-black text-lg">{pedido.numero_letrero}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <Badge className={`text-xs border ${estado.className}`}>{estado.label}</Badge>
                                            </div>
                                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <UserCircle className="w-3.5 h-3.5" />
                                                    <span>{nombreMesero(pedido.id_mesero)}</span>
                                                    <span>· {format(new Date(pedido.creado_en), 'HH:mm')}</span>
                                                    <span>· {pedido.items?.length || 0} items</span>
                                                </div>
                                                <span className="font-bold text-green-700">Bs {pedido.total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
