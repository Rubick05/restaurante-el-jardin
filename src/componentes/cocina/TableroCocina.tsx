import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { Button } from '@/componentes/ui/button';
import { Card, CardContent } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { 
    Clock, ChefHat, PackageCheck, RefreshCw, UtensilsCrossed, 
    Bike, Store, AlertCircle, CheckCircle2, Eye, X, Phone, MapPin, 
    DollarSign, ExternalLink, ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { API_BASE_URL, normalizarPedidos } from '@/hooks/useInicializacion';
import { supabase } from '@/hooks/useSupabaseSync';

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
    itemId?: string;
    numeroFicha: number;
    numeroLetrero: string;
    itemIndex: number;
    nombre: string;
    cantidad: number;
    estado: 'pendiente' | 'en_proceso' | 'listo';
    categoria: string;
    creado_en: string;
    // Datos adicionales para pedidos web (Delivery / Reserva)
    esWeb?: boolean;
    tipoEntrega?: 'delivery' | 'reserva' | 'mesa';
    clienteNombre?: string;
    clienteTelefono?: string;
    direccion?: string;
    comprobanteUrl?: string | null;
    total?: number;
    montoAnticipo?: number;
    saldoPendiente?: number;
    pagoConfirmado?: boolean;
    datosFacturacion?: any;
}

export default function TableroCocina() {
    const queryClient = useQueryClient();
    const [pedidoParaPago, setPedidoParaPago] = useState<ItemExtendido | null>(null);
    const [comprobanteZoom, setComprobanteZoom] = useState<string | null>(null);
    const [guardandoPago, setGuardandoPago] = useState(false);

    const { data: itemsCocina = [], isFetching, isError, refetch } = useQuery({
        queryKey: ['items-cocina'],
        queryFn: async () => {
            // 1. Cargar pedidos desde servidor primero para sincronizar
            try {
                const res = await fetch(`${API_BASE_URL}/api/pedidos`);
                if (res.ok) {
                    const pedidosServidor = await res.json();
                    await bdLocal.pedidos.bulkPut(pedidosServidor);
                } else if (supabase) {
                    // Fallback directo a Supabase si el servidor no responde
                    const { data } = await supabase
                        .from('pedidos')
                        .select('*, items:items_pedido(*)')
                        .not('estado', 'in', '("pagado","cancelado")');
                    if (data && data.length > 0) {
                        const normalizados = normalizarPedidos(data);
                        await bdLocal.pedidos.bulkPut(normalizados);
                    }
                }
            } catch {
                if (supabase) {
                    try {
                        const { data } = await supabase
                            .from('pedidos')
                            .select('*, items:items_pedido(*)')
                            .not('estado', 'in', '("pagado","cancelado")');
                        if (data && data.length > 0) {
                            const normalizados = normalizarPedidos(data);
                            await bdLocal.pedidos.bulkPut(normalizados);
                        }
                    } catch { /* offline: usar IndexedDB local */ }
                }
            }

            const todos = await bdLocal.pedidos.toArray();
            const activos = todos.filter(p => p.estado !== 'pagado' && p.estado !== 'cancelado');

            const items: ItemExtendido[] = [];

            for (const pedido of activos) {
                const listaItems = pedido.items ?? [];
                const df = (pedido.datos_facturacion || {}) as any;
                
                const esWeb = Boolean(
                    df.origen?.startsWith('web_') || 
                    pedido.id_mesero === 'web-online' || 
                    df.tipo_entrega === 'delivery' || 
                    df.tipo_entrega === 'reserva'
                );
                const tipoEntrega: 'delivery' | 'reserva' | 'mesa' = 
                    df.tipo_entrega || 
                    (df.origen === 'web_delivery' ? 'delivery' : (df.origen === 'web_reserva' ? 'reserva' : 'mesa'));
                
                const clienteNombre = df.cliente_nombre || df.razon_social || '';
                const clienteTelefono = df.cliente_telefono || '';
                const direccion = df.direccion ? `${df.direccion}${df.zona ? ` (${df.zona})` : ''}` : '';
                const comprobanteUrl = df.comprobante_url || df.comprobante_preview || null;
                const total = Number(pedido.total ?? df.total_estimado ?? 0);
                const montoAnticipo = Number(df.monto_anticipo ?? 0);
                const saldoPendiente = df.saldo_pendiente !== undefined 
                    ? Number(df.saldo_pendiente) 
                    : Math.max(0, total - montoAnticipo);
                const pagoConfirmado = Boolean(df.pago_confirmado);

                let letreroDisplay = pedido.numero_letrero ?? '?';
                if (esWeb) {
                    letreroDisplay = tipoEntrega === 'delivery' ? '🛵 D' : '🪴 R';
                }

                for (let i = 0; i < listaItems.length; i++) {
                    const item = listaItems[i];

                    if (!vaACocina(item.categoria)) {
                        continue;
                    }

                    const st = item.estado_item ?? 'pendiente';
                    if (st === 'entregado') {
                        continue;
                    }

                    items.push({
                        pedidoId: pedido.id,
                        itemId: item.id,
                        numeroFicha: pedido.numero_ficha,
                        numeroLetrero: letreroDisplay,
                        itemIndex: i,
                        nombre: item.nombre_item,
                        cantidad: item.cantidad,
                        estado: (['pendiente', 'en_proceso', 'listo'].includes(st)
                            ? st : 'pendiente') as 'pendiente' | 'en_proceso' | 'listo',
                        categoria: item.categoria ?? '—',
                        creado_en: pedido.creado_en,
                        esWeb,
                        tipoEntrega,
                        clienteNombre,
                        clienteTelefono,
                        direccion,
                        comprobanteUrl,
                        total,
                        montoAnticipo,
                        saldoPendiente,
                        pagoConfirmado,
                        datosFacturacion: df,
                    });
                }
            }

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

        // ── Sincronizar con servidor ──
        try {
            await fetch(`${API_BASE_URL}/api/pedidos/${item.pedidoId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: nuevoEstadoPedido,
                    item_id: item.itemId,
                    estado_item: nuevoEstado,
                    nuevosItems: itemsActualizados,
                    items: itemsActualizados,
                }),
            });
        } catch {
            // Offline — cambios guardados local
        }

        if (supabase) {
            try {
                if (item.itemId) {
                    await supabase.from('items_pedido').update({
                        estado_item: nuevoEstado,
                        actualizado_en: new Date().toISOString()
                    }).eq('id', item.itemId);
                }
                await supabase.from('pedidos').update({
                    estado: nuevoEstadoPedido,
                    actualizado_en: new Date().toISOString()
                }).eq('id', item.pedidoId);
            } catch (e) {
                console.warn('Error sincronizando con Supabase:', e);
            }
        }

        queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
    };

    // Confirmar pago del pedido web y opcionalmente mover a preparación
    const ejecutarConfirmacionPago = async (item: ItemExtendido, moverAPreparacion: boolean) => {
        try {
            setGuardandoPago(true);
            const pedido = await bdLocal.pedidos.get(item.pedidoId);
            if (!pedido) return;

            const datosFacturacionActualizados = {
                ...(pedido.datos_facturacion || {}),
                pago_confirmado: true,
                pago_confirmado_en: new Date().toISOString(),
            };

            let nuevoEstadoPedido = pedido.estado;
            let itemsActualizados = pedido.items ?? [];

            if (moverAPreparacion) {
                nuevoEstadoPedido = 'en_proceso';
                itemsActualizados = itemsActualizados.map(it => {
                    if (vaACocina(it.categoria) && (it.estado_item === 'pendiente' || !it.estado_item)) {
                        return { ...it, estado_item: 'en_proceso' as const };
                    }
                    return it;
                });
            }

            await bdLocal.pedidos.update(item.pedidoId, {
                datos_facturacion: datosFacturacionActualizados as any,
                estado: nuevoEstadoPedido,
                items: itemsActualizados,
                actualizado_en: new Date().toISOString(),
            });

            // 1. Sincronizar vía API
            try {
                await fetch(`${API_BASE_URL}/api/pedidos/${item.pedidoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        datos_facturacion: datosFacturacionActualizados,
                        estado: nuevoEstadoPedido,
                        nuevosItems: itemsActualizados,
                        items: itemsActualizados,
                    }),
                });
            } catch (e) {
                console.warn('Error PATCH api pedidos:', e);
            }

            // 2. Sincronizar con Supabase
            if (supabase) {
                try {
                    await supabase.from('pedidos').update({
                        datos_facturacion: datosFacturacionActualizados,
                        estado: nuevoEstadoPedido,
                        actualizado_en: new Date().toISOString(),
                    }).eq('id', item.pedidoId);

                    if (moverAPreparacion) {
                        await supabase.from('items_pedido').update({
                            estado_item: 'en_proceso',
                            actualizado_en: new Date().toISOString()
                        }).eq('id_pedido', item.pedidoId).eq('estado_item', 'pendiente');
                    }
                } catch (e) {
                    console.warn('Error actualizando pago en Supabase:', e);
                }
            }

            setPedidoParaPago(null);
            queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
        } finally {
            setGuardandoPago(false);
        }
    };

    const columnas = {
        pendiente: itemsCocina.filter(i => i.estado === 'pendiente'),
        en_proceso: itemsCocina.filter(i => i.estado === 'en_proceso'),
        listo: itemsCocina.filter(i => i.estado === 'listo'),
    };

    const renderItem = (item: ItemExtendido) => (
        <Card
            key={`${item.pedidoId}-${item.itemIndex}`}
            className="border-l-4 hover:shadow-md transition-all relative overflow-hidden"
            style={{
                borderLeftColor:
                    item.estado === 'pendiente' ? '#94a3b8' :
                        item.estado === 'en_proceso' ? '#3b82f6' : '#22c55e',
            }}
        >
            <CardContent className="p-3 space-y-2.5">
                {/* Cabecera: Letrero / Ficha y Nombre del plato */}
                <div className="flex items-start gap-2.5">
                    <div className={`rounded-lg w-11 h-11 flex flex-col items-center justify-center font-black text-base shrink-0 shadow-sm ${
                        item.esWeb 
                            ? (item.tipoEntrega === 'delivery' ? 'bg-purple-900 text-purple-100' : 'bg-emerald-900 text-emerald-100')
                            : 'bg-slate-800 text-white'
                    }`}>
                        <span className="leading-none text-xs">{item.esWeb ? (item.tipoEntrega === 'delivery' ? '🛵' : '🪴') : 'MESA'}</span>
                        <span className="leading-tight text-sm font-bold">{item.numeroLetrero}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm leading-snug">{item.cantidad}× {item.nombre}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {format(new Date(item.creado_en), 'HH:mm')}
                            <span className="text-muted-foreground/50">· Ficha #{item.numeroFicha}</span>
                        </div>
                    </div>
                </div>

                {/* Badges de Categoría y Tipo de Orden */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[11px] font-normal py-0">
                        {item.categoria}
                    </Badge>

                    {item.esWeb && (
                        item.tipoEntrega === 'delivery' ? (
                            <Badge className="bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 text-[10.5px] font-bold py-0 gap-1">
                                <Bike className="w-3 h-3" /> Domicilio
                            </Badge>
                        ) : (
                            <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10.5px] font-bold py-0 gap-1">
                                <Store className="w-3 h-3" /> Para Recoger
                            </Badge>
                        )
                    )}

                    {item.esWeb && (
                        item.pagoConfirmado ? (
                            <Badge className="bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-800 text-[10px] font-semibold py-0 gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Pago OK
                            </Badge>
                        ) : (
                            <Badge className="bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-semibold py-0 gap-0.5 animate-pulse">
                                <AlertCircle className="w-2.5 h-2.5" /> Falta Confirmar Pago
                            </Badge>
                        )
                    )}
                </div>

                {/* Datos del Cliente Web (Nombre, Teléfono, Dirección) */}
                {item.esWeb && (item.clienteNombre || item.clienteTelefono || item.direccion) && (
                    <div className="bg-slate-50 dark:bg-slate-900/70 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                        {item.clienteNombre && (
                            <div className="flex items-center justify-between gap-1 font-semibold text-slate-800 dark:text-slate-200">
                                <span className="truncate">👤 {item.clienteNombre}</span>
                                {item.clienteTelefono && (
                                    <a 
                                        href={`tel:${item.clienteTelefono}`} 
                                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 shrink-0"
                                    >
                                        <Phone className="w-2.5 h-2.5" /> {item.clienteTelefono}
                                    </a>
                                )}
                            </div>
                        )}
                        {item.direccion && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{item.direccion}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Botón de Confirmación de Pago si es pedido Web */}
                {item.esWeb && (
                    <div className="pt-0.5">
                        {!item.pagoConfirmado ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="w-full text-xs font-bold border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-900 h-8 gap-1.5 shadow-sm"
                                onClick={() => setPedidoParaPago(item)}
                            >
                                <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                                Confirmar Pago {item.comprobanteUrl ? '(Ver Comprobante)' : '(Manual)'}
                            </Button>
                        ) : (
                            item.comprobanteUrl && (
                                <button
                                    type="button"
                                    onClick={() => setComprobanteZoom(item.comprobanteUrl || null)}
                                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                                >
                                    <Eye className="w-3 h-3" /> Ver comprobante de pago
                                </button>
                            )
                        )}
                    </div>
                )}

                {/* Acción principal del Item */}
                {item.estado === 'listo' ? (
                    <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 text-xs font-bold border border-green-200 dark:border-green-800">
                            <PackageCheck className="w-4 h-4 text-green-600" /> 
                            {item.esWeb 
                                ? (item.tipoEntrega === 'delivery' ? 'Listo para Despacho 🛵' : 'Listo para Recoger 🛍️') 
                                : 'Listo — Esperando al mesero'}
                        </div>

                        {/* Indicación de Cuánto Falta por Pagar en la Entrega */}
                        {item.esWeb && (
                            <div className={`p-2 rounded-lg border text-center text-xs ${
                                (item.saldoPendiente ?? 0) > 0 
                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200' 
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                            }`}>
                                {(item.saldoPendiente ?? 0) > 0 ? (
                                    <div>
                                        <div className="text-[10.5px] uppercase tracking-wider font-semibold text-amber-800 dark:text-amber-300">
                                            Cobrar al Entregar:
                                        </div>
                                        <div className="text-base font-black text-amber-900 dark:text-amber-100 font-mono my-0.5">
                                            Falta por pagar: Bs. {(item.saldoPendiente ?? 0).toFixed(0)}
                                        </div>
                                        <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                                            Total: Bs. {(item.total ?? 0).toFixed(0)} · Anticipo: Bs. {(item.montoAnticipo ?? 0).toFixed(0)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Pagado 100% (Bs. 0 pendiente)</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <Button
                        onClick={() => avanzarItem(item)}
                        className="w-full font-semibold" 
                        size="sm"
                        variant={item.estado === 'pendiente' ? 'outline' : 'default'}
                    >
                        {item.estado === 'pendiente' ? '▶ Comenzar Preparación' : '✓ Marcar Listo'}
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
                    <ChefHat className="w-6 h-6 text-amber-600" />
                    Tablero de Cocina
                    <span className="text-sm font-normal text-muted-foreground">
                        — {itemsCocina.length} plato(s)
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
                        disabled={isFetching} className="gap-1.5 shadow-sm">
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* Banner informativo */}
            <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>
                        Cocina recibe: <strong>Plato Fuerte</strong> y <strong>Caldos</strong> (incluyendo pedidos de <strong>Delivery y Recoger de la Web</strong>)
                    </span>
                </div>
            </div>

            {/* Kanban — scroll horizontal en móvil, 3 columnas en desktop */}
            <div className="flex-1 overflow-hidden">
                <div className="flex md:grid md:grid-cols-3 gap-3 h-full overflow-x-auto pb-2 snap-x snap-mandatory">

                    {/* PENDIENTES */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 sm:p-4 flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 snap-start shrink-0 w-[82vw] md:w-auto min-w-0">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center justify-between shrink-0">
                            <span className="flex items-center gap-2 text-sm">
                                <UtensilsCrossed className="w-4 h-4 text-slate-500" /> PENDIENTES
                            </span>
                            <Badge variant="secondary" className="font-bold">{columnas.pendiente.length}</Badge>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {columnas.pendiente.length === 0
                                ? <p className="text-center text-muted-foreground text-sm py-12 opacity-40">Sin platos pendientes</p>
                                : columnas.pendiente.map(renderItem)}
                        </div>
                    </div>

                    {/* EN PREPARACIÓN */}
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-3 sm:p-4 flex flex-col overflow-hidden border border-blue-200 dark:border-blue-900 snap-start shrink-0 w-[82vw] md:w-auto min-w-0">
                        <h3 className="font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center justify-between shrink-0">
                            <span className="flex items-center gap-2 text-sm">
                                <ChefHat className="w-4 h-4 text-blue-600" /> EN PREPARACIÓN
                            </span>
                            <Badge className="bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 font-bold">{columnas.en_proceso.length}</Badge>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {columnas.en_proceso.length === 0
                                ? <p className="text-center text-muted-foreground text-sm py-12 opacity-40">Sin platos en proceso</p>
                                : columnas.en_proceso.map(renderItem)}
                        </div>
                    </div>

                    {/* LISTO */}
                    <div className="bg-green-50/50 dark:bg-green-950/20 rounded-xl p-3 sm:p-4 flex flex-col overflow-hidden border border-green-200 dark:border-green-900 snap-start shrink-0 w-[82vw] md:w-auto min-w-0">
                        <h3 className="font-bold text-green-700 dark:text-green-300 mb-3 flex items-center justify-between shrink-0">
                            <span className="flex items-center gap-2 text-sm">
                                <PackageCheck className="w-4 h-4 text-green-600" /> LISTO PARA ENTREGAR
                            </span>
                            <Badge className="bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-200 font-bold">{columnas.listo.length}</Badge>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {columnas.listo.length === 0
                                ? <p className="text-center text-muted-foreground text-sm py-12 opacity-40">Nada listo aún</p>
                                : columnas.listo.map(renderItem)}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL DE CONFIRMACIÓN DE PAGO */}
            {pedidoParaPago && (
                <div 
                    className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm"
                    onClick={() => setPedidoParaPago(null)}
                >
                    <div 
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header del Modal */}
                        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                                        Confirmación de Pago
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Ficha #{pedidoParaPago.numeroFicha} · {pedidoParaPago.tipoEntrega === 'delivery' ? '🛵 Domicilio' : '🪴 Recoger'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPedidoParaPago(null)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Contenido del Modal */}
                        <div className="p-5 overflow-y-auto space-y-4 text-sm flex-1">
                            {/* Información del Cliente */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                                    <span>Cliente: {pedidoParaPago.clienteNombre || 'Cliente Web'}</span>
                                    {pedidoParaPago.clienteTelefono && (
                                        <a 
                                            href={`https://wa.me/591${pedidoParaPago.clienteTelefono.replace(/\D/g, '')}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-green-600 dark:text-green-400 font-semibold hover:underline flex items-center gap-1"
                                        >
                                            💬 WhatsApp
                                        </a>
                                    )}
                                </div>
                                {pedidoParaPago.direccion && (
                                    <div className="text-xs text-muted-foreground">
                                        📍 Dirección: {pedidoParaPago.direccion}
                                    </div>
                                )}
                            </div>

                            {/* Desglose de Pago */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border">
                                    <div className="text-[11px] text-muted-foreground uppercase font-medium">Total Pedido</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                                        Bs. {(pedidoParaPago.total ?? 0).toFixed(0)}
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 uppercase font-medium">Anticipo Pagado</div>
                                    <div className="text-base font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">
                                        Bs. {(pedidoParaPago.montoAnticipo ?? 0).toFixed(0)}
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                                    <div className="text-[11px] text-amber-800 dark:text-amber-300 uppercase font-medium">Saldo en Entrega</div>
                                    <div className="text-base font-extrabold text-amber-900 dark:text-amber-200 mt-0.5 font-mono">
                                        Bs. {(pedidoParaPago.saldoPendiente ?? 0).toFixed(0)}
                                    </div>
                                </div>
                            </div>

                            {/* Vista Previa del Comprobante */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                                    Comprobante Subido por el Cliente:
                                </label>
                                {pedidoParaPago.comprobanteUrl ? (
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-black/5 dark:bg-black/40 text-center relative group">
                                        <img 
                                            src={pedidoParaPago.comprobanteUrl} 
                                            alt="Comprobante de pago" 
                                            className="max-h-56 mx-auto object-contain cursor-pointer transition group-hover:opacity-90"
                                            onClick={() => setComprobanteZoom(pedidoParaPago.comprobanteUrl || null)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setComprobanteZoom(pedidoParaPago.comprobanteUrl || null)}
                                            className="absolute bottom-2 right-2 bg-black/75 hover:bg-black text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-md"
                                        >
                                            <Eye className="w-3.5 h-3.5" /> Ampliar Imagen
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-muted-foreground">
                                        El cliente no adjuntó imagen de comprobante digital (Pago pactado en efectivo o transferencia verificada directamente).
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col gap-2">
                            <Button
                                type="button"
                                disabled={guardandoPago}
                                onClick={() => ejecutarConfirmacionPago(pedidoParaPago, true)}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 gap-2 shadow-md"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                {guardandoPago ? 'Guardando...' : '✓ Confirmar Pago y Poner en Preparación'}
                            </Button>

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={guardandoPago}
                                    onClick={() => ejecutarConfirmacionPago(pedidoParaPago, false)}
                                    className="flex-1 text-xs"
                                >
                                    Solo Confirmar Pago
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setPedidoParaPago(null)}
                                    className="text-xs"
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* LIGHTBOX DE IMAGEN DE COMPROBANTE ZOOM */}
            {comprobanteZoom && (
                <div 
                    className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md"
                    onClick={() => setComprobanteZoom(null)}
                >
                    <button
                        onClick={() => setComprobanteZoom(null)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg transition"
                    >
                        ✕
                    </button>
                    <img 
                        src={comprobanteZoom} 
                        alt="Comprobante en detalle" 
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                    <p className="text-white/70 text-xs mt-3">Toca fuera de la imagen para cerrar</p>
                </div>
            )}
        </div>
    );
}

