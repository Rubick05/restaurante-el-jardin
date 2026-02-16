import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, Pedido } from '@/lib/bd/bd-local';
import { Button } from '@/componentes/ui/button';
import { Card, CardContent } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Clock, Hash, ChefHat } from 'lucide-react';
import { format } from 'date-fns';

interface ItemExtendido {
    pedidoId: string;
    numeroFicha: number; // Secuencial del día
    numeroLetrero: string; // Letrero físico (1-30)
    numeroPedido: string;
    itemIndex: number;
    nombre: string;
    cantidad: number;
    estado: 'pendiente' | 'en_proceso' | 'listo';
    categoria: string;
    creado_en: string;
}

export default function TableroCocina() {
    const queryClient = useQueryClient();

    // Polling cada 3 segundos
    const { data: itemsCocina = [] } = useQuery({
        queryKey: ['items-cocina'],
        queryFn: async () => {
            // Obtener pedidos activos
            const pedidosRaw = await bdLocal.pedidos
                .where('estado')
                .anyOf(['pendiente', 'en_proceso', 'listo', 'entregado'])
                .toArray();

            // Convertir a items individuales
            const todosLosItems: ItemExtendido[] = [];

            pedidosRaw.forEach(pedido => {
                (pedido.items || []).forEach((item, index) => {
                    // Filtrar bebidas/cervezas - estas las despacha el mesero
                    const cat = item.categoria?.toLowerCase() || '';
                    if (cat.includes('bebida') || cat.includes('cerveza') || cat.includes('refresco')) {
                        return; // Skip drinks
                    }

                    // Solo mostrar items que no estén listos (o que estén listos pero no entregados)
                    const estadoItem = item.estado_item || 'pendiente';
                    if (estadoItem === 'listo' && pedido.estado === 'entregado') {
                        return; // Skip already delivered items
                    }

                    todosLosItems.push({
                        pedidoId: pedido.id,
                        numeroFicha: pedido.numero_ficha,
                        numeroLetrero: pedido.numero_letrero || '?',
                        numeroPedido: pedido.numero_pedido,
                        itemIndex: index,
                        nombre: item.nombre_item,
                        cantidad: item.cantidad,
                        estado: estadoItem,
                        categoria: item.categoria || '',
                        creado_en: pedido.creado_en
                    });
                });
            });

            // Ordenar por fecha (FIFO)
            return todosLosItems.sort((a, b) =>
                new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime()
            );
        },
        refetchInterval: 3000,
    });

    const avanzarItem = async (item: ItemExtendido) => {
        const pedido = await bdLocal.pedidos.get(item.pedidoId);
        if (!pedido || !pedido.items) return;

        const nuevoEstado =
            item.estado === 'pendiente' ? 'en_proceso' :
                item.estado === 'en_proceso' ? 'listo' : 'listo';

        // Actualizar solo el item específico
        const itemsActualizados = pedido.items.map((it, idx) =>
            idx === item.itemIndex
                ? { ...it, estado_item: nuevoEstado }
                : it
        );

        await bdLocal.pedidos.update(item.pedidoId, {
            items: itemsActualizados,
            actualizado_en: new Date().toISOString()
        });

        queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
    };

    const columnas = {
        pendiente: itemsCocina.filter(i => i.estado === 'pendiente'),
        en_proceso: itemsCocina.filter(i => i.estado === 'en_proceso'),
        listo: itemsCocina.filter(i => i.estado === 'listo'),
    };

    const renderItem = (item: ItemExtendido) => (
        <Card
            key={`${item.pedidoId}-${item.itemIndex}`}
            className="transition-all hover:shadow-md border-l-4"
            style={{
                borderLeftColor:
                    item.estado === 'pendiente' ? '#94a3b8' :
                        item.estado === 'en_proceso' ? '#3b82f6' : '#22c55e'
            }}
        >
            <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="bg-slate-800 text-white rounded-lg w-10 h-10 flex items-center justify-center font-black text-lg">
                            {item.numeroLetrero}
                        </div>
                        <div>
                            <div className="font-bold text-sm">{item.cantidad}x {item.nombre}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(item.creado_en), 'HH:mm')}
                            </div>
                        </div>
                    </div>
                </div>

                <Badge variant="outline" className="text-xs mb-2">
                    {item.categoria}
                </Badge>

                <Button
                    onClick={() => avanzarItem(item)}
                    className="w-full mt-2"
                    size="sm"
                    variant={item.estado === 'listo' ? 'outline' : 'default'}
                >
                    {item.estado === 'pendiente' && '▶ Comenzar'}
                    {item.estado === 'en_proceso' && '✓ Marcar Listo'}
                    {item.estado === 'listo' && '✓ Listo'}
                </Button>
            </CardContent>
        </Card>
    );

    return (
        <div className="h-[calc(100vh-6rem)] p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">

                {/* Columna Pendientes */}
                <div className="bg-slate-100/50 rounded-lg p-4 flex flex-col h-full overflow-hidden border">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <ChefHat className="w-5 h-5" />
                            PENDIENTES
                        </span>
                        <Badge variant="secondary">{columnas.pendiente.length}</Badge>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {columnas.pendiente.map(renderItem)}
                        {columnas.pendiente.length === 0 && (
                            <div className="text-center text-muted-foreground text-sm py-10 opacity-50">
                                Sin items pendientes
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna En Proceso */}
                <div className="bg-blue-50/50 rounded-lg p-4 flex flex-col h-full overflow-hidden border-blue-200 border">
                    <h3 className="font-bold text-blue-700 mb-4 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <ChefHat className="w-5 h-5" />
                            EN PREPARACIÓN
                        </span>
                        <Badge className="bg-blue-200 text-blue-800">{columnas.en_proceso.length}</Badge>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {columnas.en_proceso.map(renderItem)}
                    </div>
                </div>

                {/* Columna Listo */}
                <div className="bg-green-50/50 rounded-lg p-4 flex flex-col h-full overflow-hidden border-green-200 border">
                    <h3 className="font-bold text-green-700 mb-4 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <ChefHat className="w-5 h-5" />
                            LISTO PARA ENTREGAR
                        </span>
                        <Badge className="bg-green-200 text-green-800">{columnas.listo.length}</Badge>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {columnas.listo.map(renderItem)}
                    </div>
                </div>
            </div>
        </div>
    );
}
