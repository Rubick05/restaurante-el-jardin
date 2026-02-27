import { useQuery } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { ChefHat, Calendar, Hash, UtensilsCrossed } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function HistorialCocina() {
    const { data: pedidos = [] } = useQuery({
        queryKey: ['historial-cocina'],
        queryFn: async () => {
            const todos = await bdLocal.pedidos.toArray();
            // Cocina ve todos los pedidos que tuvieron items en cocina (platos fuertes o caldos)
            // Es decir: pedidos que no son solo bebidas — los que tienen estado: listo, entregado, pagado
            return todos
                .filter(p => ['listo', 'entregado', 'pagado', 'en_proceso'].includes(p.estado))
                .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
        },
        refetchInterval: 10000,
    });

    const totalPlatos = pedidos.reduce(
        (acc, p) => acc + (p.items?.filter(i =>
            !['Refrescos', 'Cervezas'].includes(i.categoria || '')
        ).reduce((s, i) => s + i.cantidad, 0) || 0),
        0
    );

    // Agrupar por fecha
    const agrupados = pedidos.reduce<Record<string, typeof pedidos>>((acc, p) => {
        const fecha = format(new Date(p.creado_en), 'yyyy-MM-dd');
        if (!acc[fecha]) acc[fecha] = [];
        acc[fecha].push(p);
        return acc;
    }, {});

    const getEstadoColor = (estado: string) => {
        const map: Record<string, string> = {
            en_proceso: 'bg-blue-100 text-blue-800 border-blue-200',
            listo: 'bg-green-100 text-green-800 border-green-200',
            entregado: 'bg-slate-100 text-slate-600 border-slate-200',
            pagado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
        return map[estado] || 'bg-gray-100 text-gray-600';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-primary font-serif flex items-center gap-2">
                    <ChefHat className="w-8 h-8" />
                    Historial de Cocina
                </h2>
                <p className="text-muted-foreground mt-1">
                    Pedidos procesados por cocina
                </p>
            </div>

            {/* Cards resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Hash className="w-8 h-8 text-blue-500" />
                        <div>
                            <div className="text-2xl font-bold">{pedidos.length}</div>
                            <div className="text-xs text-muted-foreground">Pedidos Procesados</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <UtensilsCrossed className="w-8 h-8 text-orange-500" />
                        <div>
                            <div className="text-2xl font-bold">{totalPlatos}</div>
                            <div className="text-xs text-muted-foreground">Platos Preparados</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-green-500" />
                        <div>
                            <div className="text-2xl font-bold">{Object.keys(agrupados).length}</div>
                            <div className="text-xs text-muted-foreground">Días de Servicio</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lista por fecha */}
            {Object.keys(agrupados).length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No hay pedidos procesados aún</p>
                    </CardContent>
                </Card>
            ) : (
                Object.entries(agrupados)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([fecha, pedidosDia]) => {
                        const platosDia = pedidosDia.reduce(
                            (acc, p) => acc + (p.items?.filter(i =>
                                !['Refrescos', 'Cervezas'].includes(i.categoria || '')
                            ).reduce((s, i) => s + i.cantidad, 0) || 0),
                            0
                        );
                        return (
                            <Card key={fecha}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {format(new Date(fecha + 'T12:00:00'), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                                        <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded">
                                            {pedidosDia.length} pedidos · {platosDia} platos
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y">
                                        {pedidosDia.map(pedido => {
                                            const platosEnPedido = pedido.items
                                                ?.filter(i => !['Refrescos', 'Cervezas'].includes(i.categoria || ''))
                                                ?? [];
                                            return (
                                                <div key={pedido.id} className="px-4 py-3 hover:bg-muted/30">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="font-mono font-bold text-primary/70">
                                                            Ficha #{pedido.numero_ficha}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(new Date(pedido.creado_en), 'HH:mm')}
                                                        </span>
                                                        <span className="text-sm text-muted-foreground">
                                                            Letrero: <strong>{pedido.numero_letrero || '-'}</strong>
                                                        </span>
                                                        <Badge className={`ml-auto text-xs border ${getEstadoColor(pedido.estado)}`}>
                                                            {pedido.estado.replace('_', ' ')}
                                                        </Badge>
                                                    </div>
                                                    {platosEnPedido.length > 0 && (
                                                        <div className="text-xs text-muted-foreground space-y-0.5 pl-2 border-l-2 border-primary/20">
                                                            {platosEnPedido.map((item, idx) => (
                                                                <div key={idx}>
                                                                    {item.cantidad}× {item.nombre_item}
                                                                    <span className="text-primary/50 ml-1">({item.categoria})</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
            )}
        </div>
    );
}
