import { useQuery } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/componentes/ui/button';

export default function ResumenDia() {
    const { data: resumen, isLoading } = useQuery({
        queryKey: ['resumen-dia'],
        queryFn: async () => {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            // Obtener pedidos pagados de hoy
            const pedidos = await bdLocal.pedidos
                .where('estado')
                .equals('pagado')
                .filter(p => new Date(p.actualizado_en) >= hoy) // Usamos actualizado_en como fecha de pago aprox
                .toArray();

            const total = pedidos.reduce((acc, p) => acc + p.total, 0);
            const cantidadPedidos = pedidos.length;

            return { pedidos, total, cantidadPedidos };
        }
    });

    const handleImprimir = () => {
        window.print();
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center print:hidden">
                <h1 className="text-3xl font-bold">Resumen del Día</h1>
                <Button onClick={handleImprimir} variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir Reporte
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                        <span className="text-2xl font-bold text-green-600">${resumen?.total.toFixed(2)}</span>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">+ del día de hoy</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pedidos Pagados</CardTitle>
                        <span className="text-2xl font-bold">{resumen?.cantidadPedidos}</span>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">tickets cerrados</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="print:shadow-none print:border-none">
                <CardHeader>
                    <CardTitle>Detalle de Ventas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border print:border-black">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 print:bg-gray-200">
                                <tr>
                                    <th className="p-3 font-medium">Hora</th>
                                    <th className="p-3 font-medium"># Pedido</th>
                                    <th className="p-3 font-medium">Método</th>
                                    <th className="p-3 font-medium text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resumen?.pedidos.map((p) => (
                                    <tr key={p.id} className="border-t print:border-gray-300">
                                        <td className="p-3">
                                            {new Date(p.actualizado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-3">#{p.numero_pedido.slice(0, 8)}</td>
                                        <td className="p-3 uppercase text-xs">{p.tipo_pedido} / {p.datos_facturacion?.tipo || 'Recibo'}</td>
                                        <td className="p-3 text-right font-mono">${p.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {resumen?.pedidos.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                            No hay ventas registradas hoy.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
