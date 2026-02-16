import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bdLocal, ElementoMenu, Mesa } from '@/lib/bd/bd-local';
import { TarjetaMenu } from './TarjetaMenu';
import { CarritoPedido, ItemCarrito } from './CarritoPedido';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Search, ChevronLeft, BookOpen, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent } from '@/componentes/ui/dialog';
import { ModalSeleccionItem } from './ModalSeleccionItem';

interface Props {
    mesaSeleccionada?: Mesa | null;
    onVolver?: () => void;
}

export default function NavegadorMenu({ mesaSeleccionada, onVolver }: Props) {
    const [categoriaActiva, setCategoriaActiva] = useState<string>("Todos");
    const [busqueda, setBusqueda] = useState("");
    const [itemsCarrito, setItemsCarrito] = useState<ItemCarrito[]>([]);
    const [notaCliente, setNotaCliente] = useState("");
    const [procesando, setProcesando] = useState(false);

    // Estados para el nuevo flujo
    const [mostrarMenu, setMostrarMenu] = useState(false);
    const [itemSeleccionado, setItemSeleccionado] = useState<ElementoMenu | null>(null);

    // Cargar menú desde Dexie
    const { data: menu = [] } = useQuery({
        queryKey: ['menu'],
        queryFn: () => bdLocal.elementosMenu.toArray()
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

        setItemsCarrito(prev => {
            const existente = prev.find(i => i.id_elemento_menu === itemSeleccionado.id);
            if (existente) {
                return prev.map(i => i.id_elemento_menu === itemSeleccionado.id
                    ? { ...i, cantidad: i.cantidad + cantidad } // Sumar cantidad
                    : i
                );
            }
            return [...prev, {
                id_elemento_menu: itemSeleccionado.id,
                nombre: itemSeleccionado.nombre,
                precio: itemSeleccionado.precio_actual,
                cantidad: cantidad
            }];
        });

        setItemSeleccionado(null);
        // No cerramos el menú para seguir pidiendo
    };

    const actualizarCantidad = (id: string, delta: number) => {
        setItemsCarrito(prev => prev.map(item => {
            if (item.id_elemento_menu === id) {
                return { ...item, cantidad: Math.max(0, item.cantidad + delta) };
            }
            return item;
        }).filter(i => i.cantidad > 0));
    };

    const confirmarPedido = async () => {
        if (itemsCarrito.length === 0) return;
        setProcesando(true);

        try {
            const nuevoPedido = {
                id: uuidv4(),
                id_restaurante: 'demo-tenant',
                id_mesero: 'usuario-actual',
                id_mesa: mesaSeleccionada?.id || 'sin-mesa',
                numero_pedido: `ORD-${Date.now().toString().slice(-4)}`,
                estado: 'pendiente' as const,
                tipo_pedido: 'mesa' as const,
                subtotal: itemsCarrito.reduce((acc, i) => acc + (i.precio * i.cantidad), 0),
                impuesto: 0,
                total: itemsCarrito.reduce((acc, i) => acc + (i.precio * i.cantidad), 0),
                items: itemsCarrito.map(i => ({
                    id_elemento_menu: i.id_elemento_menu,
                    nombre_item: i.nombre,
                    cantidad: i.cantidad,
                    precio_unitario: i.precio,
                    subtotal: i.precio * i.cantidad
                })),
                notas: notaCliente,
                creado_en: new Date().toISOString(),
                actualizado_en: new Date().toISOString(),
                version: 1,
                sincronizado: false
            };

            await bdLocal.pedidos.add(nuevoPedido);

            if (mesaSeleccionada && mesaSeleccionada.estado === 'disponible') {
                await bdLocal.mesas.update(mesaSeleccionada.id, { estado: 'ocupada' });
            }

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

            alert(`✅ Pedido Enviado a Cocina`);
            setItemsCarrito([]);
            setNotaCliente("");
            if (onVolver) onVolver();
        } catch (e) {
            console.error(e);
            alert("Error al crear pedido");
        } finally {
            setProcesando(false);
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
                            {mesaSeleccionada ? `Mesa ${mesaSeleccionada.numero}` : 'Nuevo Pedido'}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            {itemsCarrito.length === 0 ? 'Sin items' : `${itemsCarrito.reduce((acc, i) => acc + i.cantidad, 0)} items`}
                        </span>
                    </div>
                </div>

                <Button onClick={() => setMostrarMenu(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <BookOpen className="w-4 h-4" />
                    Abrir Menú
                </Button>
            </div>

            {/* Vista Principal: Lista de Pedido (Carrito) */}
            <div className="flex-1 overflow-hidden bg-slate-50 rounded-lg border flex flex-col items-center justify-center">
                {itemsCarrito.length === 0 ? (
                    <div className="text-center opacity-50 flex flex-col items-center">
                        <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                            <BookOpen className="w-10 h-10 text-slate-400" />
                        </div>
                        <p className="text-xl font-bold">El pedido está vacío</p>
                        <p className="mb-6">Abre el menú para agregar platos y bebidas</p>
                        <Button size="lg" onClick={() => setMostrarMenu(true)} className="gap-2">
                            <Plus className="w-5 h-5" /> Agregar Items
                        </Button>
                    </div>
                ) : (
                    <div className="w-full h-full max-w-3xl mx-auto p-4 flex flex-col">
                        <CarritoPedido
                            items={itemsCarrito}
                            onUpdateQuantity={actualizarCantidad}
                            onSubmit={confirmarPedido}
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
                                        onAdd={() => setItemSeleccionado(item)} // Abre el modal de cantidad
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="p-4 border-t bg-white flex justify-between items-center">
                        <span className="font-bold">
                            {itemsCarrito.reduce((acc, i) => acc + i.cantidad, 0)} items en pedido
                        </span>
                        <Button onClick={() => setMostrarMenu(false)}>
                            Ver Pedido Actual
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

        </div>
    );
}
