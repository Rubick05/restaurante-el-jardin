import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Button } from '@/componentes/ui/button';
import {
    Calendar, TrendingUp, Hash, UtensilsCrossed,
    ChevronDown, ChevronUp, UserCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { USUARIOS_SISTEMA } from '@/lib/auth/usuarios';

function nombreMesero(idMesero: string): string {
    return USUARIOS_SISTEMA.find(u => u.id === idMesero)?.nombre ?? idMesero;
}

export default function HistorialDias() {
    const [expandido, setExpandido] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data: dias = [], isFetching } = useQuery({
        queryKey: ['dias-cerrados'],
        queryFn: async () => {
            const todos = await bdLocal.diasCerrados.toArray();
            return todos.sort((a, b) => b.fecha.localeCompare(a.fecha));
        },
        refetchOnWindowFocus: true,
    });

    const handleEliminarDia = async (id: string) => {
        if (!confirm('¿Eliminar este registro histórico? Esta acción no se puede deshacer.')) return;
        await bdLocal.diasCerrados.delete(id);
        queryClient.invalidateQueries({ queryKey: ['dias-cerrados'] });
    };

    const totalGeneral = dias.reduce((acc, d) => acc + d.total_recaudado, 0);
    const totalPedidos = dias.reduce((acc, d) => acc + d.total_pedidos, 0);

    return (
        <div className="space-y-6">
            {/* Encabezado */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-serif flex items-center gap-2">
                        <Calendar className="w-8 h-8" />
                        Historial de Días
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Registro de todos los días cerrados — rendición de cuentas
                    </p>
                </div>
                {isFetching && (
                    <span className="text-xs text-muted-foreground animate-pulse">actualizando...</span>
                )}
            </div>

            {/* Resumen General */}
            {dias.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <Calendar className="w-8 h-8 text-blue-500" />
                            <div>
                                <div className="text-2xl font-bold">{dias.length}</div>
                                <div className="text-xs text-muted-foreground">Días con Actividad</div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <TrendingUp className="w-8 h-8 text-green-500" />
                            <div>
                                <div className="text-2xl font-bold">Bs {Number(totalGeneral || 0).toFixed(2)}</div>
                                <div className="text-xs text-muted-foreground">Total Acumulado</div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <Hash className="w-8 h-8 text-orange-500" />
                            <div>
                                <div className="text-2xl font-bold">{totalPedidos}</div>
                                <div className="text-xs text-muted-foreground">Pedidos Totales</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Sin datos */}
            {dias.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                    <Calendar className="w-16 h-16 mb-4 text-slate-300" />
                    <p className="text-lg font-medium">Sin días cerrados</p>
                    <p className="text-sm text-muted-foreground">
                        Cuando se cierre el día en "Pedidos del Día", el resumen aparecerá aquí
                    </p>
                </div>
            )}

            {/* Lista de días */}
            <div className="space-y-3">
                {dias.map(dia => {
                    const pedidos = JSON.parse(dia.pedidos_snapshot ?? '[]');
                    const estaExpandido = expandido === dia.id;

                    return (
                        <Card key={dia.id} className="overflow-hidden">
                            <CardHeader
                                className="pb-2 cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => setExpandido(estaExpandido ? null : dia.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 rounded-lg p-2">
                                            <Calendar className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base capitalize">
                                                {format(new Date(dia.fecha + 'T12:00:00'), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                                            </CardTitle>
                                            <p className="text-xs text-muted-foreground">
                                                Cerrado: {format(new Date(dia.cerrado_en), 'HH:mm')} hs
                                                · {dia.total_pedidos} pedidos · {dia.total_items} items
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className="font-bold text-green-700 text-lg">
                                                Bs {Number(dia.total_recaudado || 0).toFixed(2)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">recaudado</div>
                                        </div>
                                        {estaExpandido
                                            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        }
                                    </div>
                                </div>
                            </CardHeader>

                            {estaExpandido && (
                                <CardContent className="pt-0 border-t">
                                    <div className="overflow-x-auto mt-3">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b">
                                                <tr>
                                                    <th className="text-left p-2.5 font-semibold">Ficha</th>
                                                    <th className="text-left p-2.5 font-semibold">Letrero</th>
                                                    <th className="text-left p-2.5 font-semibold">Hora</th>
                                                    <th className="text-left p-2.5 font-semibold">
                                                        <span className="flex items-center gap-1">
                                                            <UserCircle className="w-3.5 h-3.5" /> Mesero
                                                        </span>
                                                    </th>
                                                    <th className="text-left p-2.5 font-semibold">
                                                        <span className="flex items-center gap-1">
                                                            <UtensilsCrossed className="w-3.5 h-3.5" /> Items
                                                        </span>
                                                    </th>
                                                    <th className="text-right p-2.5 font-semibold">Total</th>
                                                    <th className="text-center p-2.5 font-semibold">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pedidos.map((p: any) => (
                                                    <tr key={p.id} className="border-b hover:bg-slate-50">
                                                        <td className="p-2.5 font-mono font-bold">#{p.numero_ficha}</td>
                                                        <td className="p-2.5 font-black text-xl">{p.numero_letrero || '-'}</td>
                                                        <td className="p-2.5 text-muted-foreground">
                                                            {format(new Date(p.creado_en), 'HH:mm')}
                                                        </td>
                                                        <td className="p-2.5">{nombreMesero(p.id_mesero)}</td>
                                                        <td className="p-2.5 text-muted-foreground">{p.items?.length ?? 0}</td>
                                                        <td className="p-2.5 text-right font-bold text-green-700">
                                                            Bs {Number(p.total || 0).toFixed(2)}
                                                        </td>
                                                        <td className="p-2.5 text-center">
                                                            <Badge className={
                                                                p.estado === 'pagado'
                                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                                    : 'bg-slate-100 text-slate-600'
                                                            }>
                                                                {p.estado === 'pagado' ? 'Pagado ✓' : p.estado}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-green-50 border-t-2 border-green-200">
                                                    <td colSpan={5} className="p-2.5 font-bold text-right">TOTAL DEL DÍA:</td>
                                                    <td className="p-2.5 text-right font-black text-green-700 text-base">
                                                        Bs {Number(dia.total_recaudado || 0).toFixed(2)}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    <div className="flex justify-end mt-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs"
                                            onClick={() => handleEliminarDia(dia.id)}
                                        >
                                            Eliminar registro
                                        </Button>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
