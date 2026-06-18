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
import { API_BASE_URL } from '@/hooks/useInicializacion';

function nombreMesero(idMesero: string): string {
    return USUARIOS_SISTEMA.find(u => u.id === idMesero)?.nombre ?? idMesero;
}

function getEstadoBadge(estado: string) {
    const map: Record<string, { label: string; className: string }> = {
        pendiente: { label: 'Pendiente', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
        en_proceso: { label: 'En Proceso', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        listo: { label: 'Listo', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
        entregado: { label: 'Entregado', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
        pagado: { label: 'Pagado ✓', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
        cancelado: { label: 'Cancelado', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    return map[estado] || { label: estado, className: 'bg-secondary text-secondary-foreground border border-border' };
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

        try {
            const res = await fetch(`${API_BASE_URL}/api/historial/${id}`, { method: 'DELETE' });

            if (res.ok) {
                await bdLocal.diasCerrados.delete(id);
                queryClient.invalidateQueries({ queryKey: ['dias-cerrados'] });
            } else {
                alert('No se pudo borrar el registro del servidor. Verifica tu conexión.');
            }
        } catch {
            alert('Error de red al intentar borrar del servidor.');
        }
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
                    <Card className="bg-card border-border shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <Calendar className="w-8 h-8 text-blue-400" />
                            <div>
                                <div className="text-2xl font-bold text-foreground">{dias.length}</div>
                                <div className="text-xs text-muted-foreground">Días con Actividad</div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <TrendingUp className="w-8 h-8 text-emerald-400" />
                            <div>
                                <div className="text-2xl font-bold text-foreground">Bs {Number(totalGeneral || 0).toFixed(2)}</div>
                                <div className="text-xs text-muted-foreground">Total Acumulado</div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <Hash className="w-8 h-8 text-amber-500" />
                            <div>
                                <div className="text-2xl font-bold text-foreground">{totalPedidos}</div>
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
                        <Card key={dia.id} className="overflow-hidden border-border bg-card">
                            <CardHeader
                                className="pb-2 cursor-pointer hover:bg-accent/40 transition-colors"
                                onClick={() => setExpandido(estaExpandido ? null : dia.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 rounded-lg p-2">
                                            <Calendar className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base capitalize text-foreground">
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
                                            <div className="font-bold text-emerald-400 text-lg">
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
                                <CardContent className="pt-0 border-t border-border">
                                    <div className="overflow-x-auto mt-3">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/40 border-b border-border text-muted-foreground text-xs uppercase">
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
                                            <tbody className="divide-y divide-border">
                                                {pedidos.map((p: any) => (
                                                    <tr key={p.id} className="hover:bg-accent/20 transition-colors">
                                                        <td className="p-2.5 font-mono font-bold text-foreground">#{p.numero_ficha}</td>
                                                        <td className="p-2.5 font-black text-xl text-foreground">{p.numero_letrero || '-'}</td>
                                                        <td className="p-2.5 text-muted-foreground">
                                                            {p.creado_en ? format(new Date(p.creado_en), 'HH:mm') : '-'}
                                                        </td>
                                                        <td className="p-2.5 text-foreground">{nombreMesero(p.id_mesero)}</td>
                                                        <td className="p-2.5 text-muted-foreground">{p.items?.length ?? 0} items</td>
                                                        <td className="p-2.5 text-right font-bold text-emerald-400 font-mono">
                                                            Bs {Number(p.total || 0).toFixed(2)}
                                                        </td>
                                                        <td className="p-2.5 text-center">
                                                            <Badge className={`text-xs border ${getEstadoBadge(p.estado).className}`}>
                                                                {getEstadoBadge(p.estado).label}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-emerald-500/10 border-t border-border font-bold">
                                                    <td colSpan={5} className="p-2.5 font-bold text-right text-foreground">TOTAL DEL DÍA:</td>
                                                    <td className="p-2.5 text-right font-black text-emerald-400 text-base font-mono">
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
                                            className="text-red-400 hover:text-red-500 hover:bg-destructive/10 text-xs font-bold"
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
