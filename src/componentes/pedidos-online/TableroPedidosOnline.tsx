import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, Pedido } from '@/lib/bd/bd-local';
import { API_BASE_URL, normalizarPedidos, formatearFechaLocal } from '@/hooks/useInicializacion';
import { supabase } from '@/hooks/useSupabaseSync';
import { Card, CardContent } from '@/componentes/ui/card';
import { Button } from '@/componentes/ui/button';
import { Badge } from '@/componentes/ui/badge';
import { Input } from '@/componentes/ui/input';
import {
    Bike, Calendar, Clock, MapPin, Phone, MessageCircle, ExternalLink,
    CheckCircle2, RefreshCw, Search, ShieldCheck, Eye, UtensilsCrossed,
    DollarSign, AlertCircle, X, ChevronRight, User, Hash, ChefHat, Check
} from 'lucide-react';

export default function TableroPedidosOnline() {
    const queryClient = useQueryClient();
    const [filtroTipo, setFiltroTipo] = useState<'todos' | 'delivery' | 'reserva'>('todos');
    const [filtroEstado, setFiltroEstado] = useState<'activos' | 'por_confirmar' | 'en_preparacion' | 'en_camino' | 'entregados'>('activos');
    const [busqueda, setBusqueda] = useState('');
    const [comprobanteModal, setComprobanteModal] = useState<string | null>(null);
    const [pedidoParaPago, setPedidoParaPago] = useState<Pedido | null>(null);
    const [guardando, setGuardando] = useState(false);

    // Cargar pedidos online
    const { data: pedidosOnline = [], isFetching, refetch } = useQuery({
        queryKey: ['pedidos-online-despacho'],
        queryFn: async (): Promise<Pedido[]> => {
            // 1. Sincronizar desde servidor
            try {
                const res = await fetch(`${API_BASE_URL}/api/pedidos`);
                if (res.ok) {
                    const pedidosServidor = await res.json();
                    await bdLocal.pedidos.bulkPut(pedidosServidor);
                } else if (supabase) {
                    const { data } = await supabase
                        .from('pedidos')
                        .select('*, items:items_pedido(*)')
                        .order('creado_en', { ascending: false })
                        .limit(100);
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
                            .order('creado_en', { ascending: false })
                            .limit(100);
                        if (data && data.length > 0) {
                            const normalizados = normalizarPedidos(data);
                            await bdLocal.pedidos.bulkPut(normalizados);
                        }
                    } catch { /* offline */ }
                }
            }

            // 2. Filtrar solo pedidos online de Dexie
            const todos = await bdLocal.pedidos.toArray();
            const hoyStr = formatearFechaLocal(new Date());

            const online = todos.filter(p => {
                const df = (p.datos_facturacion || {}) as any;
                const esWeb = Boolean(
                    df.origen?.startsWith('web_') ||
                    p.id_mesero === 'web-online' ||
                    df.tipo_entrega === 'delivery' ||
                    df.tipo_entrega === 'reserva'
                );
                if (!esWeb) return false;

                // Solo pedidos de hoy o que aún estén activos (no cancelados ni pagados de días anteriores)
                const creadoFecha = (p.creado_en || '').slice(0, 10);
                const esDeHoy = creadoFecha === hoyStr;
                const estaActivo = p.estado !== 'pagado' && p.estado !== 'cancelado';

                return esDeHoy || estaActivo;
            });

            return online.sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
        },
        refetchInterval: 5000,
        refetchIntervalInBackground: true,
    });

    // Cambiar estado del pedido
    const actualizarEstadoPedido = async (
        pedidoId: string,
        nuevoEstado: 'pendiente' | 'confirmado' | 'en_proceso' | 'listo' | 'en_camino' | 'en_puerta' | 'entregado' | 'pagado'
    ) => {
        try {
            setGuardando(true);
            const actual = await bdLocal.pedidos.get(pedidoId);
            if (!actual) return;

            const df = { ...(actual.datos_facturacion || {}) } as any;
            
            // Si se marca entregado, opcionalmente confirmar pago
            if (nuevoEstado === 'entregado' || nuevoEstado === 'pagado') {
                df.saldo_pendiente = 0;
                df.pago_confirmado = true;
            }

            const payloadUpdate: Partial<Pedido> = {
                estado: nuevoEstado,
                datos_facturacion: df,
                actualizado_en: new Date().toISOString()
            };

            await bdLocal.pedidos.update(pedidoId, payloadUpdate);

            // Sincronizar API
            try {
                await fetch(`${API_BASE_URL}/api/pedidos/${pedidoId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadUpdate)
                });
            } catch {}

            // Sincronizar Supabase
            if (supabase) {
                try {
                    await supabase.from('pedidos').update({
                        estado: nuevoEstado,
                        datos_facturacion: df,
                        actualizado_en: new Date().toISOString()
                    }).eq('id', pedidoId);
                } catch (e) {
                    console.warn('Error Supabase update:', e);
                }
            }

            queryClient.invalidateQueries({ queryKey: ['pedidos-online-despacho'] });
            queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });
        } catch (err) {
            console.error('Error actualizando pedido online:', err);
        } finally {
            setGuardando(false);
        }
    };

    // Confirmar pago/anticipo
    const confirmarPagoPedido = async (pedido: Pedido) => {
        try {
            setGuardando(true);
            const df = { ...(pedido.datos_facturacion || {}) } as any;
            df.pago_confirmado = true;

            const payloadUpdate = {
                datos_facturacion: df,
                actualizado_en: new Date().toISOString()
            };

            await bdLocal.pedidos.update(pedido.id, payloadUpdate);

            try {
                await fetch(`${API_BASE_URL}/api/pedidos/${pedido.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadUpdate)
                });
            } catch {}

            if (supabase) {
                try {
                    await supabase.from('pedidos').update(payloadUpdate).eq('id', pedido.id);
                } catch {}
            }

            setPedidoParaPago(null);
            queryClient.invalidateQueries({ queryKey: ['pedidos-online-despacho'] });
            queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
        } catch (e) {
            console.error('Error confirmando pago:', e);
        } finally {
            setGuardando(false);
        }
    };

    // Generador de enlaces de WhatsApp según estado con mensajes completos pre-cargados
    const generarEnlaceWhatsApp = (
        pedido: Pedido, 
        tipoMensaje: 'confirmar' | 'en_preparacion' | 'listo' | 'en_camino' | 'en_puerta' | 'entregado'
    ) => {
        const df = (pedido.datos_facturacion || {}) as any;
        const telefono = (df.cliente_telefono || '').replace(/\D/g, '');
        if (!telefono) return null;

        const telCompleto = telefono.startsWith('591') ? telefono : `591${telefono}`;
        const nombre = df.cliente_nombre || 'Estimado cliente';
        const ficha = pedido.numero_ficha || 'Web';
        const saldo = Number(df.saldo_pendiente ?? 0);
        const tipoEntrega = df.tipo_entrega || 'delivery';

        let texto = '';
        if (tipoMensaje === 'confirmar' || tipoMensaje === 'en_preparacion') {
            texto = `¡Hola ${nombre}! 👋 Te confirmamos que tu pedido #${ficha} en *Restaurante El Jardín* fue recibido con éxito y ya está en preparación 🍲.`;
            if (saldo > 0) {
                texto += `\n💰 Saldo pendiente al recibir: *Bs. ${saldo.toFixed(0)}*.`;
            }
        } else if (tipoMensaje === 'listo') {
            if (tipoEntrega === 'delivery') {
                texto = `📦 ¡Hola ${nombre}! Tu pedido #${ficha} de *Restaurante El Jardín* ya está listo y empaquetado en nuestra barra de despacho. En breves minutos saldrá el repartidor 🛵.`;
            } else {
                texto = `🪴 ¡Hola ${nombre}! Tu mesa y pedido #${ficha} en *Restaurante El Jardín* ya están listos esperándote. ¡Te esperamos! 😊`;
            }
        } else if (tipoMensaje === 'en_camino') {
            texto = `🛵 ¡Hola ${nombre}! Tu pedido #${ficha} de *Restaurante El Jardín* ya va en camino con nuestro repartidor a tu dirección:\n📍 ${df.direccion || 'tu domicilio'}${df.zona ? ` (${df.zona})` : ''}.\nTe avisaremos apenas estemos en tu puerta.`;
            if (saldo > 0) {
                texto += `\n💰 Recuerda tener listos *Bs. ${saldo.toFixed(0)}* para el pago al repartidor.`;
            }
        } else if (tipoMensaje === 'en_puerta') {
            texto = `🚪 ¡Hola ${nombre}! Nuestro repartidor de *El Jardín* ya se encuentra en tu puerta con tu comida caliente. Por favor salir a recibirlo.`;
            if (saldo > 0) {
                texto += `\n💰 Monto a cancelar: *Bs. ${saldo.toFixed(0)}*.`;
            }
        } else if (tipoMensaje === 'entregado') {
            texto = `🍽️ ¡Hola ${nombre}! Confirmamos la entrega de tu pedido #${ficha}. ¡Muchas gracias por tu preferencia en *Restaurante El Jardín*! ¡Que tengas un excelente provecho! ✨`;
        }

        return `https://wa.me/${telCompleto}?text=${encodeURIComponent(texto)}`;
    };

    // Filtros
    const pedidosFiltrados = pedidosOnline.filter(p => {
        const df = (p.datos_facturacion || {}) as any;
        const tipoEntrega = df.tipo_entrega || (df.origen === 'web_delivery' ? 'delivery' : 'reserva');

        if (filtroTipo !== 'todos' && tipoEntrega !== filtroTipo) return false;

        if (filtroEstado === 'activos' && (p.estado === 'entregado' || p.estado === 'pagado' || p.estado === 'cancelado')) return false;
        if (filtroEstado === 'por_confirmar' && (df.pago_confirmado || p.estado !== 'pendiente')) return false;
        if (filtroEstado === 'en_preparacion' && (p.estado !== 'en_proceso' && p.estado !== 'listo')) return false;
        if (filtroEstado === 'en_camino' && (p.estado !== 'en_camino' && p.estado !== 'en_puerta')) return false;
        if (filtroEstado === 'entregados' && (p.estado !== 'entregado' && p.estado !== 'pagado')) return false;

        if (busqueda.trim()) {
            const q = busqueda.toLowerCase().trim();
            const nombre = (df.cliente_nombre || '').toLowerCase();
            const tel = (df.cliente_telefono || '').toLowerCase();
            const dir = (df.direccion || '').toLowerCase();
            const ficha = String(p.numero_ficha);
            const id = p.id.toLowerCase();
            return nombre.includes(q) || tel.includes(q) || dir.includes(q) || ficha.includes(q) || id.includes(q);
        }

        return true;
    });

    // Contadores para insignias
    const countTotalActivos = pedidosOnline.filter(p => p.estado !== 'entregado' && p.estado !== 'pagado' && p.estado !== 'cancelado').length;
    const countDeliveryActivos = pedidosOnline.filter(p => {
        const df = (p.datos_facturacion || {}) as any;
        return (df.tipo_entrega === 'delivery' || df.origen === 'web_delivery') && p.estado !== 'entregado' && p.estado !== 'pagado' && p.estado !== 'cancelado';
    }).length;
    const countReservasActivas = pedidosOnline.filter(p => {
        const df = (p.datos_facturacion || {}) as any;
        return (df.tipo_entrega === 'reserva' || df.origen === 'web_reserva') && p.estado !== 'entregado' && p.estado !== 'pagado' && p.estado !== 'cancelado';
    }).length;
    const countPorConfirmar = pedidosOnline.filter(p => {
        const df = (p.datos_facturacion || {}) as any;
        return !df.pago_confirmado && p.estado === 'pendiente';
    }).length;

    const getBadgeEstado = (estado: string) => {
        switch (estado) {
            case 'pendiente':
                return <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold">🟡 Nuevo / Pendiente</Badge>;
            case 'en_proceso':
                return <Badge className="bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-500/30 font-bold">🍳 En Cocina</Badge>;
            case 'listo':
                return <Badge className="bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30 font-bold">📦 Listo en Despacho</Badge>;
            case 'en_camino':
                return <Badge className="bg-indigo-600 text-white font-bold">🛵 En Camino</Badge>;
            case 'en_puerta':
                return <Badge className="bg-orange-600 text-white font-bold animate-pulse">🚪 Ya en Puerta</Badge>;
            case 'entregado':
            case 'pagado':
                return <Badge className="bg-emerald-600 text-white font-bold">✅ Entregado</Badge>;
            case 'cancelado':
                return <Badge className="bg-rose-500/20 text-rose-800 dark:text-rose-300 font-bold">❌ Cancelado</Badge>;
            default:
                return <Badge variant="secondary">{estado}</Badge>;
        }
    };

    return (
        <div className="flex flex-col gap-4 p-3 sm:p-5 min-h-[calc(100vh-5rem)] max-w-7xl mx-auto">
            {/* Encabezado y Estadísticas */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold font-serif flex items-center gap-2.5 text-foreground">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Bike className="w-6 h-6 sm:w-7 sm:h-7" />
                        </div>
                        Atención de Pedidos Online & Reservas
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        Control de despacho y delivery independiente de la cocina · Seguimiento y WhatsApp al cliente
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="gap-1.5"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* Fila de Métricas Rápidas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <Card 
                    className={`cursor-pointer transition-all border ${filtroTipo === 'todos' && filtroEstado === 'activos' ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-500/5' : 'hover:border-primary/50'}`}
                    onClick={() => { setFiltroTipo('todos'); setFiltroEstado('activos'); }}
                >
                    <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                        <div>
                            <div className="text-xl sm:text-2xl font-black text-foreground">{countTotalActivos}</div>
                            <div className="text-[11px] text-muted-foreground font-medium">Activos en Total</div>
                        </div>
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Clock className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card 
                    className={`cursor-pointer transition-all border ${filtroTipo === 'delivery' ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-500/5' : 'hover:border-primary/50'}`}
                    onClick={() => { setFiltroTipo('delivery'); setFiltroEstado('activos'); }}
                >
                    <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                        <div>
                            <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">{countDeliveryActivos}</div>
                            <div className="text-[11px] text-muted-foreground font-medium">🛵 Envíos Delivery</div>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Bike className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card 
                    className={`cursor-pointer transition-all border ${filtroTipo === 'reserva' ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5' : 'hover:border-primary/50'}`}
                    onClick={() => { setFiltroTipo('reserva'); setFiltroEstado('activos'); }}
                >
                    <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                        <div>
                            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{countReservasActivas}</div>
                            <div className="text-[11px] text-muted-foreground font-medium">🪴 Reservas Salón</div>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Calendar className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card 
                    className={`cursor-pointer transition-all border ${filtroEstado === 'por_confirmar' ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-500/5' : 'hover:border-primary/50'}`}
                    onClick={() => { setFiltroEstado('por_confirmar'); }}
                >
                    <CardContent className="p-3 sm:p-4 flex items-center justify-between">
                        <div>
                            <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">{countPorConfirmar}</div>
                            <div className="text-[11px] text-muted-foreground font-medium">⚠️ Por Confirmar Pago</div>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
                {/* Pestañas de Estado */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-semibold">
                    <Button
                        size="sm"
                        variant={filtroEstado === 'activos' ? 'default' : 'ghost'}
                        onClick={() => setFiltroEstado('activos')}
                        className="text-xs h-8 px-3"
                    >
                        Todos Activos
                    </Button>
                    <Button
                        size="sm"
                        variant={filtroEstado === 'por_confirmar' ? 'default' : 'ghost'}
                        onClick={() => setFiltroEstado('por_confirmar')}
                        className="text-xs h-8 px-3 gap-1"
                    >
                        Por Confirmar
                        {countPorConfirmar > 0 && <span className="w-2 h-2 rounded-full bg-red-500" />}
                    </Button>
                    <Button
                        size="sm"
                        variant={filtroEstado === 'en_preparacion' ? 'default' : 'ghost'}
                        onClick={() => setFiltroEstado('en_preparacion')}
                        className="text-xs h-8 px-3"
                    >
                        En Cocina / Despacho
                    </Button>
                    <Button
                        size="sm"
                        variant={filtroEstado === 'en_camino' ? 'default' : 'ghost'}
                        onClick={() => setFiltroEstado('en_camino')}
                        className="text-xs h-8 px-3"
                    >
                        En Ruta (Delivery)
                    </Button>
                    <Button
                        size="sm"
                        variant={filtroEstado === 'entregados' ? 'default' : 'ghost'}
                        onClick={() => setFiltroEstado('entregados')}
                        className="text-xs h-8 px-3"
                    >
                        Entregados Hoy
                    </Button>
                </div>

                {/* Búsqueda */}
                <div className="relative w-full md:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar cliente, tel, ficha..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        className="pl-9 h-8 text-xs bg-background"
                    />
                    {busqueda && (
                        <button 
                            onClick={() => setBusqueda('')} 
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Cuadrícula de Cartas de Pedidos Online */}
            {pedidosFiltrados.length === 0 ? (
                <div className="bg-card/50 border border-border/60 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                        <Bike className="w-8 h-8 opacity-40" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">No hay pedidos en esta sección</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mt-1">
                        {busqueda ? 'No se encontraron resultados para la búsqueda actual.' : 'Los pedidos realizados desde la página web de El Jardín aparecerán aquí inmediatamente.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pedidosFiltrados.map((pedido) => {
                        const df = (pedido.datos_facturacion || {}) as any;
                        const tipoEntrega: 'delivery' | 'reserva' = df.tipo_entrega || (df.origen === 'web_delivery' ? 'delivery' : 'reserva');
                        const nombre = df.cliente_nombre || 'Cliente Online';
                        const telefono = df.cliente_telefono || '';
                        const direccion = df.direccion || '';
                        const zona = df.zona || '';
                        const googleMapsUrl = df.google_maps_url || (df.coordenadas?.lat ? `https://www.google.com/maps?q=${df.coordenadas.lat},${df.coordenadas.lng}` : '');
                        const comprobanteUrl = df.comprobante_url || df.comprobante_preview || null;
                        
                        const total = Number(pedido.total ?? df.total_estimado ?? 0);
                        const anticipo = Number(df.monto_anticipo ?? 0);
                        const saldoPendiente = df.saldo_pendiente !== undefined ? Number(df.saldo_pendiente) : Math.max(0, total - anticipo);
                        const pagoConfirmado = Boolean(df.pago_confirmado);
                        const horaPedido = pedido.creado_en ? new Date(pedido.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                        return (
                            <Card 
                                key={pedido.id} 
                                className={`flex flex-col justify-between overflow-hidden border shadow-sm transition-all hover:shadow-md ${
                                    pedido.estado === 'en_puerta'
                                        ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/10'
                                        : pedido.estado === 'en_camino'
                                        ? 'border-blue-500/60'
                                        : !pagoConfirmado
                                        ? 'border-amber-400 dark:border-amber-600/70'
                                        : 'border-border'
                                }`}
                            >
                                <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
                                    {/* Cabecera de la Carta */}
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-lg font-black font-mono text-primary">
                                                        #{pedido.numero_ficha || 'WEB'}
                                                    </span>
                                                    <Badge 
                                                        variant="outline" 
                                                        className={`text-[10px] font-bold px-1.5 py-0 ${
                                                            tipoEntrega === 'delivery' 
                                                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' 
                                                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                                        }`}
                                                    >
                                                        {tipoEntrega === 'delivery' ? '🛵 DELIVERY' : '🪴 RESERVA'}
                                                    </Badge>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    <span>Recibido a las {horaPedido}</span>
                                                </div>
                                            </div>

                                            <div>
                                                {getBadgeEstado(pedido.estado)}
                                            </div>
                                        </div>

                                        {/* Información del Cliente */}
                                        <div className="bg-muted/40 p-2.5 rounded-lg space-y-1.5 text-xs">
                                            <div className="flex items-center justify-between font-bold text-foreground">
                                                <span className="flex items-center gap-1 truncate max-w-[180px]">
                                                    <User className="w-3.5 h-3.5 text-primary shrink-0" />
                                                    {nombre}
                                                </span>
                                                {telefono && (
                                                    <div className="flex items-center gap-1">
                                                        <a 
                                                            href={`tel:${telefono}`} 
                                                            className="p-1 rounded bg-background hover:bg-muted text-foreground border border-border" 
                                                            title="Llamar"
                                                        >
                                                            <Phone className="w-3 h-3 text-emerald-600" />
                                                        </a>
                                                        <a 
                                                            href={generarEnlaceWhatsApp(pedido, 'confirmar') || '#'} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="p-1 rounded bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30 font-semibold flex items-center gap-0.5 text-[10px]" 
                                                            title="Abrir WhatsApp"
                                                        >
                                                            <MessageCircle className="w-3 h-3 text-green-600" /> WhatsApp
                                                        </a>
                                                    </div>
                                                )}
                                            </div>

                                            {tipoEntrega === 'delivery' ? (
                                                <div className="space-y-1 text-muted-foreground pt-1 border-t border-border/40">
                                                    <div className="flex items-start gap-1">
                                                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                                        <span className="line-clamp-2">
                                                            {direccion} {zona && <strong className="text-foreground">({zona})</strong>}
                                                        </span>
                                                    </div>
                                                    {df.referencia && (
                                                        <div className="text-[11px] italic pl-4 text-muted-foreground">
                                                            Ref: {df.referencia}
                                                        </div>
                                                    )}
                                                    {googleMapsUrl && (
                                                        <a 
                                                            href={googleMapsUrl} 
                                                            target="_blank" 
                                                            rel="noreferrer"
                                                            className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 pl-4 pt-0.5"
                                                        >
                                                            📍 Abrir Ruta en Google Maps ↗
                                                        </a>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-muted-foreground space-y-0.5 pt-1 border-t border-border/40">
                                                    <div>👥 Personas: <strong className="text-foreground">{df.personas || 2} comensales</strong></div>
                                                    <div>📅 Fecha/Hora: <strong className="text-foreground">{df.fecha_reserva || 'Hoy'} · {df.hora_reserva || 'Horario salón'}</strong></div>
                                                </div>
                                            )}

                                            {df.notas_adicionales && (
                                                <div className="text-[11px] bg-amber-500/10 text-amber-800 dark:text-amber-300 p-1.5 rounded border border-amber-500/20">
                                                    💬 <strong>Nota del cliente:</strong> {df.notas_adicionales}
                                                </div>
                                            )}
                                        </div>

                                        {/* Lista de Platos */}
                                        <div className="space-y-1 pt-1">
                                            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                <UtensilsCrossed className="w-3 h-3" /> Platos del Pedido:
                                            </div>
                                            <div className="bg-background border border-border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                                                {(pedido.items || []).map((it, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-xs">
                                                        <span className="truncate pr-2">
                                                            <strong className="text-primary font-mono">{it.cantidad}x</strong> {it.nombre_item}
                                                        </span>
                                                        <span className="font-mono text-muted-foreground shrink-0">
                                                            Bs. {(it.subtotal || it.precio_unitario * it.cantidad || 0).toFixed(0)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Estado Financiero / Cobro */}
                                        <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Total Pedido:</span>
                                                <strong className="font-mono text-sm">Bs. {total.toFixed(0)}</strong>
                                            </div>

                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground flex items-center gap-1">
                                                    Anticipo Pagado:
                                                    {comprobanteUrl && (
                                                        <button 
                                                            onClick={() => setComprobanteModal(comprobanteUrl)} 
                                                            className="text-primary hover:underline text-[10px] font-bold flex items-center gap-0.5 ml-1"
                                                        >
                                                            <Eye className="w-3 h-3" /> Ver Comprobante
                                                        </button>
                                                    )}
                                                </span>
                                                <span className="font-mono text-emerald-600 font-bold">Bs. {anticipo.toFixed(0)}</span>
                                            </div>

                                            <div className="flex items-center justify-between pt-1 border-t border-border/40">
                                                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                                    Saldo a Cobrar:
                                                </span>
                                                <span className={`font-mono font-black text-sm ${saldoPendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                                                    {saldoPendiente > 0 ? `Bs. ${saldoPendiente.toFixed(0)}` : 'Bs. 0 (Completado)'}
                                                </span>
                                            </div>

                                            {/* Badge de Verificación de Pago */}
                                            <div className="pt-1 flex items-center justify-between">
                                                {pagoConfirmado ? (
                                                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                                        <ShieldCheck className="w-3.5 h-3.5" /> Pago Verificado
                                                    </span>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 text-[11px] gap-1 border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50"
                                                        onClick={() => confirmarPagoPedido(pedido)}
                                                        disabled={guardando}
                                                    >
                                                        <Check className="w-3 h-3" /> Confirmar Anticipo
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botones de Control de Estados y Avisos de WhatsApp */}
                                    <div className="space-y-1.5 pt-2 border-t border-border/60">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                            Avanzar Estado del Pedido:
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5">
                                            {/* PENDIENTE -> EN PREPARACIÓN */}
                                            {pedido.estado === 'pendiente' && (
                                                <Button
                                                    size="sm"
                                                    className="col-span-2 h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1"
                                                    onClick={() => actualizarEstadoPedido(pedido.id, 'en_proceso')}
                                                    disabled={guardando}
                                                >
                                                    <ChefHat className="w-3.5 h-3.5" /> Pasar a Cocina
                                                </Button>
                                            )}

                                            {/* EN PREPARACIÓN -> LISTO */}
                                            {pedido.estado === 'en_proceso' && (
                                                <Button
                                                    size="sm"
                                                    className="col-span-2 h-8 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white gap-1"
                                                    onClick={() => actualizarEstadoPedido(pedido.id, 'listo')}
                                                    disabled={guardando}
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Listo en Despacho
                                                </Button>
                                            )}

                                            {/* ACCIONES DE DELIVERY (EN CAMINO / EN PUERTA) */}
                                            {tipoEntrega === 'delivery' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant={pedido.estado === 'en_camino' ? 'default' : 'outline'}
                                                        className={`text-xs h-7 font-bold gap-1 ${
                                                            pedido.estado === 'en_camino'
                                                                ? 'bg-blue-600 text-white'
                                                                : 'border-blue-400 text-blue-700 dark:text-blue-300'
                                                        }`}
                                                        onClick={() => actualizarEstadoPedido(pedido.id, 'en_camino')}
                                                        disabled={guardando}
                                                    >
                                                        🛵 En camino
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        variant={pedido.estado === 'en_puerta' ? 'default' : 'outline'}
                                                        className={`text-xs h-7 font-bold gap-1 ${
                                                            pedido.estado === 'en_puerta'
                                                                ? 'bg-amber-600 text-white'
                                                                : 'border-amber-400 text-amber-700 dark:text-amber-300'
                                                        }`}
                                                        onClick={() => actualizarEstadoPedido(pedido.id, 'en_puerta')}
                                                        disabled={guardando}
                                                    >
                                                        🚪 En puerta
                                                    </Button>
                                                </>
                                            )}

                                            {/* FINALIZAR: ENTREGADO Y COBRADO */}
                                            {pedido.estado !== 'entregado' && pedido.estado !== 'pagado' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="col-span-2 h-8 text-xs font-bold border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-1.5"
                                                    onClick={() => actualizarEstadoPedido(pedido.id, 'entregado')}
                                                    disabled={guardando}
                                                >
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Marcar Entregado y Cobrado
                                                </Button>
                                            )}
                                        </div>

                                        {/* Avisos rápidos de WhatsApp con mensaje listo para cada estado */}
                                        {telefono && (
                                            <div className="pt-2 border-t border-border/40 space-y-1">
                                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                    <MessageCircle className="w-3 h-3 text-emerald-600" /> Enviar Estado por WhatsApp:
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    <a
                                                        href={generarEnlaceWhatsApp(pedido, 'en_preparacion') || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10.5px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold flex items-center gap-0.5"
                                                        title="Avisar que el pedido fue recibido y está en preparación"
                                                    >
                                                        🍲 Confirmado
                                                    </a>
                                                    <a
                                                        href={generarEnlaceWhatsApp(pedido, 'listo') || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10.5px] bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-500/20 font-semibold flex items-center gap-0.5"
                                                        title="Avisar que está listo en despacho"
                                                    >
                                                        📦 Listo
                                                    </a>
                                                    {tipoEntrega === 'delivery' && (
                                                        <>
                                                            <a
                                                                href={generarEnlaceWhatsApp(pedido, 'en_camino') || '#'}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[10.5px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-500/20 font-semibold flex items-center gap-0.5"
                                                                title="Avisar que el repartidor va en camino"
                                                            >
                                                                🛵 En camino
                                                            </a>
                                                            <a
                                                                href={generarEnlaceWhatsApp(pedido, 'en_puerta') || '#'}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[10.5px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 font-semibold flex items-center gap-0.5"
                                                                title="Avisar que el repartidor está en la puerta"
                                                            >
                                                                🚪 En puerta
                                                            </a>
                                                        </>
                                                    )}
                                                    <a
                                                        href={generarEnlaceWhatsApp(pedido, 'entregado') || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10.5px] bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-500/20 font-semibold flex items-center gap-0.5"
                                                        title="Enviar agradecimiento de entrega"
                                                    >
                                                        🍽️ Entregado
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* MODAL PARA VER COMPROBANTE EN TAMAÑO COMPLETO */}
            {comprobanteModal && (
                <div 
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 backdrop-blur-sm"
                    onClick={() => setComprobanteModal(null)}
                >
                    <div 
                        className="bg-card border border-border rounded-2xl max-w-lg w-full p-4 overflow-hidden flex flex-col items-center gap-3"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between w-full border-b border-border pb-2">
                            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                <Eye className="w-4 h-4 text-primary" /> Comprobante de Transferencia / QR
                            </h3>
                            <button onClick={() => setComprobanteModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="max-h-[70vh] overflow-auto rounded-lg border border-border w-full flex items-center justify-center bg-black/5">
                            <img 
                                src={comprobanteModal} 
                                alt="Comprobante" 
                                className="max-w-full max-h-[65vh] object-contain rounded"
                            />
                        </div>
                        <Button 
                            className="w-full text-xs" 
                            variant="outline" 
                            onClick={() => setComprobanteModal(null)}
                        >
                            Cerrar Vista
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
