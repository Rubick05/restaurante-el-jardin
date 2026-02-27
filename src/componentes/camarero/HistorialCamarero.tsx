import { useQuery } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { useAuth } from '@/lib/auth/contexto-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { ClipboardList, Calendar, Hash, MapPin, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function HistorialCamarero() {
    const { usuarioActual } = useAuth();

    const { data: pedidos = [] } = useQuery({
        queryKey: ['historial-camarero', usuarioActual?.id],
        queryFn: async () => {
            if (!usuarioActual) return [];
            const todos = await bdLocal.pedidos.toArray();
            // Filtrar por el id del camarero actual
            return todos
                .filter(p => p.id_mesero === usuarioActual.id)
                .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
        },
        enabled: !!usuarioActual,
        refetchInterval: 10000,
    });

    const totalGanado = pedidos
        .filter(p => p.estado === 'pagado')
        .reduce((acc, p) => acc + p.total, 0);

    const getEstadoBadge = (estado: string) => {
        const map: Record<string, { label: string; className: string }> = {
            pendiente: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
            en_proceso: { label: 'En Proceso', className: 'bg-blue-100 text-blue-800 border-blue-200' },
            listo: { label: 'Listo', className: 'bg-green-100 text-green-800 border-green-200' },
            entregado: { label: 'Entregado', className: 'bg-slate-100 text-slate-700 border-slate-200' },
            pagado: { label: 'Pagado ✓', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
            cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-200' },
        };
        return map[estado] || { label: estado, className: 'bg-gray-100 text-gray-700' };
    };

    // Agrupar por fecha
    const agrupados = pedidos.reduce<Record<string, typeof pedidos>>((acc, p) => {
        const fecha = format(new Date(p.creado_en), 'yyyy-MM-dd');
        if (!acc[fecha]) acc[fecha] = [];
        acc[fecha].push(p);
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary font-serif flex items-center gap-2">
                        <ClipboardList className="w-8 h-8" />
                        Mi Historial
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Pedidos atendidos por <span className="font-semibold">{usuarioActual?.nombre}</span>
                    </p>
                </div>
            </div>

            {/* Cards resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Hash className="w-8 h-8 text-blue-500" />
                        <div>
                            <div className="text-2xl font-bold">{pedidos.length}</div>
                            <div className="text-xs text-muted-foreground">Pedidos Totales</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-green-500" />
                        <div>
                            <div className="text-2xl font-bold">Bs {totalGanado.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">Total Cobrado</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-orange-500" />
                        <div>
                            <div className="text-2xl font-bold">{Object.keys(agrupados).length}</div>
                            <div className="text-xs text-muted-foreground">Días Trabajados</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lista por fecha */}
            {Object.keys(agrupados).length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No tienes pedidos registrados aún</p>
                    </CardContent>
                </Card>
            ) : (
                Object.entries(agrupados)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([fecha, pedidosDia]) => (
                        <Card key={fecha}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {format(new Date(fecha + 'T12:00:00'), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                                    <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded">
                                        {pedidosDia.length} pedido(s)
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y">
                                    {pedidosDia.map(pedido => {
                                        const badge = getEstadoBadge(pedido.estado);
                                        return (
                                            <div key={pedido.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                                                <span className="font-mono font-bold text-lg text-primary/70 w-8">
                                                    #{pedido.numero_ficha}
                                                </span>
                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    <span className="font-bold text-foreground">{pedido.numero_letrero || '-'}</span>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(pedido.creado_en), 'HH:mm')}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {pedido.items?.length || 0} items
                                                </span>
                                                <div className="ml-auto flex items-center gap-3">
                                                    <span className="font-bold text-green-700">
                                                        Bs {pedido.total.toFixed(2)}
                                                    </span>
                                                    <Badge className={`text-xs border ${badge.className}`}>
                                                        {badge.label}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="px-4 py-2 text-right text-sm font-bold text-green-700 bg-green-50/50">
                                        Total del día: Bs {pedidosDia.reduce((acc, p) => acc + p.total, 0).toFixed(2)}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
            )}
        </div>
    );
}
