import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { USUARIOS_SISTEMA } from '@/lib/auth/usuarios';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Button } from '@/componentes/ui/button';
import { Calendar, DollarSign, Hash, MapPin, X, UtensilsCrossed, UserCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';

/** Devuelve el nombre del mesero dado su id, usando la lista de usuarios del sistema */
function nombreMesero(idMesero: string): string {
    const usuario = USUARIOS_SISTEMA.find(u => u.id === idMesero);
    return usuario?.nombre ?? idMesero;
}

export default function ResumenPedidosDia() {
    const queryClient = useQueryClient();
    const [procesando, setProcesando] = useState(false);

    const { data: pedidosDia = [] } = useQuery({
        queryKey: ['pedidos-dia'],
        queryFn: async () => {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const todos = await bdLocal.pedidos
                .where('creado_en')
                .above(hoy.toISOString())
                .toArray();
            return todos.sort((a, b) => a.numero_ficha - b.numero_ficha);
        },
        refetchInterval: 5000
    });

    const totalDia = pedidosDia.reduce((acc, p) => acc + p.total, 0);
    const totalItems = pedidosDia.reduce((acc, p) => acc + (p.items?.length || 0), 0);

    const cerrarDia = async () => {
        if (!confirm('¿Cerrar el día? Se guardará el resumen para el historial y todos los pedidos quedarán archivados.')) return;
        setProcesando(true);
        try {
            const hoy = new Date();
            const fechaStr = hoy.toISOString().slice(0, 10); // YYYY-MM-DD

            // Marcar todos como pagados si no lo están
            for (const pedido of pedidosDia) {
                if (pedido.estado !== 'pagado') {
                    await bdLocal.pedidos.update(pedido.id, {
                        estado: 'pagado',
                        actualizado_en: new Date().toISOString()
                    });
                }
            }

            // Guardar snapshot del día en diasCerrados
            const diaCerrado = {
                id: fechaStr,
                fecha: fechaStr,
                total_recaudado: totalDia,
                total_pedidos: pedidosDia.length,
                total_items: totalItems,
                pedidos_snapshot: JSON.stringify(pedidosDia),
                cerrado_en: new Date().toISOString(),
            };
            await bdLocal.diasCerrados.put(diaCerrado);

            await queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
            await queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            await queryClient.invalidateQueries({ queryKey: ['dias-cerrados'] });
            alert(`✅ Día cerrado. Total recaudado: Bs ${totalDia.toFixed(2)}\n${pedidosDia.length} pedidos archivados en el historial.`);
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
        <div className="space-y-6">
            {/* Encabezado */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2 font-serif">
                        <Calendar className="w-8 h-8" />
                        Pedidos del Día
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                    </p>
                </div>
                <Button
                    onClick={cerrarDia}
                    disabled={procesando || pedidosDia.length === 0}
                    className="bg-blue-600 hover:bg-blue-700"
                    size="lg"
                >
                    <X className="mr-2 h-5 w-5" />
                    Cerrar Día
                </Button>
            </div>

            {/* Cards de Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Hash className="w-8 h-8 text-blue-500" />
                        <div>
                            <div className="text-2xl font-bold">{pedidosDia.length}</div>
                            <div className="text-xs text-muted-foreground">Pedidos</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-green-500" />
                        <div>
                            <div className="text-2xl font-bold">Bs {totalDia.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">Total del Día</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <UtensilsCrossed className="w-8 h-8 text-orange-500" />
                        <div>
                            <div className="text-2xl font-bold">{totalItems}</div>
                            <div className="text-xs text-muted-foreground">Items Totales</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla de Pedidos */}
            <Card>
                <CardHeader>
                    <CardTitle>Listado de Pedidos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
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
                                {pedidosDia.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center p-8 text-muted-foreground">
                                            Sin pedidos registrados hoy
                                        </td>
                                    </tr>
                                ) : (
                                    pedidosDia.map(pedido => {
                                        const estado = getEstadoBadge(pedido.estado);
                                        const mesero = nombreMesero(pedido.id_mesero);
                                        return (
                                            <tr key={pedido.id} className="border-b hover:bg-slate-50 transition-colors">
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <Hash className="w-4 h-4 text-muted-foreground" />
                                                        <span className="font-mono font-bold text-lg">
                                                            {pedido.numero_ficha}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="w-4 h-4 text-muted-foreground" />
                                                        <span className="font-black text-2xl text-slate-800">
                                                            {pedido.numero_letrero || '-'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-sm">
                                                    {format(new Date(pedido.creado_en), 'HH:mm')}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5 text-sm">
                                                        <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                                        <span className="font-medium">{mesero}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-sm text-muted-foreground">
                                                    {pedido.items?.length || 0} items
                                                </td>
                                                <td className="p-3 text-right font-bold text-green-700">
                                                    Bs {pedido.total.toFixed(2)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <Badge className={`text-xs border ${estado.className}`}>
                                                        {estado.label}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

