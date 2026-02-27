import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { Button } from '@/componentes/ui/button';
import { Card, CardContent } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Clock, ChefHat, PackageCheck, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { format } from 'date-fns';

// Categorías que prepara la COCINA
const CATEGORIAS_COCINA = ['Plato Fuerte', 'Caldos'];
const vaACocina = (categoria?: string): boolean => {
    if (!categoria) return true; // Sin categoría → a cocina por defecto
    // Comparación exacta primero (así como se guardan en el menú)
    if (CATEGORIAS_COCINA.includes(categoria)) return true;
    // Comparación flexible como respaldo
    const cat = categoria.toLowerCase().trim();
    return cat.includes('plato') || cat.includes('caldo') || cat.includes('fuerte');
};

interface ItemExtendido {
    pedidoId: string;
    numeroFicha: number;
    numeroLetrero: string;
    itemIndex: number;
    nombre: string;
    cantidad: number;
    estado: 'pendiente' | 'en_proceso' | 'listo';
    categoria: string;
    creado_en: string;
}

export default function TableroCocina() {
    const queryClient = useQueryClient();

    const { data: itemsCocina = [], isFetching, isError, refetch } = useQuery({
        queryKey: ['items-cocina'],
        queryFn: async () => {
            console.log("=== INICIANDO CARGA TABLERO COCINA ===");
            const todos = await bdLocal.pedidos.toArray();
            console.log(`1. Pedidos totales en BD: ${todos.length}`);

            const activos = todos.filter(p => p.estado !== 'pagado' && p.estado !== 'cancelado');
            console.log(`2. Pedidos activos (sin pagar/cancelar): ${activos.length}`);

            const items: ItemExtendido[] = [];

            for (const pedido of activos) {
                console.log(`-- Revisando pedido ${pedido.id} (estado: ${pedido.estado}) --`);
                const listaItems = pedido.items ?? [];

                if (listaItems.length === 0) {
                    console.warn(`   Pedido ${pedido.id} SIN ITEMS`);
                }

                for (let i = 0; i < listaItems.length; i++) {
                    const item = listaItems[i];
                    console.log(`   Item ${i}: "${item.nombre_item}" | Categoria: "${item.categoria}" | Estado_Item: "${item.estado_item}"`);

                    if (!vaACocina(item.categoria)) {
                        console.log(`      => Saltado (no va a cocina, categoria: ${item.categoria})`);
                        continue;
                    }

                    const st = item.estado_item ?? 'pendiente';
                    if (st === 'entregado') {
                        console.log(`      => Saltado (ya está 'entregado' individualmente)`);
                        continue;
                    }

                    console.log(`      => ACEPTADO PARA COCINA`);
                    items.push({
                        pedidoId: pedido.id,
                        numeroFicha: pedido.numero_ficha,
                        numeroLetrero: pedido.numero_letrero ?? '?',
                        itemIndex: i,
                        nombre: item.nombre_item,
                        cantidad: item.cantidad,
                        estado: (['pendiente', 'en_proceso', 'listo'].includes(st)
                            ? st : 'pendiente') as 'pendiente' | 'en_proceso' | 'listo',
                        categoria: item.categoria ?? '—',
                        creado_en: pedido.creado_en,
                    });
                }
            }

            console.log(`=== FIN CARGA: ${items.length} items para mostrar ===`, items);
            return items.sort((a, b) => {
                const ord = { pendiente: 0, en_proceso: 1, listo: 2 };
                const d = ord[a.estado] - ord[b.estado];
                return d !== 0 ? d : new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime();
            });
        },
        refetchInterval: 4000,
        refetchIntervalInBackground: true,
        retry: 3,
    });

    const avanzarItem = async (item: ItemExtendido) => {
        const pedido = await bdLocal.pedidos.get(item.pedidoId);
        if (!pedido?.items) return;

        const nuevoEstado: 'en_proceso' | 'listo' =
            item.estado === 'pendiente' ? 'en_proceso' : 'listo';

        const itemsActualizados = pedido.items.map((it, idx) =>
            idx === item.itemIndex ? { ...it, estado_item: nuevoEstado } : it
        );

        // Recalcular estado global del pedido
        const cocinables = itemsActualizados.filter(it => vaACocina(it.categoria));
        let nuevoEstadoPedido = pedido.estado;
        if (cocinables.length > 0) {
            const todosListos = cocinables.every(it =>
                it.estado_item === 'listo' || it.estado_item === 'entregado'
            );
            const algunoActivo = cocinables.some(it =>
                it.estado_item === 'en_proceso' || it.estado_item === 'listo'
            );
            if (todosListos) nuevoEstadoPedido = 'listo';
            else if (algunoActivo && pedido.estado === 'pendiente') nuevoEstadoPedido = 'en_proceso';
        }

        await bdLocal.pedidos.update(item.pedidoId, {
            items: itemsActualizados,
            estado: nuevoEstadoPedido,
            actualizado_en: new Date().toISOString(),
        });

        queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
    };

    const columnas = {
        pendiente: itemsCocina.filter(i => i.estado === 'pendiente'),
        en_proceso: itemsCocina.filter(i => i.estado === 'en_proceso'),
        listo: itemsCocina.filter(i => i.estado === 'listo'),
    };

    const renderItem = (item: ItemExtendido) => (
        <Card
            key={`${item.pedidoId}-${item.itemIndex}`}
            className="border-l-4 hover:shadow-md transition-all"
            style={{
                borderLeftColor:
                    item.estado === 'pendiente' ? '#94a3b8' :
                        item.estado === 'en_proceso' ? '#3b82f6' : '#22c55e',
            }}
        >
            <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-800 text-white rounded-lg w-10 h-10 flex items-center justify-center font-black text-lg shrink-0">
                        {item.numeroLetrero}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{item.cantidad}× {item.nombre}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(item.creado_en), 'HH:mm')}
                            <span className="text-muted-foreground/50 ml-1">· Ficha #{item.numeroFicha}</span>
                        </div>
                    </div>
                </div>

                <Badge variant="outline" className="text-xs">{item.categoria}</Badge>

                {item.estado === 'listo' ? (
                    <div className="flex items-center justify-center gap-2 py-1.5 rounded bg-green-100 text-green-700 text-sm font-semibold">
                        <PackageCheck className="w-4 h-4" /> Listo — Esperando al mesero
                    </div>
                ) : (
                    <Button
                        onClick={() => avanzarItem(item)}
                        className="w-full" size="sm"
                        variant={item.estado === 'pendiente' ? 'outline' : 'default'}
                    >
                        {item.estado === 'pendiente' ? '▶ Comenzar' : '✓ Marcar Listo'}
                    </Button>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="flex flex-col gap-3 h-[calc(100vh-7rem)] p-2 sm:p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-serif flex items-center gap-2">
                    <ChefHat className="w-6 h-6" />
                    Tablero de Cocina
                    <span className="text-sm font-normal text-muted-foreground">
                        — {itemsCocina.length} item(s)
                    </span>
                </h2>
                <div className="flex items-center gap-2">
                    {isFetching && (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Actualizando
                        </span>
                    )}
                    {isError && (
                        <span className="text-xs text-red-600 font-medium">⚠ Error de carga</span>
                    )}
                    <Button variant="outline" size="sm" onClick={() => refetch()}
                        disabled={isFetching} className="gap-1.5">
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* Banner informativo */}
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" />
                Cocina recibe: <strong>Plato Fuerte</strong> y <strong>Caldos</strong>
                &nbsp;·&nbsp; Refrescos y Cervezas → el mesero los sirve directamente
            </div>

            {/* Kanban — scroll horizontal en móvil, 3 columnas en desktop */}
            <div className="flex-1 overflow-hidden">
                <div className="flex md:grid md:grid-cols-3 gap-3 h-full overflow-x-auto pb-2 snap-x snap-mandatory">

                    {/* PENDIENTES */}
                    <div className="bg-slate-50 rounded-lg p-3 sm:p-4 flex flex-col overflow-hidden border snap-start shrink-0 w-[82vw] md:w-auto min-w-0">
                        <h3 className="font-bold text-slate-700 mb-3 flex items-center justify-between shrink-0">
                            <span className="flex items-center gap-2">
                                <UtensilsCrossed className="w-4 h-4" /> PENDIENTES
                            </span>
                            <Badge variant="secondary">{columnas.pendiente.length}</Badge>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {columnas.pendiente.length === 0
                                ? <p className="text-center text-muted-foreground text-sm py-10 opacity-40">Sin pedidos pendientes</p>
                                : columnas.pendiente.map(renderItem)}
                        </div>
                    </div>

                    {/* EN PREPARACIÓN */}
                    <div className="bg-blue-50/60 rounded-lg p-3 sm:p-4 flex flex-col overflow-hidden border border-blue-200 snap-start shrink-0 w-[82vw] md:w-auto min-w-0">
                        <h3 className="font-bold text-blue-700 mb-3 flex items-center justify-between shrink-0">
                            <span className="flex items-center gap-2">
                                <ChefHat className="w-4 h-4" /> EN PREPARACIÓN
                            </span>
                            <Badge className="bg-blue-200 text-blue-800">{columnas.en_proceso.length}</Badge>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {columnas.en_proceso.length === 0
                                ? <p className="text-center text-muted-foreground text-sm py-10 opacity-40">Sin items en proceso</p>
                                : columnas.en_proceso.map(renderItem)}
                        </div>
                    </div>

                    {/* LISTO */}
                    <div className="bg-green-50/60 rounded-lg p-3 sm:p-4 flex flex-col overflow-hidden border border-green-200 snap-start shrink-0 w-[82vw] md:w-auto min-w-0">
                        <h3 className="font-bold text-green-700 mb-3 flex items-center justify-between shrink-0">
                            <span className="flex items-center gap-2">
                                <PackageCheck className="w-4 h-4" /> LISTO PARA ENTREGAR
                            </span>
                            <Badge className="bg-green-200 text-green-800">{columnas.listo.length}</Badge>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {columnas.listo.length === 0
                                ? <p className="text-center text-muted-foreground text-sm py-10 opacity-40">Nada listo aún</p>
                                : columnas.listo.map(renderItem)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
