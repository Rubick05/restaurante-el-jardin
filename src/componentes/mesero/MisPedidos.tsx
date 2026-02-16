import { useQuery } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { Card, CardContent, CardHeader, CardTitle } from '@/componentes/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/componentes/ui/dialog";
import { Button } from "@/componentes/ui/button";
import { Clock, CheckCircle2, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function MisPedidos() {
    const { data: pedidos = [] } = useQuery({
        queryKey: ['mis-pedidos'],
        queryFn: async () => {
            // En una app real filtraríamos por id_mesero
            return await bdLocal.pedidos
                .orderBy('creado_en')
                .reverse()
                .toArray();
        },
        refetchInterval: 5000
    });

    const tryFormatDate = (dateStr: string) => {
        try {
            return formatDistanceToNow(new Date(dateStr), { locale: es, addSuffix: true });
        } catch {
            return "hace un momento";
        }
    };

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold">Mis Pedidos Activos</h2>

            {pedidos.length === 0 ? (
                <div className="text-center p-10 text-muted-foreground border-2 border-dashed rounded-xl">
                    No tienes pedidos registrados hoy.
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {pedidos.map(p => (
                        <Card key={p.id} className={p.estado === 'entregado' ? 'opacity-60 bg-slate-50' : ''}>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex justify-between items-center text-base">
                                    <span>Mesa {p.id_mesa.replace('mesa-', '')}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.estado === 'pendiente' ? 'bg-slate-200 text-slate-800' :
                                        p.estado === 'en_proceso' ? 'bg-blue-100 text-blue-800' :
                                            p.estado === 'listo' ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                                        }`}>
                                        {p.estado.toUpperCase().replace('_', ' ')}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold mb-2">${p.total.toFixed(2)}</div>

                                {p.notas && (
                                    <div className="mb-2 text-sm bg-yellow-50 p-2 rounded text-yellow-800 border-l-2 border-yellow-400">
                                        <span className="font-bold">Nota:</span> {p.notas}
                                    </div>
                                )}

                                <div className="flex items-center text-xs text-muted-foreground gap-4 mb-3">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {tryFormatDate(p.creado_en)}
                                    </span>
                                    <span className="font-mono">#{p.numero_pedido}</span>
                                </div>

                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="w-full">
                                            <Eye className="w-4 h-4 mr-2" /> Ver Detalle Completo
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Pedido #{p.numero_pedido}</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div className="flex justify-between border-b pb-2">
                                                <span className="text-muted-foreground">Estado:</span>
                                                <span className="font-bold">{p.estado.toUpperCase()}</span>
                                            </div>
                                            {p.notas && (
                                                <div className="bg-slate-100 p-3 rounded-md">
                                                    <p className="text-sm font-bold text-muted-foreground">Notas del Cliente:</p>
                                                    <p>{p.notas}</p>
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="font-bold mb-2">Items:</h4>
                                                <ul className="space-y-2">
                                                    {p.items?.map((item, idx) => (
                                                        <li key={idx} className="flex justify-between text-sm">
                                                            <span>{item.cantidad}x {item.nombre_item}</span>
                                                            <span className="font-mono">${(item.cantidad * item.precio_unitario).toFixed(2)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="flex justify-between border-t pt-4 text-xl font-bold">
                                                <span>Total</span>
                                                <span>${p.total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
