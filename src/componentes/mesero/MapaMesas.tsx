import { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { bdLocal, Mesa, Pedido } from '@/lib/bd/bd-local';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utilidades/cn';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/componentes/ui/dialog";
import { Button } from "@/componentes/ui/button";
import { Badge } from "@/componentes/ui/badge";
import { ModalPago } from './ModalPago';

interface MapaMesasProps {
    onMesaSelect?: (mesa: Mesa) => void;
    onNavegarPedido?: () => void;
}

export default function MapaMesas({ onMesaSelect, onNavegarPedido }: MapaMesasProps) {
    const queryClient = useQueryClient();
    const [mesaDetalle, setMesaDetalle] = useState<Mesa | null>(null);
    const [pedidosMesa, setPedidosMesa] = useState<Pedido[]>([]);
    const [showModalPago, setShowModalPago] = useState(false);

    // Datos de prueba iniciales si la BD está vacía
    useEffect(() => {
        const initMesas = async () => {
            const count = await bdLocal.mesas.count();
            if (count === 0) {
                await bdLocal.mesas.bulkAdd([
                    { id: '1', id_restaurante: 'demo', numero: '1', zona: 'Principal', capacidad: 4, estado: 'disponible', posX: 0, posY: 0 },
                    { id: '2', id_restaurante: 'demo', numero: '2', zona: 'Principal', capacidad: 2, estado: 'ocupada', posX: 1, posY: 0 },
                    { id: '3', id_restaurante: 'demo', numero: '3', zona: 'Principal', capacidad: 4, estado: 'atencion', posX: 0, posY: 1 },
                    { id: '4', id_restaurante: 'demo', numero: '4', zona: 'Terraza', capacidad: 6, estado: 'disponible', posX: 1, posY: 1 },
                    { id: '5', id_restaurante: 'demo', numero: '5', zona: 'Terraza', capacidad: 2, estado: 'limpieza', posX: 2, posY: 1 },
                ]);
            }
        };
        initMesas();
    }, []);

    const { data: mesas } = useQuery({
        queryKey: ['mesas'],
        queryFn: () => bdLocal.mesas.toArray()
    });

    const getStatusColor = (estado: Mesa['estado']) => {
        switch (estado) {
            case 'disponible': return 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200';
            case 'ocupada': return 'bg-red-100 border-red-300 text-red-800 hover:bg-red-200';
            case 'atencion': return 'bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200 animate-pulse';
            case 'limpieza': return 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200';
            default: return 'bg-gray-100 border-gray-300 text-gray-800';
        }
    };

    const handleMesaClick = async (mesa: Mesa) => {
        if (mesa.estado === 'disponible') {
            // Si está libre, seleccionarla e ir a pedir
            if (onMesaSelect) onMesaSelect(mesa);
            if (onNavegarPedido) onNavegarPedido();
        } else {
            // Si está ocupada, mostrar detalle
            setMesaDetalle(mesa);
            const pedidos = await bdLocal.pedidos
                .where('id_mesa').equals(mesa.id)
                .and(p => ['pendiente', 'en_proceso', 'listo', 'entregado'].includes(p.estado))
                .toArray();
            setPedidosMesa(pedidos);
        }
    };

    const handleAgregarItems = () => {
        if (mesaDetalle && onMesaSelect && onNavegarPedido) {
            onMesaSelect(mesaDetalle);
            onNavegarPedido();
            setMesaDetalle(null);
        }
    };

    const handleCobrar = () => {
        setShowModalPago(true);
        // No cerramos mesaDetalle aún
    };

    const finalizarPago = async (metodo: 'efectivo' | 'qr') => {
        if (!mesaDetalle) return;

        // 1. Marcar pedidos como pagados
        const idsPedidos = pedidosMesa.map(p => p.id);
        await bdLocal.pedidos.bulkUpdate(idsPedidos.map(id => ({ key: id, changes: { estado: 'pagado' } })));

        // 2. Liberar mesa (o poner en limpieza)
        await bdLocal.mesas.update(mesaDetalle.id, { estado: 'limpieza' });

        alert(`Cobro realizado con ${metodo}. Mesa liberada.`);

        setShowModalPago(false);
        setMesaDetalle(null);
        queryClient.invalidateQueries({ queryKey: ['mesas'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });
    };

    const totalMesa = pedidosMesa.reduce((acc, p) => acc + p.total, 0);

    // Simplificación para el modal de pago que espera ItemCarrito[]
    // Convertimos los pedidos a un items plano para visualizar en el ticket
    const itemsResumen = pedidosMesa.flatMap(p => p.items || []).map(i => ({
        id_elemento_menu: i.id_elemento_menu,
        nombre: i.nombre_item,
        precio: i.precio_unitario,
        cantidad: i.cantidad
    }));

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
            {mesas?.map((mesa) => (
                <Card
                    key={mesa.id}
                    className={cn(
                        "cursor-pointer transition-all active:scale-95 border-2",
                        getStatusColor(mesa.estado)
                    )}
                    onClick={() => handleMesaClick(mesa)}
                >
                    <CardContent className="p-6 flex flex-col items-center justify-center min-h-[120px]">
                        <span className="text-3xl font-bold mb-2">{mesa.numero}</span>
                        <span className="text-xs uppercase tracking-wider font-semibold opacity-70">{mesa.zona}</span>
                        <div className="mt-2 flex items-center text-xs opacity-60">
                            👤 {mesa.capacidad}
                        </div>
                        <div className="mt-2 text-xs font-bold uppercase">
                            {mesa.estado}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Dialogo Detalle Mesa */}
            <Dialog open={!!mesaDetalle} onOpenChange={(open) => !open && setMesaDetalle(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Mesa {mesaDetalle?.numero} - {mesaDetalle?.zona}</DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                        {pedidosMesa.length === 0 ? (
                            <p className="text-center text-muted-foreground">No hay pedidos activos</p>
                        ) : (
                            <div className="space-y-4">
                                {pedidosMesa.map((pedido) => (
                                    <div key={pedido.id} className="bg-slate-50 p-3 rounded-lg border text-sm">
                                        <div className="flex justify-between font-bold mb-2">
                                            <span>Orden #{pedido.numero_pedido}</span>
                                            <Badge variant={pedido.estado === 'listo' ? 'default' : 'outline'}>
                                                {pedido.estado}
                                            </Badge>
                                        </div>
                                        <ul className="space-y-1 text-slate-600">
                                            {pedido.items?.map((item, idx) => (
                                                <li key={idx} className="flex justify-between">
                                                    <span>{item.cantidad} x {item.nombre_item}</span>
                                                    <span>${(item.precio_unitario * item.cantidad).toFixed(2)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t font-bold text-xl">
                            <span>Total Mesa</span>
                            <span>${totalMesa.toFixed(2)}</span>
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="secondary" onClick={handleAgregarItems} className="w-full">
                            ➕ Agregar Items
                        </Button>
                        <Button onClick={handleCobrar} className="w-full bg-green-600 hover:bg-green-700" disabled={totalMesa === 0}>
                            💵 Cobrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Pago */}
            <ModalPago
                open={showModalPago}
                onOpenChange={setShowModalPago}
                items={itemsResumen}
                total={totalMesa}
                onConfirmarPago={finalizarPago}
                procesando={false}
            />
        </div>
    );
}
