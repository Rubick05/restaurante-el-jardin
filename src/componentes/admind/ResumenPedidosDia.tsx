import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, Pedido } from '@/lib/bd/bd-local';
import { USUARIOS_SISTEMA } from '@/lib/auth/usuarios';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Button } from '@/componentes/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/componentes/ui/tabs';
import { 
    Calendar, DollarSign, Hash, MapPin, X, UtensilsCrossed, 
    UserCircle, RefreshCw, ChevronDown, ChevronUp, ClipboardList, TrendingUp,
    Pencil, Trash2, CheckCircle2, Printer, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { API_BASE_URL, normalizarPedidos, formatearFechaLocal } from '@/hooks/useInicializacion';
import NavegadorMenu from '@/componentes/mesero/NavegadorMenu';
import { ModalCobro } from '@/componentes/mesero/ModalCobro';

function nombreMesero(idMesero: string): string {
    const usuario = USUARIOS_SISTEMA.find(u => u.id === idMesero);
    return usuario?.nombre ?? idMesero;
}

export default function ResumenPedidosDia() {
    const queryClient = useQueryClient();
    const [procesando, setProcesando] = useState(false);
    const [pedidosExpandidos, setPedidosExpandidos] = useState<Record<string, boolean>>({});
    const [pedidoAEditar, setPedidoAEditar] = useState<Pedido | null>(null);
    const [pedidoACobrar, setPedidoACobrar] = useState<Pedido | null>(null);

    const togglePedido = (id: string) => {
        setPedidosExpandidos(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const imprimirComanda = (pedido: Pedido) => {
        const lineas = (pedido.items || []).map(
            i => `
            <tr>
                <td style="padding: 6px 0; font-size: 16px; font-weight: bold; border-bottom: 1px solid #ddd;">${i.cantidad}x</td>
                <td style="padding: 6px 0; font-size: 16px; border-bottom: 1px solid #ddd;">
                    <strong>${i.nombre_item}</strong>
                    ${i.instrucciones ? `<br><span style="font-size: 12px; color: #d97706; font-weight: bold;">NOTA: ${i.instrucciones}</span>` : ""}
                </td>
            </tr>`
        ).join("");

        const htmlContenido = `
            <html>
            <head>
                <title>Comanda Ficha #${pedido.numero_ficha}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        color: #000;
                        padding: 10px;
                        max-width: 300px;
                        margin: 0 auto;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 12px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 8px;
                    }
                    .header h2 {
                        margin: 5px 0;
                        font-size: 22px;
                        font-weight: bold;
                    }
                    .info {
                        font-size: 14px;
                        margin-bottom: 12px;
                        line-height: 1.5;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 8px;
                    }
                    .table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 15px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>** COMANDA DE COCINA **</h2>
                </div>
                <div class="info">
                    <strong>FICHA: #${pedido.numero_ficha}</strong><br>
                    <strong>LETRERO: ${pedido.numero_letrero || "?"}</strong><br>
                    Mesero: ${nombreMesero(pedido.id_mesero)}<br>
                    Fecha: ${new Date(pedido.creado_en).toLocaleString("es-BO")}<br>
                    ${pedido.notas ? `<strong>Notas Pedido:</strong> <span style="font-size: 13px; color: #d97706;">${pedido.notas}</span><br>` : ""}
                </div>
                <table class="table">
                    <tbody>
                        ${lineas}
                    </tbody>
                </table>
                <div style="text-align: center; font-size: 11px; margin-top: 20px; border-top: 1px solid #000; padding-top: 5px;">
                    Control de Cocina - El Jardín
                </div>
            </body>
            </html>
        `;

        const ventana = window.open("", "PRINT", "height=600,width=400");
        if (ventana) {
            ventana.document.write(htmlContenido);
            ventana.document.close();
            ventana.focus();
            setTimeout(() => {
                ventana.print();
                ventana.close();
            }, 250);
        }
    };

    const imprimirRecibo = (pedido: Pedido) => {
        const CATEGORIAS_BEBIDA = ["bebida", "cerveza", "refresco", "trago", "jugo", "agua", "gaseosa", "vino", "cocktail"];
        const esBebida = (cat?: string) => {
            if (!cat) return false;
            const c = cat.toLowerCase();
            return CATEGORIAS_BEBIDA.some(b => c.includes(b));
        };

        const platos = (pedido.items || []).filter(i => !esBebida(i.categoria));
        const bebidas = (pedido.items || []).filter(i => esBebida(i.categoria));
        const subtotalPlatos = platos.reduce((acc, i) => acc + i.subtotal, 0);
        const subtotalBebidas = bebidas.reduce((acc, i) => acc + i.subtotal, 0);

        const lineas = (pedido.items || []).map(
            i => `
            <tr>
                <td style="padding: 4px 0; font-size: 13px; font-weight: bold;">${i.cantidad}x</td>
                <td style="padding: 4px 0; font-size: 13px;">${i.nombre_item}</td>
                <td style="padding: 4px 0; text-align: right; font-family: monospace; font-size: 13px;">Bs ${Number(i.subtotal).toFixed(2)}</td>
            </tr>`
        ).join("");

        const logoSvg = `
            <svg width="70" height="70" viewBox="0 0 100 100" fill="none" stroke="#f59e0b" stroke-width="2.5" style="margin: 0 auto; display: block;">
                <path d="M50 15 C30 35, 30 65, 50 85 C70 65, 70 35, 50 15 Z" fill="rgba(245, 158, 11, 0.05)" />
                <path d="M50 15 L50 85" stroke-dasharray="2 2" />
                <path d="M50 35 C42 40, 42 50, 50 55" />
                <path d="M50 45 C58 50, 58 60, 50 65" />
            </svg>
        `;

        const htmlContenido = `
            <html>
            <head>
                <title>Recibo Ficha #${pedido.numero_ficha}</title>
                <style>
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        color: #000;
                        padding: 10px;
                        max-width: 300px;
                        margin: 0 auto;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 12px;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 8px;
                    }
                    .header h2 {
                        margin: 5px 0 2px 0;
                        font-size: 18px;
                        font-weight: bold;
                        letter-spacing: 1px;
                    }
                    .header p {
                        margin: 0;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .info {
                        font-size: 12px;
                        margin-bottom: 10px;
                        line-height: 1.4;
                    }
                    .table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 10px;
                    }
                    .table th {
                        border-bottom: 1px solid #000;
                        font-size: 11px;
                        text-align: left;
                        padding-bottom: 4px;
                        text-transform: uppercase;
                    }
                    .totales {
                        border-top: 1px dashed #000;
                        padding-top: 6px;
                        margin-top: 6px;
                        font-size: 12px;
                    }
                    .total-grande {
                        font-size: 14px;
                        font-weight: bold;
                        display: flex;
                        justify-content: space-between;
                        margin-top: 5px;
                        border-top: 1px solid #000;
                        padding-top: 5px;
                    }
                    .footer-text {
                        text-align: center;
                        font-size: 11px;
                        margin-top: 18px;
                        border-top: 1px dashed #000;
                        padding-top: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    ${logoSvg}
                    <h2>EL JARDÍN</h2>
                    <p>Peña - Restaurant</p>
                </div>
                <div class="info">
                    <strong>RECIBO DE VENTA</strong><br>
                    Ficha: #${pedido.numero_ficha} · Letrero: ${pedido.numero_letrero || "?"}<br>
                    Mesero: ${nombreMesero(pedido.id_mesero)}<br>
                    Fecha: ${new Date(pedido.creado_en).toLocaleString("es-BO")}<br>
                    Cliente: ${pedido.datos_facturacion?.razon_social || "PÚBLICO GENERAL"}<br>
                    NIT/CI: ${pedido.datos_facturacion?.nit_ci || "0"}
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th style="width: 15%;">Cant</th>
                            <th style="width: 60%;">Detalle</th>
                            <th style="width: 25%; text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lineas}
                    </tbody>
                </table>
                <div class="totales">
                    ${subtotalPlatos > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>Subtotal Platos:</span>
                        <span>Bs ${Number(subtotalPlatos).toFixed(2)}</span>
                    </div>` : ''}
                    ${subtotalBebidas > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>Subtotal Bebidas:</span>
                        <span>Bs ${Number(subtotalBebidas).toFixed(2)}</span>
                    </div>` : ''}
                    <div class="total-grande">
                        <span>TOTAL A PAGAR:</span>
                        <span>Bs ${Number(pedido.total).toFixed(2)}</span>
                    </div>
                </div>
                <div class="footer-text">
                    ¡Gracias por su visita!<br>
                    Cochabamba, Bolivia
                </div>
            </body>
            </html>
        `;

        const ventana = window.open("", "PRINT", "height=700,width=400");
        if (ventana) {
            ventana.document.write(htmlContenido);
            ventana.document.close();
            ventana.focus();
            setTimeout(() => {
                ventana.print();
                ventana.close();
            }, 250);
        }
    };

    const { data: pedidosDia = [], isLoading, refetch } = useQuery({
        queryKey: ['pedidos-dia'],
        queryFn: async (): Promise<Pedido[]> => {
            // Intentar cargar desde servidor primero
            try {
                const res = await fetch(`${API_BASE_URL}/api/pedidos?hoy=true`);
                if (res.ok) {
                    const data = normalizarPedidos(await res.json());
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

    const totalDia = pedidosDia.reduce((acc, p) => p.estado !== 'cancelado' ? acc + p.total : acc, 0);
    const totalItems = pedidosDia.reduce((acc, p) => p.estado !== 'cancelado' ? acc + (p.items?.length || 0) : acc, 0);

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
                alert(`✅ Día cerrado. Total: Bs ${Number(data.total_recaudado ?? 0).toFixed(2)}`);
            } else {
                // Offline: cerrar localmente
                const fechaStr = formatearFechaLocal(new Date());
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
            pendiente: { label: 'Pendiente', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
            en_proceso: { label: 'En Proceso', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
            listo: { label: 'Listo', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
            entregado: { label: 'Entregado', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
            pagado: { label: 'Pagado ✓', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
            cancelado: { label: 'Cancelado', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
        };
        return map[estado] || { label: estado, className: 'bg-secondary text-secondary-foreground' };
    };

    // Consolidar platos vendidos hoy
    const resumenPlatos = pedidosDia
        .filter(p => p.estado !== 'cancelado')
        .reduce((acc, p) => {
            p.items?.forEach(item => {
                const nombre = item.nombre_item;
                if (!acc[nombre]) {
                    acc[nombre] = { cantidad: 0, total: 0, categoria: item.categoria || 'Sin Categoría' };
                }
                acc[nombre].cantidad += item.cantidad;
                acc[nombre].total += item.cantidad * item.precio_unitario;
            });
            return acc;
        }, {} as Record<string, { cantidad: number; total: number; categoria: string }>);

    const platosVendidosSorted = Object.entries(resumenPlatos)
        .sort((a, b) => b[1].cantidad - a[1].cantidad);

    if (pedidoAEditar) {
        return (
            <div className="p-2 bg-background min-h-screen">
                <NavegadorMenu
                    pedidoExistente={pedidoAEditar}
                    onVolver={() => {
                        setPedidoAEditar(null);
                        refetch();
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 font-serif text-foreground">
                        <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                        Pedidos del Día
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="border-border hover:bg-accent text-foreground"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        onClick={cerrarDia}
                        disabled={procesando || pedidosDia.length === 0}
                        className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
                        size="sm"
                    >
                        <X className="mr-1.5 h-4 w-4" />
                        Cerrar Día
                    </Button>
                </div>
            </div>

            {/* Cards de Resumen */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="bg-card border-border">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                        <Hash className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
                        <div>
                            <div className="text-xl sm:text-2xl font-bold text-foreground">{pedidosDia.length}</div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">Pedidos</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                        <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500 shrink-0" />
                        <div>
                            <div className="text-xl sm:text-2xl font-bold text-foreground">Bs {totalDia.toFixed(0)}</div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">Total Recaudado</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                        <UtensilsCrossed className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500 shrink-0" />
                        <div>
                            <div className="text-xl sm:text-2xl font-bold text-foreground">{totalItems}</div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">Platos Vendidos</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="pedidos" className="w-full">
                <TabsList className="bg-muted w-full sm:w-auto grid grid-cols-2">
                    <TabsTrigger value="pedidos" className="flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4" />
                        Detalle de Pedidos
                    </TabsTrigger>
                    <TabsTrigger value="platos" className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" />
                        Platos Vendidos ({platosVendidosSorted.length})
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: LISTADO DE PEDIDOS */}
                <TabsContent value="pedidos" className="mt-4">
                    <Card className="bg-card border-border">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base text-foreground">Listado General de Pedidos</CardTitle>
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
                                        <table className="w-full text-left">
                                            <thead className="bg-muted/40 border-b border-border text-muted-foreground text-xs uppercase">
                                                <tr>
                                                    <th className="p-3 font-semibold w-10"></th>
                                                    <th className="p-3 font-semibold">Ficha</th>
                                                    <th className="p-3 font-semibold">Letrero</th>
                                                    <th className="p-3 font-semibold">Hora</th>
                                                    <th className="p-3 font-semibold">Mesero</th>
                                                    <th className="p-3 font-semibold">Items</th>
                                                    <th className="p-3 text-right font-semibold">Total</th>
                                                    <th className="p-3 text-center font-semibold">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pedidosDia.map(pedido => {
                                                    const estado = getEstadoBadge(pedido.estado);
                                                    const expandido = !!pedidosExpandidos[pedido.id];
                                                    return (
                                                        <React.Fragment key={pedido.id}>
                                                            <tr 
                                                                onClick={() => togglePedido(pedido.id)} 
                                                                className="border-b border-border hover:bg-accent/40 cursor-pointer transition-colors"
                                                            >
                                                                <td className="p-3 text-center">
                                                                    {expandido ? (
                                                                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                                                    ) : (
                                                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                                    )}
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className="font-mono font-bold text-base text-foreground">#{pedido.numero_ficha}</span>
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className="font-black text-xl text-foreground">{pedido.numero_letrero || '-'}</span>
                                                                </td>
                                                                <td className="p-3 text-sm text-muted-foreground">
                                                                     {(() => {
                                                                         try {
                                                                             if (!pedido.creado_en) return '-';
                                                                             const d = new Date(pedido.creado_en);
                                                                             if (isNaN(d.getTime())) return String(pedido.creado_en);
                                                                             return format(d, 'HH:mm');
                                                                         } catch {
                                                                             return String(pedido.creado_en || '-');
                                                                         }
                                                                     })()}
                                                                 </td>
                                                                <td className="p-3">
                                                                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                                                                        <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                                                        <span>{nombreMesero(pedido.id_mesero)}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 text-sm text-muted-foreground">{pedido.items?.length || 0} items</td>
                                                                <td className="p-3 text-right font-bold text-emerald-400">Bs {Number(pedido.total || 0).toFixed(2)}</td>
                                                                <td className="p-3 text-center">
                                                                    <Badge className={`text-xs border ${estado.className}`}>{estado.label}</Badge>
                                                                </td>
                                                            </tr>
                                                            {expandido && (
                                                                <tr className="bg-muted/10 border-b border-border">
                                                                    <td colSpan={8} className="p-4 pl-12">
                                                                        <div className="space-y-3">
                                                                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                                                <UtensilsCrossed className="w-4 h-4 text-primary" />
                                                                                Detalle del Consumo (Ficha #{pedido.numero_ficha})
                                                                            </h4>
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                <div className="space-y-2">
                                                                                    {pedido.items && pedido.items.length > 0 ? (
                                                                                        <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
                                                                                            {pedido.items.map((item, idx) => (
                                                                                                <div key={idx} className="p-3 flex items-center justify-between text-sm">
                                                                                                    <div>
                                                                                                        <span className="font-bold text-foreground">{item.cantidad}x</span>{' '}
                                                                                                        <span className="text-foreground">{item.nombre_item}</span>
                                                                                                        {item.instrucciones && (
                                                                                                            <div className="text-[11px] text-amber-400 mt-0.5 font-medium">
                                                                                                                Nota: {item.instrucciones}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <div className="text-right">
                                                                                                        <span className="text-muted-foreground text-xs block">Bs {Number(item.precio_unitario).toFixed(2)} c/u</span>
                                                                                                        <span className="font-semibold text-foreground">Bs {Number(item.subtotal).toFixed(2)}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                            <div className="p-3 bg-muted/20 flex justify-between font-bold text-sm">
                                                                                                <span className="text-foreground">Total:</span>
                                                                                                <span className="text-emerald-400">Bs {Number(pedido.total).toFixed(2)}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <p className="text-sm text-muted-foreground p-3 bg-muted/10 rounded-lg">El pedido no tiene platos registrados.</p>
                                                                                    )}
                                                                                </div>
                                                                                <div className="p-4 border border-border rounded-lg bg-card text-sm space-y-2">
                                                                                    <h5 className="font-medium text-foreground">Información del Pedido</h5>
                                                                                    <div className="grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                                                                                        <span>ID Pedido:</span>
                                                                                        <span className="font-mono text-foreground select-all text-[11px]">{pedido.id}</span>
                                                                                        <span>Registrado:</span>
                                                                                        <span className="text-foreground">
                                                                                            {(() => {
                                                                                                try {
                                                                                                    if (!pedido.creado_en) return '-';
                                                                                                    const d = new Date(pedido.creado_en);
                                                                                                    if (isNaN(d.getTime())) return String(pedido.creado_en);
                                                                                                    return format(d, 'HH:mm:ss');
                                                                                                } catch {
                                                                                                    return String(pedido.creado_en || '-');
                                                                                                }
                                                                                            })()} hs
                                                                                        </span>
                                                                                        <span>Actualizado:</span>
                                                                                        <span className="text-foreground">
                                                                                            {(() => {
                                                                                                try {
                                                                                                    if (!pedido.actualizado_en) return '-';
                                                                                                    const d = new Date(pedido.actualizado_en);
                                                                                                    if (isNaN(d.getTime())) return String(pedido.actualizado_en);
                                                                                                    return format(d, 'HH:mm:ss');
                                                                                                } catch {
                                                                                                    return String(pedido.actualizado_en || '-');
                                                                                                }
                                                                                            })()} hs
                                                                                        </span>
                                                                                        <span>Mesero ID:</span>
                                                                                        <span className="text-foreground font-mono">{pedido.id_mesero}</span>
                                                                                        {pedido.notas && (
                                                                                            <>
                                                                                                <span>Notas Generales:</span>
                                                                                                <span className="text-amber-300 font-medium">{pedido.notas}</span>
                                                                                            </>
                                                                                        )}
                                                                                        {pedido.datos_facturacion?.nit_ci && (
                                                                                            <>
                                                                                                <span>NIT/CI Recibo:</span>
                                                                                                <span className="text-foreground font-bold">{pedido.datos_facturacion.nit_ci}</span>
                                                                                            </>
                                                                                        )}
                                                                                        {pedido.datos_facturacion?.razon_social && (
                                                                                            <>
                                                                                                <span>Razón Social:</span>
                                                                                                <span className="text-foreground font-bold">{pedido.datos_facturacion.razon_social}</span>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                {/* Acciones de Control de Administración */}
                                                                                <div className="p-4 border border-border rounded-lg bg-card text-sm space-y-3">
                                                                                    <h5 className="font-semibold text-foreground border-b border-border pb-1.5 flex items-center gap-2">
                                                                                        Acciones del Administrador
                                                                                    </h5>
                                                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                                                        {pedido.estado !== 'pagado' && pedido.estado !== 'cancelado' && (
                                                                                            <>
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    className="border-primary/20 hover:bg-primary/10 text-primary font-bold"
                                                                                                    onClick={() => setPedidoAEditar(pedido)}
                                                                                                >
                                                                                                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar Pedido
                                                                                                </Button>
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="default"
                                                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                                                                    onClick={() => setPedidoACobrar(pedido)}
                                                                                                >
                                                                                                    <DollarSign className="w-3.5 h-3.5 mr-1" /> Cobrar y Recibo
                                                                                                </Button>
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    className="border-amber-500/20 hover:bg-amber-500/10 text-amber-500 font-bold"
                                                                                                    onClick={() => imprimirComanda(pedido)}
                                                                                                >
                                                                                                    <Printer className="w-3.5 h-3.5 mr-1 text-amber-400" /> Imprimir Comanda
                                                                                                </Button>
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    className="border-blue-500/20 hover:bg-blue-500/10 text-blue-400 font-bold"
                                                                                                    onClick={() => imprimirRecibo(pedido)}
                                                                                                >
                                                                                                    <FileText className="w-3.5 h-3.5 mr-1 text-blue-400" /> Imprimir Recibo
                                                                                                </Button>
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="secondary"
                                                                                                    className="font-bold border border-border"
                                                                                                    onClick={async () => {
                                                                                                        if (!confirm('¿Marcar todos los platos como entregados?')) return;
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
                                                                                                        await bdLocal.pedidos.update(pedido.id, updateData);
                                                                                                        try {
                                                                                                            await fetch(`${API_BASE_URL}/api/pedidos/${pedido.id}`, {
                                                                                                                method: 'PATCH',
                                                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                                                body: JSON.stringify(updateData),
                                                                                                            });
                                                                                                        } catch (err) {
                                                                                                            console.warn("Fallo al actualizar offline", err);
                                                                                                        }
                                                                                                        refetch();
                                                                                                    }}
                                                                                                >
                                                                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Entregar Todo
                                                                                                </Button>
                                                                                            </>
                                                                                        )}
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="destructive"
                                                                                            className="font-bold"
                                                                                            onClick={async () => {
                                                                                                if (!confirm('¿Eliminar este pedido permanentemente? (Desaparecerá de cocina y reportes)')) return;
                                                                                                await bdLocal.pedidos.delete(pedido.id);
                                                                                                try {
                                                                                                    await fetch(`${API_BASE_URL}/api/pedidos/${pedido.id}`, { method: 'DELETE' });
                                                                                                } catch {}
                                                                                                refetch();
                                                                                            }}
                                                                                        >
                                                                                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar Pedido
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Vista CARDS en móvil */}
                                    <div className="sm:hidden divide-y divide-border">
                                        {pedidosDia.map(pedido => {
                                            const estado = getEstadoBadge(pedido.estado);
                                            const expandido = !!pedidosExpandidos[pedido.id];
                                            return (
                                                <div key={pedido.id} className="p-4 space-y-2">
                                                    <div 
                                                        onClick={() => togglePedido(pedido.id)} 
                                                        className="flex items-center justify-between cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono font-bold text-lg text-foreground">#{pedido.numero_ficha}</span>
                                                            {pedido.numero_letrero && (
                                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                                    <MapPin className="w-3 h-3 text-primary" />
                                                                    <span className="font-black text-base text-foreground">{pedido.numero_letrero}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={`text-xs border ${estado.className}`}>{estado.label}</Badge>
                                                            {expandido ? (
                                                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                                            ) : (
                                                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                    </div>
                                                     
                                                     <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                         <div className="flex items-center gap-1">
                                                             <UserCircle className="w-3.5 h-3.5" />
                                                             <span>{nombreMesero(pedido.id_mesero)}</span>
                                                             <span>· {(() => {
                                                                 try {
                                                                     if (!pedido.creado_en) return '-';
                                                                     const d = new Date(pedido.creado_en);
                                                                     if (isNaN(d.getTime())) return String(pedido.creado_en);
                                                                     return format(d, 'HH:mm');
                                                                 } catch {
                                                                     return String(pedido.creado_en || '-');
                                                                 }
                                                             })()}</span>
                                                             <span>· {pedido.items?.length || 0} items</span>
                                                         </div>
                                                         <span className="font-bold text-emerald-400">Bs {Number(pedido.total || 0).toFixed(2)}</span>
                                                     </div>

                                                    {expandido && (
                                                        <div className="pt-3 border-t border-border mt-2 space-y-2 animate-accordion-down">
                                                            {pedido.items && pedido.items.length > 0 ? (
                                                                <div className="divide-y divide-border border border-border rounded-lg bg-muted/10 overflow-hidden">
                                                                    {pedido.items.map((item, idx) => (
                                                                        <div key={idx} className="p-2.5 flex justify-between text-xs text-foreground">
                                                                            <div>
                                                                                <span className="font-bold">{item.cantidad}x</span> {item.nombre_item}
                                                                                {item.instrucciones && (
                                                                                    <div className="text-[10px] text-amber-400 font-medium">Nota: {item.instrucciones}</div>
                                                                                )}
                                                                            </div>
                                                                            <span className="font-semibold">Bs {Number(item.subtotal).toFixed(2)}</span>
                                                                        </div>
                                                                    ))}
                                                                    <div className="p-2.5 bg-muted/30 flex justify-between font-bold text-xs text-foreground">
                                                                        <span>Total:</span>
                                                                        <span className="text-emerald-400">Bs {Number(pedido.total).toFixed(2)}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground py-2">Sin platos registrados.</p>
                                                            )}
                                                            {pedido.notas && (
                                                                <div className="text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded p-2">
                                                                    <strong>Notas:</strong> {pedido.notas}
                                                                </div>
                                                            )}
                                                            {/* Datos facturación en móvil */}
                                                            {(pedido.datos_facturacion?.nit_ci || pedido.datos_facturacion?.razon_social) && (
                                                                <div className="p-2.5 border border-border rounded-lg bg-card text-[11px] text-muted-foreground space-y-1">
                                                                    {pedido.datos_facturacion.nit_ci && <div><strong>NIT/CI Recibo:</strong> <span className="text-foreground font-bold">{pedido.datos_facturacion.nit_ci}</span></div>}
                                                                    {pedido.datos_facturacion.razon_social && <div><strong>Razón Social:</strong> <span className="text-foreground font-bold">{pedido.datos_facturacion.razon_social}</span></div>}
                                                                </div>
                                                            )}
                                                            {/* Acciones admin en móvil */}
                                                            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                                                                {pedido.estado !== 'pagado' && pedido.estado !== 'cancelado' && (
                                                                    <>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 px-2.5 border-primary/20 text-primary font-bold text-xs"
                                                                            onClick={() => setPedidoAEditar(pedido)}
                                                                        >
                                                                            <Pencil className="w-3 h-3 mr-1" /> Editar
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="default"
                                                                            className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                                                            onClick={() => setPedidoACobrar(pedido)}
                                                                        >
                                                                            <DollarSign className="w-3 h-3 mr-1" /> Cobrar
                                                                        </Button>
                                                                    </>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 px-2.5 border-amber-500/20 text-amber-500 font-bold text-xs"
                                                                    onClick={() => imprimirComanda(pedido)}
                                                                >
                                                                    <Printer className="w-3 h-3 mr-1 text-amber-400" /> Comanda
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 px-2.5 border-blue-500/20 text-blue-400 font-bold text-xs"
                                                                    onClick={() => imprimirRecibo(pedido)}
                                                                >
                                                                    <FileText className="w-3 h-3 mr-1 text-blue-400" /> Recibo
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: CONSOLIDADO DE PLATOS */}
                <TabsContent value="platos" className="mt-4">
                    <Card className="bg-card border-border">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base text-foreground">Consumo de Platos y Productos de Hoy</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            {platosVendidosSorted.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">Aún no se han vendido platos el día de hoy.</p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Listado ordenado */}
                                        <div className="border border-border rounded-lg overflow-hidden bg-muted/10 divide-y divide-border">
                                            <div className="bg-muted/40 p-3 flex justify-between text-xs font-semibold text-muted-foreground uppercase">
                                                <span>Plato / Producto</span>
                                                <div className="flex gap-12">
                                                    <span>Cant.</span>
                                                    <span className="w-16 text-right">Recaudado</span>
                                                </div>
                                            </div>
                                            {platosVendidosSorted.map(([nombre, info], index) => (
                                                <div key={index} className="p-3 flex items-center justify-between text-sm text-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs bg-primary/20 text-primary border border-primary/20 rounded px-1.5 py-0.5 font-bold">{index + 1}</span>
                                                        <div>
                                                            <span className="font-medium text-foreground">{nombre}</span>
                                                            <span className="text-[10px] text-muted-foreground block">{info.categoria}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-12 items-center">
                                                        <span className="font-bold text-foreground text-center">{info.cantidad}</span>
                                                        <span className="w-16 text-right font-semibold text-emerald-400">Bs {Number(info.total || 0).toFixed(0)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-4 border border-border rounded-lg bg-muted/5 flex flex-col justify-center space-y-4">
                                            <h4 className="text-sm font-semibold text-foreground">Estadísticas Rápidas</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-card p-3 border border-border rounded-lg">
                                                    <span className="text-xs text-muted-foreground block">Plato Más Vendido:</span>
                                                    <span className="text-sm font-bold text-primary truncate block">{platosVendidosSorted[0]?.[0] || '-'}</span>
                                                    <span className="text-xs text-muted-foreground">({platosVendidosSorted[0]?.[1]?.cantidad || 0} porciones)</span>
                                                </div>
                                                <div className="bg-card p-3 border border-border rounded-lg">
                                                    <span className="text-xs text-muted-foreground block">Variedad de Platos:</span>
                                                    <span className="text-lg font-bold text-foreground block">{platosVendidosSorted.length}</span>
                                                    <span className="text-xs text-muted-foreground">diferentes servidos</span>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs text-muted-foreground">
                                                💡 Utiliza este listado para realizar un seguimiento exacto de las porciones que salen de cocina y contrastarlas con tu inventario de insumos diarios.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {pedidoACobrar && (
                <ModalCobro
                    open={!!pedidoACobrar}
                    onOpenChange={(o) => { if (!o) setPedidoACobrar(null); }}
                    pedido={pedidoACobrar}
                    onCobrado={() => {
                        setPedidoACobrar(null);
                        refetch();
                    }}
                />
            )}
        </div>
    );
}
