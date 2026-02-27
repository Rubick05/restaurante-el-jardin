import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { useQuery } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { startOfDay, format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ReportesVentas() {
    const [dias, setDias] = useState(7);

    const { data: ventas, isLoading } = useQuery({
        queryKey: ['reporte-ventas', dias],
        queryFn: async () => {
            const fechaLimite = subDays(startOfDay(new Date()), dias);
            const pedidos = await bdLocal.pedidos
                .where('creado_en')
                .above(fechaLimite.toISOString())
                .toArray();

            // Filtrar solo pedidos completados/pagados
            const pedidosFinalizados = pedidos.filter(p => p.estado === 'pagado' || p.estado === 'entregado');

            // Agrupar por día
            const agrupado = pedidosFinalizados.reduce((acc, curr) => {
                const fecha = format(new Date(curr.creado_en), 'yyyy-MM-dd');
                if (!acc[fecha]) acc[fecha] = 0;
                acc[fecha] += curr.total;
                return acc;
            }, {} as Record<string, number>);

            // Formatear para Grafico
            return Object.entries(agrupado).map(([fecha, total]) => ({
                fecha: format(new Date(fecha), 'dd MMM', { locale: es }),
                total
            }));
        }
    });

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Reporte de Ventas</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas Totales (Últimos {dias} días)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${ventas?.reduce((acc, curr) => acc + curr.total, 0).toFixed(2) || '0.00'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Ingresos Diarios</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    <div className="h-[350px]">
                        {isLoading ? (
                            <div className="flex h-full items-center justify-center">Cargando...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ventas}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="fecha" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
