import { useQuery } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { Card, CardContent } from '@/componentes/ui/card';
import { Badge } from '@/componentes/ui/badge';
import { Clock, PackageCheck, ChefHat } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

interface EntregaItem {
    pedidoId: string;
    numeroFicha: number;
    numeroLetrero: string;
    nombre: string;
    cantidad: number;
    categoria: string;
    entregado_en: string; // fecha del pedido (aproximación)
}

const CATEGORIAS_COCINA = ['Plato Fuerte', 'Caldos'];
const vaACocina = (cat?: string): boolean => {
    if (!cat) return true;
    if (CATEGORIAS_COCINA.includes(cat)) return true;
    const c = cat.toLowerCase();
    return c.includes('plato') || c.includes('caldo') || c.includes('fuerte');
};

function agruparPorDia(items: EntregaItem[]) {
    const grupos: Record<string, EntregaItem[]> = {};
    for (const it of items) {
        const fecha = it.entregado_en.slice(0, 10);
        if (!grupos[fecha]) grupos[fecha] = [];
        grupos[fecha].push(it);
    }
    return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]));
}

function etiquetaDia(fecha: string): string {
    const d = new Date(fecha + 'T12:00:00');
    if (isToday(d)) return 'Hoy';
    if (isYesterday(d)) return 'Ayer';
    return format(d, "EEEE d 'de' MMMM", { locale: es });
}

export default function HistorialEntregas() {
    const { data: items = [], isFetching } = useQuery({
        queryKey: ['historial-entregas'],
        queryFn: async () => {
            const todos = await bdLocal.pedidos.toArray();
            const lista: EntregaItem[] = [];

            for (const pedido of todos) {
                for (const item of pedido.items ?? []) {
                    if (!vaACocina(item.categoria)) continue;
                    if (item.estado_item !== 'entregado') continue;

                    lista.push({
                        pedidoId: pedido.id,
                        numeroFicha: pedido.numero_ficha,
                        numeroLetrero: pedido.numero_letrero ?? '?',
                        nombre: item.nombre_item,
                        cantidad: item.cantidad,
                        categoria: item.categoria ?? '—',
                        entregado_en: pedido.actualizado_en ?? pedido.creado_en,
                    });
                }
            }

            return lista.sort((a, b) =>
                new Date(b.entregado_en).getTime() - new Date(a.entregado_en).getTime()
            );
        },
        refetchInterval: 10000,
    });

    const grupos = agruparPorDia(items);

    return (
        <div className="p-4 max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-serif flex items-center gap-2">
                    <PackageCheck className="w-6 h-6 text-green-600" />
                    Historial de Entregas
                    {isFetching && (
                        <span className="text-xs text-muted-foreground font-normal animate-pulse">actualizando...</span>
                    )}
                </h2>
                <Badge variant="secondary">{items.length} platos entregados</Badge>
            </div>

            <p className="text-sm text-muted-foreground">
                Registro de todos los platos de cocina (<strong>Plato Fuerte y Caldos</strong>) que el mesero marcó como entregados al cliente.
            </p>

            {/* Sin datos */}
            {grupos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                    <ChefHat className="w-16 h-16 mb-4 text-slate-300" />
                    <p className="text-lg font-medium">Sin entregas registradas</p>
                    <p className="text-sm text-muted-foreground">Cuando el mesero marque un plato como entregado aparecerá aquí</p>
                </div>
            )}

            {/* Grupos por día */}
            {grupos.map(([fecha, listaItems]) => (
                <div key={fecha}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 capitalize">
                        {etiquetaDia(fecha)}
                        <span className="ml-2 font-normal normal-case">({listaItems.length} platos)</span>
                    </h3>

                    <div className="space-y-2">
                        {listaItems.map((item, idx) => (
                            <Card key={`${item.pedidoId}-${idx}`} className="border-l-4 border-green-400">
                                <CardContent className="p-3 flex items-center gap-4">
                                    {/* Letrero */}
                                    <div className="bg-slate-800 text-white rounded-lg w-10 h-10 flex items-center justify-center font-black text-lg shrink-0">
                                        {item.numeroLetrero}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm">{item.cantidad}× {item.nombre}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Badge variant="outline" className="text-xs">{item.categoria}</Badge>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {format(new Date(item.entregado_en), 'HH:mm')}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                Ficha #{item.numeroFicha}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Estado */}
                                    <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                                        <PackageCheck className="w-4 h-4" /> Entregado
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
