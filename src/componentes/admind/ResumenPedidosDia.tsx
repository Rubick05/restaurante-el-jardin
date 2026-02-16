import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Button } from '@/componentes/ui/button';
import { Calendar, DollarSign, Hash, MapPin, X, UtensilsCrossed } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';

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

            // Ordenar por numero_ficha (secuencial)
            return todos.sort((a, b) => a.numero_ficha - b.numero_ficha);
        },
        refetchInterval: 5000
    });

    const totalDia = pedidosDia.reduce((acc, p) => acc + p.total, 0);
    const totalItems = pedidosDia.reduce((acc, p) => acc + (p.items?.length || 0), 0);

    const cerrarDia = async () => {
        if (!confirm('Cerrar el dia? Esto marcara todos los pedidos como archivados y reiniciara los contadores para manana.')) {
            return;
        }

        setProcesando(true);
        try {
            // Marcar todos los pedidos del día como archivados
            for (const pedido of pedidosDia) {
                await bdLocal.pedidos.update(pedido.id, {
                    estado: 'pagado',
                    actualizado_en: new Date().toISOString()
                });
            }

            await queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
            await queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });

            alert(`Dia cerrado. Total recaudado: $${totalDia.toFixed(2)}\n${pedidosDia.length} pedidos archivados\nEl sistema esta listo para manana.`);
        } catch (error) {
            alert('Error al cerrar el dia');
        } finally {
            setProcesando(false);
        }
    };

    const getEstadoBadge = (estado: string) => {
        const map: Record<string, any> = {
            pendiente: { label: 'Pendiente', variant: 'secondary' },
            en_proceso: { label: 'En Proceso', variant: 'default' },
            listo: { label: 'Listo', variant: 'default' },
            entregado: { label: 'Entregado', variant: 'outline' },
            pagado: { label: 'Pagado', variant: 'default' },
            cancelado: { label: 'Cancelado', variant: 'destructive' }
        };
        return map[estado] || { label: estado, variant: 'outline' };
    };

    return (
        <div className="p-6 space-y-6">
            {/* Encabezado con Resumen */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Calendar className="w-8 h-8" />
                        Pedidos del Día
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
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
                            <div className="text-2xl font-bold">${totalDia.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">Total</div>
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
                                    <th className="text-left p-3 text-sm font-semibold">Items</th>
                                    <th className="text-right p-3 text-sm font-semibold">Total</th>
                                    <th className="text-center p-3 text-sm font-semibold">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pedidosDia.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-muted-foreground">
                                            Sin pedidos registrados hoy
                                        </td>
                                    </tr>
                                ) : (
                                    pedidosDia.map(pedido => {
                                        const estado = getEstadoBadge(pedido.estado);
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
                                                <td className="p-3 text-sm">
                                                    {pedido.items?.length || 0} items
                                                </td>
                                                <td className="p-3 text-right font-bold text-green-700">
                                                    ${pedido.total.toFixed(2)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <Badge variant={estado.variant as any}>
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
