import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, ElementoMenu, Pedido } from '@/lib/bd/bd-local';
import { TarjetaMenu } from './TarjetaMenu';
import { CarritoPedido, ItemCarrito } from './CarritoPedido';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Search, ChevronLeft, BookOpen, Plus, Check, ChefHat } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/componentes/ui/dialog';
import { ModalSeleccionItem } from './ModalSeleccionItem';
import SelectorFichas from './SelectorFichas';
import { Badge } from '@/componentes/ui/badge';
import { Card, CardContent } from '@/componentes/ui/card';

interface Props {
    onVolver: () => void;
    pedidoExistente?: Pedido | null;
}

export default function NavegadorMenu({ onVolver, pedidoExistente }: Props) {
    const queryClient = useQueryClient();
    const [categoriaActiva, setCategoriaActiva] = useState<string>("Todos");
    const [busqueda, setBusqueda] = useState("");

    // CAMBIO CLAVE: Solo items NUEVOS van al carrito
    // Los items existentes NO se cargan al carrito
    const [itemsNuevos, setItemsNuevos] = useState<ItemCarrito[]>([]);

    const [notaCliente, setNotaCliente] = useState(pedidoExistente?.notas || "");
    const [procesando, setProcesando] = useState(false);

    // Estados para el nuevo flujo
    const [mostrarMenu, setMostrarMenu] = useState(false);
    const [itemSeleccionado, setItemSeleccionado] = useState<ElementoMenu | null>(null);

    // Estado para confirmar letrero (RESTAURADO)
    const [mostrarModalLetrero, setMostrarModalLetrero] = useState(false);
    const [numeroLetrero, setNumeroLetrero] = useState(pedidoExistente?.numero_letrero || "");

    // Cargar menú desde Dexie
    const { data: menu = [] } = useQuery({
        queryKey: ['menu'],
        queryFn: () => bdLocal.elementosMenu.where('disponible').equals(1).toArray()
    });

    // Extraer categorías únicas
    const categorias = useMemo(() => {
        const cats = new Set(menu.map(i => i.categoria));
        return ["Todos", ...Array.from(cats)];
    }, [menu]);

    // Filtrar items
    const itemsFiltrados = useMemo(() => {
        return menu.filter(item => {
            const matchCat = categoriaActiva === "Todos" || item.categoria === categoriaActiva;
            const matchSearch = item.nombre.toLowerCase().includes(busqueda.toLowerCase());
            return matchCat && matchSearch;
        });
    }, [menu, categoriaActiva, busqueda]);

    const agregarAlCarrito = (cantidad: number) => {
        if (!itemSeleccionado) return;

        setItemsNuevos(prev => {
            const existente = prev.find(i => i.id_elemento_menu === itemSeleccionado.id);
            if (existente) {
                return prev.map(i => i.id_elemento_menu === itemSeleccionado.id
                    ? { ...i, cantidad: i.cantidad + cantidad }
                    : i
                );
            }
            return [...prev, {
                id_elemento_menu: itemSeleccionado.id,
                nombre: itemSeleccionado.nombre,
                precio: itemSeleccionado.precio_actual,
                cantidad: cantidad,
                categoria: itemSeleccionado.categoria
            }];
        });

        setItemSeleccionado(null);
    };

    const actualizarCantidad = (id: string, delta: number) => {
        setItemsNuevos(prev => prev.map(item => {
            if (item.id_elemento_menu === id) {
                return { ...item, cantidad: Math.max(0, item.cantidad + delta) };
            }
            return item;
        }).filter(i => i.cantidad > 0));
    };

    const solicitarLetrero = () => {
        if (!pedidoExistente && itemsNuevos.length === 0) return;
        if (pedidoExistente && itemsNuevos.length === 0) {
            alert("No hay items nuevos para agregar");
            return;
        }
        setMostrarModalLetrero(true);
    };

    const confirmarPedidoFinal = async () => {
        if (!numeroLetrero) {
            alert("Debes seleccionar un número de letrero de la lista.");
            return;
        }

        setProcesando(true);

        try {
            // Validar si el letrero ya está ocupado por OTRO pedido antes de guardar
            if (!pedidoExistente) {
                const ocupado = await bdLocal.pedidos
                    .filter(p =>
                        p.numero_letrero === numeroLetrero &&
                        p.estado !== 'pagado' &&
                        p.estado !== 'cancelado'
                    ).first();

                if (ocupado) {
                    alert(`⚠️ El letrero ${numeroLetrero} ya está ocupado por la Ficha #${ocupado.numero_ficha}. Por favor selecciona otro.`);
                    setProcesando(false);
                    return;
                }
            }
            const itemsNuevosBD = itemsNuevos.map(i => ({
                id_elemento_menu: i.id_elemento_menu,
                nombre_item: i.nombre,
                cantidad: i.cantidad,
                precio_unitario: i.precio,
                subtotal: i.precio * i.cantidad,
                categoria: i.categoria,
                estado_item: 'pendiente' as const  // Todos los nuevos empiezan como pendiente
            }));

            const totalNuevos = itemsNuevos.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);

            // Variable para el alert final
            let siguienteNumeroFicha = 0;

            if (pedidoExistente) {
                // CONCATENAR items nuevos a los existentes
                const todosLosItems = [...(pedidoExistente.items || []), ...itemsNuevosBD];
                const nuevoTotal = pedidoExistente.total + totalNuevos;

                await bdLocal.pedidos.update(pedidoExistente.id, {
                    items: todosLosItems,
                    total: nuevoTotal,
                    subtotal: nuevoTotal,
                    numero_letrero: numeroLetrero, // Permitir actualizar letrero si cambia
                    notas: notaCliente,
                    actualizado_en: new Date().toISOString(),
                    sincronizado: false
                });
            } else {
                // Obtener siguiente número de ficha secuencial
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);

                const pedidosHoy = await bdLocal.pedidos
                    .where('creado_en')
                    .above(hoy.toISOString())
                    .toArray();

                siguienteNumeroFicha = pedidosHoy.length + 1;

                // Crear Nuevo Pedido
                const nuevoPedido: Pedido = {
                    id: uuidv4(),
                    id_restaurante: 'demo-tenant',
                    id_mesero: 'usuario-actual',
                    id_mesa: 'ficha',
                    numero_ficha: siguienteNumeroFicha, // Auto-incremento diario
                    numero_letrero: numeroLetrero, // Letrero seleccionado manualmente
                    numero_pedido: `ORD-${Date.now().toString().slice(-4)}`,
                    estado: 'pendiente',
                    tipo_pedido: 'mesa',
                    subtotal: totalNuevos,
                    impuesto: 0,
                    total: totalNuevos,
                    items: itemsNuevosBD,
                    notas: notaCliente,
                    creado_en: new Date().toISOString(),
                    actualizado_en: new Date().toISOString(),
                    version: 1,
                    sincronizado: false
                };

                await bdLocal.pedidos.add(nuevoPedido);

                // Sincronización (cola)
                await bdLocal.colaSincronizacion.add({
                    id: uuidv4(),
                    id_restaurante: nuevoPedido.id_restaurante,
                    tipo_entidad: 'pedido',
                    id_entidad: nuevoPedido.id,
                    operacion: 'crear',
                    carga_util: nuevoPedido,
                    timestamp_cliente: new Date().toISOString(),
                    procesado: false,
                    conteo_reintentos: 0
                });
            }

            // Invalidar queries
            await queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            await queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });

            alert(`✅ Pedido ${pedidoExistente ? 'Actualizado' : 'Creado'} - Ficha #${pedidoExistente ? pedidoExistente.numero_ficha : siguienteNumeroFicha} - Letrero ${numeroLetrero}`);
            setItemsNuevos([]);
            setNotaCliente("");
            if (onVolver) onVolver();
        } catch (e) {
            console.error(e);
            alert("Error al guardar pedido");
        } finally {
            setProcesando(false);
        }
    };

    const getEstadoBadgeColor = (estado?: string) => {
        switch (estado) {
            case 'pendiente': return 'default';
            case 'en_proceso': return 'secondary';
            case 'listo': return 'success';
            default: return 'outline';
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-4">

            {/* Header / Barra Superior */}
            <div className="flex items-center justify-between shrink-0 bg-white p-2 rounded-lg shadow-sm border">
                <div className="flex items-center gap-2">
                    {onVolver && (
                        <Button variant="ghost" size="icon" onClick={onVolver}>
                            <ChevronLeft className="w-6 h-6" />
                        </Button>
                    )}
                    <div>
                        <h2 className="text-lg font-bold leading-none">
                            {pedidoExistente ? `Ficha #${pedidoExistente.numero_ficha} - Agregar Items` : 'Nueva Orden'}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            {pedidoExistente
                                ? `${itemsNuevos.length} items nuevos`
                                : itemsNuevos.length === 0 ? 'Sin items' : `${itemsNuevos.reduce((acc, i) => acc + i.cantidad, 0)} items`
                            }
                        </span>
                    </div>
                </div>

                <Button onClick={() => setMostrarMenu(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <BookOpen className="w-4 h-4" />
                    Abrir Menú
                </Button>
            </div>

            {/* Vista Principal */}
            <div className="flex-1 overflow-y-auto bg-slate-50 rounded-lg border p-4 space-y-4">

                {/* Sección 1: Items EXISTENTES (Solo si estamos editando) */}
                {pedidoExistente && pedidoExistente.items && pedidoExistente.items.length > 0 && (
                    <Card>
                        <CardContent className="p-4">
                            <h3 className="font-bold text-sm uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                <ChefHat className="w-4 h-4" />
                                Pedido Actual (Ficha #{pedidoExistente.numero_ficha})
                            </h3>
                            <div className="space-y-2">
                                {pedidoExistente.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-slate-100 rounded">
                                        <div className="flex-1">
                                            <span className="font-medium">{item.cantidad}x {item.nombre_item}</span>
                                            <Badge variant={getEstadoBadgeColor(item.estado_item)} className="ml-2 text-xs">
                                                {item.estado_item || 'pendiente'}
                                            </Badge>
                                        </div>
                                        <span className="font-mono text-sm">${item.subtotal.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-3 border-t flex justify-between font-bold">
                                <span>Total Actual:</span>
                                <span className="text-green-700">${pedidoExistente.total.toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Sección 2: Items NUEVOS (Carrito Temporal) */}
                {itemsNuevos.length === 0 ? (
                    <div className="text-center opacity-50 flex flex-col items-center py-10">
                        <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                            <BookOpen className="w-10 h-10 text-slate-400" />
                        </div>
                        <p className="text-xl font-bold">
                            {pedidoExistente ? 'Agregar más items' : 'El pedido está vacío'}
                        </p>
                        <p className="mb-6">Abre el menú para agregar platos y bebidas</p>
                        <Button size="lg" onClick={() => setMostrarMenu(true)} className="gap-2">
                            <Plus className="w-5 h-5" /> Agregar Items
                        </Button>
                    </div>
                ) : (
                    <div className="w-full max-w-3xl mx-auto">
                        <h3 className="font-bold text-sm uppercase text-muted-foreground mb-3">
                            {pedidoExistente ? 'Items a Agregar' : 'Nuevo Pedido'}
                        </h3>
                        <CarritoPedido
                            items={itemsNuevos}
                            onUpdateQuantity={actualizarCantidad}
                            onSubmit={solicitarLetrero}
                            procesando={procesando}
                            notaCliente={notaCliente}
                            onNotaChange={setNotaCliente}
                        />
                    </div>
                )}
            </div>

            {/* Modal: Menú Completo */}
            <Dialog open={mostrarMenu} onOpenChange={setMostrarMenu}>
                <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
                    <div className="p-4 border-b flex flex-col gap-4 bg-white z-10">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <BookOpen className="w-5 h-5" /> Menú
                            </h2>
                            <Button variant="ghost" size="sm" onClick={() => setMostrarMenu(false)}>
                                Cerrar
                            </Button>
                        </div>

                        {/* Filtros */}
                        <div className="flex gap-2 items-center overflow-x-auto pb-2 shrink-0 no-scrollbar">
                            {categorias.map(cat => (
                                <Button
                                    key={cat}
                                    variant={categoriaActiva === cat ? "default" : "outline"}
                                    onClick={() => setCategoriaActiva(cat)}
                                    className="whitespace-nowrap rounded-full px-6"
                                    size="sm"
                                >
                                    {cat}
                                </Button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar..."
                                className="pl-9 rounded-full bg-slate-100 border-none"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {itemsFiltrados.length === 0 ? (
                                <div className="col-span-full text-center py-20 opacity-50">
                                    Sin resultados
                                </div>
                            ) : (
                                itemsFiltrados.map(item => (
                                    <TarjetaMenu
                                        key={item.id}
                                        item={item}
                                        onAdd={() => setItemSeleccionado(item)}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="p-4 border-t bg-white flex justify-between items-center">
                        <span className="font-bold">
                            {itemsNuevos.reduce((acc, i) => acc + i.cantidad, 0)} items nuevos
                        </span>
                        <Button onClick={() => setMostrarMenu(false)}>
                            Ver Pedido
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: Selección de Cantidad */}
            <ModalSeleccionItem
                open={!!itemSeleccionado}
                onOpenChange={(open) => !open && setItemSeleccionado(null)}
                item={itemSeleccionado}
                onConfirmar={agregarAlCarrito}
            />

            {/* Modal Asignar/Confirmar Letrero (RESTAURADO) */}
            <Dialog open={mostrarModalLetrero} onOpenChange={setMostrarModalLetrero}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            {pedidoExistente ? 'Confirmar Items' : 'Seleccionar Letrero de Mesa'}
                        </DialogTitle>
                        <DialogDescription>
                            {pedidoExistente
                                ? `Agregar ${itemsNuevos.length} items nuevos a la Ficha #${pedidoExistente.numero_ficha}`
                                : 'Selecciona un letrero disponible (los marcados en gris están ocupados)'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <SelectorFichas
                        onSelect={setNumeroLetrero}
                        fichaActual={numeroLetrero}
                    />

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMostrarModalLetrero(false)}>Cancelar</Button>
                        <Button
                            onClick={confirmarPedidoFinal}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={!numeroLetrero || procesando}
                        >
                            <Check className="mr-2 h-4 w-4" />
                            {procesando ? 'Guardando...' : pedidoExistente ? 'Agregar Items' : 'Confirmar Pedido'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
