import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, Gasto, Pedido } from '@/lib/bd/bd-local';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/componentes/ui/card';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/componentes/ui/tabs';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ComposedChart
} from 'recharts';
import {
    DollarSign, PlusCircle, Trash2, Calendar, TrendingUp,
    ArrowUpRight, ArrowDownRight, Tag, Percent, UtensilsCrossed, AlertTriangle, FileText
} from 'lucide-react';
import { startOfDay, format, subDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { API_BASE_URL, normalizarPedidos, formatearFechaLocal } from '@/hooks/useInicializacion';

const CATEGORIAS_GASTOS = [
    'Insumos',
    'Personal',
    'Servicios',
    'Alquiler',
    'Mantenimiento',
    'Otros'
];

const COLORES_CATEGORIAS: Record<string, string> = {
    Insumos: '#3b82f6',      // Azul
    Personal: '#ef4444',     // Rojo
    Servicios: '#eab308',    // Amarillo
    Alquiler: '#a855f7',     // Púrpura
    Mantenimiento: '#10b981',// Verde
    Otros: '#64748b'         // Slate
};

export default function ReportesVentas() {
    const queryClient = useQueryClient();
    const [diasRango, setDiasRango] = useState(30);

    // Formulario de Gasto
    const [descripcion, setDescripcion] = useState('');
    const [monto, setMonto] = useState('');
    const [categoria, setCategoria] = useState('Insumos');
    const [fecha, setFecha] = useState(formatearFechaLocal(new Date()));
    const [guardando, setGuardando] = useState(false);

    // Cargar Pedidos e Ingresos
    const { data: reportData, isLoading } = useQuery({
        queryKey: ['reporte-financiero', diasRango],
        queryFn: async () => {
            const fechaLimite = subDays(startOfDay(new Date()), diasRango);

            // Cargar pedidos locales activos e históricos del rango
            const pedidosLocales = await bdLocal.pedidos
                .where('creado_en')
                .above(fechaLimite.toISOString())
                .toArray();

            const todosDiasCerrados = await bdLocal.diasCerrados.toArray();
            const pedidosHistoricos: Pedido[] = [];
            todosDiasCerrados.forEach(d => {
                if (d.pedidos_snapshot) {
                    try {
                        const snap = JSON.parse(d.pedidos_snapshot);
                        if (Array.isArray(snap)) {
                            pedidosHistoricos.push(...snap);
                        }
                    } catch (e) {
                        console.error("Error al parsear pedidos_snapshot:", e);
                    }
                }
            });

            // Combinar y eliminar duplicados por ID
            const combinados = [...pedidosLocales, ...pedidosHistoricos];
            const mapPedidos = new Map<string, Pedido>();
            combinados.forEach(p => {
                mapPedidos.set(p.id, p);
            });

            const todosPedidos = Array.from(mapPedidos.values());
            const todosPedidosNormalizados = normalizarPedidos(todosPedidos);

            // Filtrar pagados / entregados que están dentro del rango de fecha
            const pedidosValidos = todosPedidosNormalizados.filter(p => {
                const esEstadoCorrecto = p.estado === 'pagado' || p.estado === 'entregado';
                const esFechaValida = p.creado_en && new Date(p.creado_en) >= fechaLimite;
                return esEstadoCorrecto && esFechaValida;
            });

            // Cargar gastos locales
            const todosGastos = await bdLocal.gastos.toArray();
            const gastosFiltrados = todosGastos.filter(
                g => new Date(g.fecha) >= fechaLimite
            );

            // Cargar menú para obtener costos de insumos
            const menuLocal = await bdLocal.elementosMenu.toArray();
            const costoMap: Record<string, number> = {};
            menuLocal.forEach(m => {
                costoMap[m.nombre] = m.costo || 0;
                if (m.id) {
                    costoMap[m.id] = m.costo || 0;
                }
            });

            // 1. Agrupar ingresos, gastos y costos de insumos por día en el rango
            const agrupadoPorDia: Record<string, { fechaLabel: string; ingresos: number; gastos: number; costoInsumos: number; utilidad: number }> = {};
            
            // Generar todos los días del rango para que el gráfico no tenga saltos vacíos
            for (let i = diasRango; i >= 0; i--) {
                const d = subDays(new Date(), i);
                const fechaKey = format(d, 'yyyy-MM-dd');
                agrupadoPorDia[fechaKey] = {
                    fechaLabel: format(d, 'dd MMM', { locale: es }),
                    ingresos: 0,
                    gastos: 0,       // Gastos de caja manuales
                    costoInsumos: 0, // Costo de insumos de platos vendidos
                    utilidad: 0
                };
            }

            // Sumar ingresos y calcular costo de insumos vendidos diariamente
            pedidosValidos.forEach(p => {
                if (!p.creado_en) return;
                const fechaKey = formatearFechaLocal(p.creado_en);
                if (agrupadoPorDia[fechaKey]) {
                    agrupadoPorDia[fechaKey].ingresos += Number(p.total || 0);
                    
                    p.items?.forEach((item: any) => {
                        const costoUnit = costoMap[item.id_elemento_menu] || costoMap[item.nombre_item] || 0;
                        agrupadoPorDia[fechaKey].costoInsumos += Number(item.cantidad || 0) * Number(costoUnit);
                    });
                }
            });

            // Sumar gastos manuales registrados en caja
            gastosFiltrados.forEach(g => {
                if (!g.fecha) return;
                const fechaKey = formatearFechaLocal(g.fecha);
                if (agrupadoPorDia[fechaKey]) {
                    agrupadoPorDia[fechaKey].gastos += Number(g.monto || 0);
                }
            });

            // Calcular utilidades diarias descontando ambos tipos de egreso
            Object.keys(agrupadoPorDia).forEach(k => {
                const ingresos = Number(agrupadoPorDia[k].ingresos || 0);
                const gastos = Number(agrupadoPorDia[k].gastos || 0);
                const costoInsumos = Number(agrupadoPorDia[k].costoInsumos || 0);
                agrupadoPorDia[k].utilidad = ingresos - (gastos + costoInsumos);
            });

            // Convertir a array para gráficos
            const historicoFinanciero = Object.entries(agrupadoPorDia)
                .map(([fechaKey, val]) => ({
                    fechaKey,
                    ...val
                }))
                .sort((a, b) => a.fechaKey.localeCompare(b.fechaKey));

            // 2. Gastos por categoría
            const gastosCategorias: Record<string, number> = {};
            CATEGORIAS_GASTOS.forEach(c => { gastosCategorias[c] = 0; });
            
            gastosFiltrados.forEach(g => {
                const cat = g.categoria || 'Otros';
                const montoNum = Number(g.monto || 0);
                if (gastosCategorias[cat] !== undefined) {
                    gastosCategorias[cat] += montoNum;
                } else {
                    gastosCategorias['Otros'] = (gastosCategorias['Otros'] || 0) + montoNum;
                }
            });

            const gastosPorCategoriaData = Object.entries(gastosCategorias)
                .map(([name, value]) => ({ name, value }))
                .filter(c => c.value > 0);

            // 3. Consolidar platos más vendidos en el rango
            const platosVendidos: Record<string, { cantidad: number; total: number; categoria: string; costoUnitario: number }> = {};
            pedidosValidos.forEach(p => {
                p.items?.forEach((item: any) => {
                    const nombre = item.nombre_item;
                    if (!platosVendidos[nombre]) {
                        const costoUnit = costoMap[item.id_elemento_menu] || costoMap[nombre] || 0;
                        platosVendidos[nombre] = { 
                             cantidad: 0, 
                             total: 0, 
                             categoria: item.categoria || 'Sin Categoría',
                             costoUnitario: costoUnit
                        };
                    }
                    platosVendidos[nombre].cantidad += item.cantidad;
                    platosVendidos[nombre].total += item.cantidad * item.precio_unitario;
                });
            });

            const topPlatos = Object.entries(platosVendidos)
                .map(([nombre, info]) => ({ nombre, ...info }))
                .sort((a, b) => b.cantidad - a.cantidad);

            // Totales acumulados
            const totalIngresos = pedidosValidos.reduce((acc, p) => acc + p.total, 0);
            
            const totalCostoInsumos = pedidosValidos.reduce((acc, p) => {
                const costoPedido = p.items?.reduce((itemAcc: number, item: any) => {
                    const costoUnit = costoMap[item.id_elemento_menu] || costoMap[item.nombre_item] || 0;
                    return itemAcc + (Number(item.cantidad || 0) * Number(costoUnit));
                }, 0) || 0;
                return acc + costoPedido;
            }, 0);

            const totalGastosRegistrados = gastosFiltrados.reduce((acc, g) => acc + Number(g.monto || 0), 0);
            const totalGastos = totalGastosRegistrados + totalCostoInsumos;
            const utilidadNeta = totalIngresos - totalGastos;
            const margenUtilidad = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;

            return {
                historicoFinanciero,
                gastosPorCategoriaData,
                topPlatos,
                todosGastos: todosGastos.sort((a, b) => {
                    const cmpFecha = (b.fecha || '').localeCompare(a.fecha || '');
                    if (cmpFecha !== 0) return cmpFecha;
                    return (b.creado_en || '').localeCompare(a.creado_en || '');
                }),
                stats: {
                    totalIngresos,
                    totalGastos,
                    totalGastosRegistrados,
                    totalCostoInsumos,
                    utilidadNeta,
                    margenUtilidad,
                    cantidadPedidos: pedidosValidos.length,
                    ticketPromedio: pedidosValidos.length > 0 ? totalIngresos / pedidosValidos.length : 0
                }
            };
        }
    });

    // Guardar nuevo gasto
    const handleCrearGasto = async (e: React.FormEvent) => {
        e.preventDefault();
        const montoNum = parseFloat(monto);
        if (!descripcion.trim() || isNaN(montoNum) || montoNum <= 0) {
            alert('Por favor introduce una descripción válida y un monto mayor a 0');
            return;
        }

        setGuardando(true);
        try {
            const uuid = self.crypto?.randomUUID() || Math.random().toString(36).substring(2);
            const nuevoGasto: Gasto = {
                id: uuid,
                id_restaurante: 'demo-tenant',
                descripcion: descripcion.trim(),
                monto: montoNum,
                categoria,
                fecha,
                creado_en: new Date().toISOString(),
                actualizado_en: new Date().toISOString()
            };

            // 1. Guardar localmente
            await bdLocal.gastos.put(nuevoGasto);

            // 2. Intentar guardar en servidor (Network Fallback)
            try {
                const res = await fetch(`${API_BASE_URL}/api/gastos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nuevoGasto)
                });
                if (!res.ok) console.warn('Gasto guardado localmente, sincronización pendiente.');
            } catch {
                console.warn('Modo offline: Gasto guardado localmente en IndexedDB.');
            }

            // Invalida la query para refrescar la pantalla
            await queryClient.invalidateQueries({ queryKey: ['reporte-financiero'] });
            await queryClient.invalidateQueries({ queryKey: ['gastos'] });

            // Resetear formulario
            setDescripcion('');
            setMonto('');
            alert('✅ Gasto registrado correctamente');
        } catch (error) {
            alert('Error al registrar el gasto');
        } finally {
            setGuardando(false);
        }
    };

    // Eliminar gasto
    const handleEliminarGasto = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este gasto?')) return;

        try {
            // 1. Eliminar localmente
            await bdLocal.gastos.delete(id);

            // 2. Intentar eliminar en servidor
            try {
                const res = await fetch(`${API_BASE_URL}/api/gastos/${id}`, {
                    method: 'DELETE'
                });
                if (!res.ok) console.warn('Eliminación del servidor pendiente de sincronización.');
            } catch {
                console.warn('Offline: Eliminado localmente de IndexedDB.');
            }

            await queryClient.invalidateQueries({ queryKey: ['reporte-financiero'] });
            await queryClient.invalidateQueries({ queryKey: ['gastos'] });
        } catch {
            alert('Error al eliminar el gasto');
        }
    };

    const stats = reportData?.stats || {
        totalIngresos: 0,
        totalGastos: 0,
        totalGastosRegistrados: 0,
        totalCostoInsumos: 0,
        utilidadNeta: 0,
        margenUtilidad: 0,
        cantidadPedidos: 0,
        ticketPromedio: 0
    };

    return (
        <div className="space-y-6">
            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-serif flex items-center gap-2 text-foreground">
                        <TrendingUp className="w-8 h-8 text-primary" />
                        Finanzas y Reportes
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Control de ingresos, gastos, beneficios y utilidades del negocio
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="rango-dias" className="text-sm font-medium text-muted-foreground hidden sm:inline">Rango:</Label>
                    <select
                        id="rango-dias"
                        value={diasRango}
                        onChange={(e) => setDiasRango(Number(e.target.value))}
                        className="bg-card border border-border text-foreground rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value={7}>Últimos 7 días</option>
                        <option value={15}>Últimos 15 días</option>
                        <option value={30}>Últimos 30 días</option>
                        <option value={90}>Últimos 90 días</option>
                    </select>
                </div>
            </div>

            {/* Panel de Utilidades KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Ingresos */}
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingresos (Ventas)</CardTitle>
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-foreground">Bs {stats.totalIngresos.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{stats.cantidadPedidos} pedidos finalizados</p>
                    </CardContent>
                </Card>

                {/* Gastos */}
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gastos Totales</CardTitle>
                        <ArrowDownRight className="w-4 h-4 text-red-400" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-foreground">Bs {stats.totalGastos.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Insumos: Bs {(stats.totalCostoInsumos || 0).toFixed(0)} | Caja: Bs {(stats.totalGastosRegistrados || 0).toFixed(0)}
                        </p>
                    </CardContent>
                </Card>

                {/* Utilidades Netas */}
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Utilidades Netas</CardTitle>
                        <DollarSign className={`w-4 h-4 ${stats.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className={`text-2xl font-bold ${stats.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            Bs {stats.utilidadNeta.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Beneficio neto real obtenido</p>
                    </CardContent>
                </Card>

                {/* Margen */}
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Margen Comercial</CardTitle>
                        <Percent className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-foreground">
                            {stats.margenUtilidad.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Rentabilidad del negocio</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="utilidades" className="w-full">
                <TabsList className="bg-muted w-full sm:w-auto grid grid-cols-3">
                    <TabsTrigger value="utilidades">Resumen Financiero</TabsTrigger>
                    <TabsTrigger value="gastos">Registro de Gastos</TabsTrigger>
                    <TabsTrigger value="platos">Platos más Vendidos</TabsTrigger>
                </TabsList>

                {/* TAB 1: RESUMEN FINANCIERO */}
                <TabsContent value="utilidades" className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Gráfico de Tendencia (Ingresos, Gastos, Utilidad) */}
                        <Card className="col-span-1 lg:col-span-2 bg-card border-border">
                            <CardHeader className="p-4">
                                <CardTitle className="text-sm font-semibold text-foreground">Historial de Rendimiento Diario</CardTitle>
                                <CardDescription>Balance diario de ingresos, gastos y utilidad neta</CardDescription>
                            </CardHeader>
                            <CardContent className="p-2 pt-0 h-[350px]">
                                {isLoading ? (
                                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Cargando gráfico...</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={reportData?.historicoFinanciero || []}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis dataKey="fechaLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--card))',
                                                    borderColor: 'hsl(var(--border))',
                                                    color: 'hsl(var(--foreground))'
                                                }}
                                            />
                                            <Legend verticalAlign="top" height={36} />
                                            <Bar dataKey="ingresos" name="Ingresos (Ventas)" fill="#10b981" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="gastos" name="Gastos (Caja)" stackId="egresos" fill="#ef4444" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="costoInsumos" name="Costo de Insumos" stackId="egresos" fill="#fb923c" radius={[3, 3, 0, 0]} />
                                            <Line type="monotone" dataKey="utilidad" name="Utilidad Neta" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 2 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>

                        {/* Gastos por Categoría */}
                        <Card className="bg-card border-border">
                            <CardHeader className="p-4">
                                <CardTitle className="text-sm font-semibold text-foreground">Distribución de Gastos</CardTitle>
                                <CardDescription>Gastos agrupados por categorías en el rango</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 flex flex-col justify-center h-[320px]">
                                {isLoading ? (
                                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Cargando distribución...</div>
                                ) : reportData?.gastosPorCategoriaData && reportData.gastosPorCategoriaData.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="h-[160px] flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={reportData?.gastosPorCategoriaData || []}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={45}
                                                        outerRadius={65}
                                                        paddingAngle={4}
                                                        dataKey="value"
                                                    >
                                                        {reportData.gastosPorCategoriaData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORES_CATEGORIAS[entry.name] || '#64748b'} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        formatter={(value: any) => [`Bs ${Number(value ?? 0).toFixed(2)}`, 'Gasto']}
                                                        contentStyle={{
                                                            backgroundColor: 'hsl(var(--card))',
                                                            borderColor: 'hsl(var(--border))',
                                                            color: 'hsl(var(--foreground))'
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            {reportData.gastosPorCategoriaData.map((entry, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORES_CATEGORIAS[entry.name] }} />
                                                    <span className="text-muted-foreground truncate">{entry.name}:</span>
                                                    <span className="font-semibold text-foreground">Bs {Number(entry.value).toFixed(0)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-1">
                                        <Tag className="w-10 h-10 text-muted/30" />
                                        <p className="text-xs font-semibold">Sin gastos en este período</p>
                                        <p className="text-[10px]">Los gastos agregados se graficarán aquí.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 2: REGISTRO DE GASTOS */}
                <TabsContent value="gastos" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Formulario */}
                        <Card className="bg-card border-border h-fit">
                            <CardHeader className="p-4">
                                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-1.5">
                                    <PlusCircle className="w-5 h-5 text-primary" />
                                    Registrar Gasto
                                </CardTitle>
                                <CardDescription>Registra un nuevo egreso de forma dinámica</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <form onSubmit={handleCrearGasto} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="gasto-desc" className="text-xs text-muted-foreground">Descripción del Gasto:</Label>
                                        <Input
                                            id="gasto-desc"
                                            value={descripcion}
                                            onChange={(e) => setDescripcion(e.target.value)}
                                            placeholder="Ej. Compra de carne, Pago de luz"
                                            className="bg-background border-border text-foreground"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="gasto-monto" className="text-xs text-muted-foreground">Monto (Bs):</Label>
                                            <Input
                                                id="gasto-monto"
                                                type="number"
                                                step="0.01"
                                                value={monto}
                                                onChange={(e) => setMonto(e.target.value)}
                                                placeholder="0.00"
                                                className="bg-background border-border text-foreground font-mono"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="gasto-cat" className="text-xs text-muted-foreground">Categoría:</Label>
                                            <select
                                                id="gasto-cat"
                                                value={categoria}
                                                onChange={(e) => setCategoria(e.target.value)}
                                                className="w-full bg-background border border-border text-foreground rounded-md p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                                            >
                                                {CATEGORIAS_GASTOS.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="gasto-fecha" className="text-xs text-muted-foreground">Fecha del Gasto:</Label>
                                        <Input
                                            id="gasto-fecha"
                                            type="date"
                                            value={fecha}
                                            onChange={(e) => setFecha(e.target.value)}
                                            className="bg-background border-border text-foreground"
                                            required
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={guardando}
                                        className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold"
                                    >
                                        {guardando ? 'Guardando...' : 'Añadir Gasto'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Listado de Gastos */}
                        <Card className="col-span-1 lg:col-span-2 bg-card border-border">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-1.5">
                                    <FileText className="w-5 h-5 text-muted-foreground" />
                                    Histórico de Egresos
                                </CardTitle>
                                <CardDescription>Todos los gastos registrados en el sistema</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoading ? (
                                    <div className="p-8 text-center text-muted-foreground">Cargando gastos registrados...</div>
                                ) : !reportData?.todosGastos || reportData.todosGastos.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground">Sin gastos registrados en el historial.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-muted/40 border-b border-border text-muted-foreground text-xs uppercase">
                                                <tr>
                                                    <th className="p-3 font-semibold">Fecha</th>
                                                    <th className="p-3 font-semibold">Descripción</th>
                                                    <th className="p-3 font-semibold">Categoría</th>
                                                    <th className="p-3 text-right font-semibold">Monto</th>
                                                    <th className="p-3 text-center font-semibold w-12">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {reportData.todosGastos.map((gasto) => (
                                                    <tr key={gasto.id} className="hover:bg-accent/20 transition-colors">
                                                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                                                            {format(new Date(gasto.fecha + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}
                                                        </td>
                                                        <td className="p-3 font-medium text-foreground">{gasto.descripcion}</td>
                                                        <td className="p-3 whitespace-nowrap">
                                                            <span className="flex items-center gap-1.5">
                                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORES_CATEGORIAS[gasto.categoria] || '#64748b' }} />
                                                                <span className="text-foreground">{gasto.categoria}</span>
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right font-bold text-red-400 font-mono whitespace-nowrap">
                                                            Bs {Number(gasto.monto).toFixed(2)}
                                                        </td>
                                                        <td className="p-3 text-center whitespace-nowrap">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleEliminarGasto(gasto.id)}
                                                                className="text-red-400 hover:text-red-500 hover:bg-destructive/10 p-2 h-auto"
                                                                title="Eliminar gasto"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 3: PLATOS MÁS VENDIDOS */}
                <TabsContent value="platos" className="mt-4">
                    <Card className="bg-card border-border">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base text-foreground">Análisis de Rotación de Menú (Platos más Vendidos)</CardTitle>
                            <CardDescription>Platos más consumidos por los clientes en los últimos {diasRango} días</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4">
                            {isLoading ? (
                                <p className="text-center text-muted-foreground py-8">Cargando análisis de platos...</p>
                            ) : !reportData?.topPlatos || reportData.topPlatos.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No se han registrado consumos en los últimos {diasRango} días.</p>
                            ) : (
                                <div className="space-y-6">
                                    {/* Gráfico de platos */}
                                    <div className="h-[250px] border border-border rounded-lg bg-muted/10 p-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={reportData?.topPlatos?.slice(0, 10) || []} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                                                <YAxis dataKey="nombre" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={100} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'hsl(var(--card))',
                                                        borderColor: 'hsl(var(--border))',
                                                        color: 'hsl(var(--foreground))'
                                                    }}
                                                />
                                                <Bar dataKey="cantidad" name="Porciones Vendidas" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
 
                                    {/* Tabla resumen detallada de desglose */}
                                    <div className="border border-border rounded-lg overflow-hidden bg-card">
                                        <div className="p-4 border-b border-border bg-muted/30">
                                            <h4 className="font-semibold text-sm text-foreground">Desglose de Costo Real y Utilidades por Plato</h4>
                                            <p className="text-xs text-muted-foreground">Detalle exacto de la inversión de insumos frente al precio de venta</p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-muted/40 border-b border-border text-muted-foreground text-xs uppercase">
                                                    <tr>
                                                        <th className="p-3 font-semibold">Plato / Producto</th>
                                                        <th className="p-3 font-semibold">Categoría</th>
                                                        <th className="p-3 text-center font-semibold">Cant. Vendida</th>
                                                        <th className="p-3 text-right font-semibold">Costo Unitario</th>
                                                        <th className="p-3 text-right font-semibold">Ingresos</th>
                                                        <th className="p-3 text-right font-semibold">Costo Real</th>
                                                        <th className="p-3 text-right font-semibold">Utilidad</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {reportData.topPlatos.map((plato, idx) => {
                                                        const totalCosto = plato.cantidad * Number(plato.costoUnitario || 0);
                                                        const utilidad = Number(plato.total || 0) - totalCosto;
                                                        return (
                                                            <tr key={idx} className="hover:bg-accent/20 transition-colors">
                                                                <td className="p-3 font-semibold text-foreground">{plato.nombre}</td>
                                                                <td className="p-3 text-muted-foreground">{plato.categoria}</td>
                                                                <td className="p-3 text-center font-bold text-foreground">{plato.cantidad}</td>
                                                                <td className="p-3 text-right font-mono text-muted-foreground">Bs {Number(plato.costoUnitario || 0).toFixed(2)}</td>
                                                                <td className="p-3 text-right font-mono text-emerald-400">Bs {Number(plato.total || 0).toFixed(2)}</td>
                                                                <td className="p-3 text-right font-mono text-red-400">Bs {Number(totalCosto || 0).toFixed(2)}</td>
                                                                <td className="p-3 text-right font-mono font-bold text-primary">Bs {Number(utilidad || 0).toFixed(2)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
