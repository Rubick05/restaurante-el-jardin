import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, ElementoMenu, Pedido } from '@/lib/bd/bd-local';
import { API_BASE_URL, normalizarMenu, normalizarPedidos } from '@/hooks/useInicializacion';
import { useAuth } from '@/lib/auth/contexto-auth';
import { TarjetaMenu } from './TarjetaMenu';
import { CarritoPedido, ItemCarrito } from './CarritoPedido';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Search, ChevronLeft, BookOpen, Plus, Check, ChefHat, PackageCheck } from 'lucide-react';
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
    const { usuarioActual } = useAuth();
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

    // Recargar el pedido en tiempo real desde la BD (para ver estados actualizados de items)
    const { data: pedidoActual } = useQuery({
        queryKey: ['pedido-detalle', pedidoExistente?.id],
        queryFn: async () => {
            if (!pedidoExistente?.id) return null;
            return bdLocal.pedidos.get(pedidoExistente.id) ?? null;
        },
        enabled: !!pedidoExistente?.id,
        refetchInterval: 2000, // Polling cada 2s para ver cambios de cocina
    });

    // Usar la version live si existe, sino la prop original
    const pedidoVivo = pedidoActual ?? pedidoExistente;

    // Cargar menú: del servidor (con imágenes) → IndexedDB como fallback
    const { data: menu = [] } = useQuery({
        queryKey: ['menu'],
        queryFn: async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/menu`);
                if (res.ok) {
                    const itemsServidor = normalizarMenu(await res.json()) as ElementoMenu[];
                    await bdLocal.elementosMenu.bulkPut(itemsServidor);
                    return itemsServidor.filter((i: ElementoMenu) => i.disponible);
                }
            } catch {
                // Sin red: usar IndexedDB local
            }
            return bdLocal.elementosMenu.where('disponible').equals(1).toArray();
        },
        staleTime: 30_000,
    });

    // Solo estas 4 categorías son válidas — se filtra cualquier otra (días de la semana, etc.)
    const ORDEN_CATEGORIAS = ['Plato Fuerte', 'Caldos', 'Refrescos', 'Cervezas'];
    const categorias = useMemo(() => {
        // Solo mostrar categorías que estén en la lista válida
        const cats = ORDEN_CATEGORIAS.filter((cat: string) =>
            menu.some((i: ElementoMenu) => i.categoria === cat)
        );
        return ["Todos", ...cats];
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

    /**
     * El mesero marca un plato como ENTREGADO al cliente.
     * Esto lo elimina de la columna "Listo para Entregar" de la cocina.
     */
    const entregarItem = async (itemIndex: number) => {
        if (!pedidoVivo || !pedidoVivo.items) return;

        const itemsActualizados = pedidoVivo.items.map((it, idx) =>
            idx === itemIndex
                ? { ...it, estado_item: 'entregado' as const }
                : it
        );

        // Si todos los items de cocina están entregados, el pedido pasa a 'entregado'
        // (sigue visible en el tablero del mesero para ser cobrado)
        const itemsCocina = itemsActualizados.filter(it => {
            const cat = (it.categoria || '').toLowerCase();
            return !cat.includes('bebida') && !cat.includes('cerveza') && !cat.includes('refresco');
        });
        const todosEntregados = itemsCocina.every(
            it => (it.estado_item as string) === 'entregado'
        );

        await bdLocal.pedidos.update(pedidoVivo.id, {
            items: itemsActualizados,
            // 'entregado' = platos servidos, pendiente de cobro
            estado: todosEntregados ? 'entregado' : pedidoVivo.estado,
            actualizado_en: new Date().toISOString(),
            sincronizado: false,
        });

        queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
        queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
        queryClient.invalidateQueries({ queryKey: ['pedido-detalle', pedidoVivo.id] });
    };

    /** Determina si un item requiere preparación en cocina.
     * Plato Fuerte y Caldos van a cocina. Refrescos y Cervezas no. */
    const esPlatoCocina = (categoria?: string): boolean => {
        if (!categoria) return true; // Sin categoría → a cocina por defecto

        const CATEGORIAS_COCINA = ['Plato Fuerte', 'Caldos'];
        if (CATEGORIAS_COCINA.includes(categoria)) return true;

        const cat = categoria.toLowerCase().trim();
        return cat.includes('plato') || cat.includes('caldo') || cat.includes('fuerte');
    };

    const solicitarLetrero = () => {
        if (!pedidoExistente && itemsNuevos.length === 0) return;
        if (pedidoExistente && itemsNuevos.length === 0) {
            alert("No hay items nuevos para agregar");
            return;
        }
        if (pedidoExistente) {
            // Pedido existente: guardar directamente sin pedir letrero
            agregarItemsAPedidoExistente();
        } else {
            // Pedido nuevo: pedir letrero
            setMostrarModalLetrero(true);
        }
    };

    /** Agrega items a un pedido existente sin pedir letrero */
    const agregarItemsAPedidoExistente = async () => {
        if (!pedidoExistente) return;
        setProcesando(true);
        try {
            const itemsNuevosBD = itemsNuevos.map(i => ({
                id_elemento_menu: i.id_elemento_menu,
                nombre_item: i.nombre,
                cantidad: i.cantidad,
                precio_unitario: i.precio,
                subtotal: i.precio * i.cantidad,
                categoria: i.categoria,
                // Platos de cocina empiezan 'pendiente' (van al tablero de cocina)
                // Bebidas y otros empiezan 'entregado' (solo suman a cuenta)
                estado_item: esPlatoCocina(i.categoria)
                    ? ('pendiente' as const)
                    : ('entregado' as const),
            }));

            const totalNuevos = itemsNuevos.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
            const todosLosItems = [...(pedidoExistente.items || []), ...itemsNuevosBD];
            const nuevoTotal = pedidoExistente.total + totalNuevos;

            // Si hay platos de cocina nuevos, el pedido vuelve a 'en_proceso' o 'pendiente'
            const hayNuevosPlatoCocina = itemsNuevosBD.some(i => i.estado_item === 'pendiente');
            const estadoActual = pedidoExistente.estado;
            const nuevoEstado = hayNuevosPlatoCocina && (estadoActual === 'entregado' || estadoActual === 'listo')
                ? 'en_proceso'
                : estadoActual;

            await bdLocal.pedidos.update(pedidoExistente.id, {
                items: todosLosItems,
                total: nuevoTotal,
                subtotal: nuevoTotal,
                notas: notaCliente,
                estado: nuevoEstado,
                actualizado_en: new Date().toISOString(),
                sincronizado: false
            });

            await queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            await queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
            await queryClient.invalidateQueries({ queryKey: ['pedido-detalle', pedidoExistente.id] });

            const platosACocina = itemsNuevosBD.filter(i => i.estado_item === 'pendiente').length;
            const itemsDirectos = itemsNuevosBD.filter(i => i.estado_item === 'entregado').length;
            let msg = `✅ Items agregados a Ficha #${pedidoExistente.numero_ficha}`;
            if (platosACocina > 0) msg += `\n👨‍🍳 ${platosACocina} plato(s) enviado(s) a cocina`;
            if (itemsDirectos > 0) msg += `\n💰 ${itemsDirectos} item(s) sumado(s) a la cuenta`;
            alert(msg);

            setItemsNuevos([]);
            setNotaCliente("");
            if (onVolver) onVolver();
        } catch (e) {
            console.error(e);
            alert("Error al agregar items");
        } finally {
            setProcesando(false);
        }
    };

    const confirmarPedidoFinal = async () => {
        if (!numeroLetrero) {
            alert("Debes seleccionar un número de letrero de la lista.");
            return;
        }

        setProcesando(true);

        try {
            // Validar si el letrero ya está ocupado por OTRO pedido antes de guardar
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

            const itemsNuevosBD = itemsNuevos.map(i => ({
                id_elemento_menu: i.id_elemento_menu,
                nombre_item: i.nombre,
                cantidad: i.cantidad,
                precio_unitario: i.precio,
                subtotal: i.precio * i.cantidad,
                categoria: i.categoria,
                estado_item: esPlatoCocina(i.categoria)
                    ? ('pendiente' as const)
                    : ('entregado' as const),
            }));

            const totalNuevos = itemsNuevos.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);

            // Obtener siguiente número de ficha secuencial
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const pedidosHoy = await bdLocal.pedidos
                .where('creado_en')
                .above(hoy.toISOString())
                .toArray();
            const siguienteNumeroFicha = pedidosHoy.length + 1;

            // Crear Nuevo Pedido
            const nuevoPedido: Pedido = {
                id: uuidv4(),
                id_restaurante: 'demo-tenant',
                id_mesero: usuarioActual?.id || 'sin-sesion',
                id_mesa: 'ficha',
                numero_ficha: siguienteNumeroFicha,
                numero_letrero: numeroLetrero,
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

            // ── Guardar pedido: SERVIDOR primero, IndexedDB como cache ──
            await bdLocal.pedidos.put(nuevoPedido); // cache local inmediato

            try {
                const res = await fetch(`${API_BASE_URL}/api/pedidos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nuevoPedido),
                });
                if (res.ok) {
                    const dataRes = await res.json();
                    const rawPedido = dataRes.pedido ?? dataRes;
                    const [pedidoGuardado] = normalizarPedidos([rawPedido]);

                    // Actualizar cache local con la versión normalizada
                    await bdLocal.pedidos.put(pedidoGuardado);
                    await bdLocal.pedidos.update(nuevoPedido.id, { sincronizado: true });
                }
            } catch {
                // Sin red — el pedido quedó en IndexedDB, se sincronizará después
                console.warn('Sin conexión al crear pedido — guardado solo local');
            }

            // Invalidar queries
            await queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            await queryClient.invalidateQueries({ queryKey: ['items-cocina'] });
            await queryClient.invalidateQueries({ queryKey: ['pedidos-dia'] });

            alert(`✅ Pedido Creado - Ficha #${siguienteNumeroFicha} - Letrero ${numeroLetrero}`);
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

    const getEstadoBadgeColor = (estado?: string): { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string } => {
        switch (estado) {
            case 'pendiente': return { variant: 'secondary' };
            case 'en_proceso': return { variant: 'default' };
            case 'listo': return { variant: 'default', className: 'bg-green-500 hover:bg-green-600 text-white' };
            case 'entregado': return { variant: 'outline', className: 'text-slate-400 line-through' };
            default: return { variant: 'outline' };
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
                            {pedidoVivo ? `Ficha #${pedidoVivo.numero_ficha} - Agregar Items` : 'Nueva Orden'}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            {pedidoVivo
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
                {pedidoVivo && pedidoVivo.items && pedidoVivo.items.length > 0 && (
                    <Card>
                        <CardContent className="p-4">
                            <h3 className="font-bold text-sm uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                <ChefHat className="w-4 h-4" />
                                Pedido Actual (Ficha #{pedidoVivo.numero_ficha})
                            </h3>
                            <div className="space-y-2">
                                {pedidoVivo.items.map((item, idx) => {
                                    const estaListo = item.estado_item === 'listo';
                                    const estaEntregado = (item.estado_item as string) === 'entregado';
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-2 p-2 rounded border ${estaListo
                                                ? 'bg-green-50 border-green-200 animate-pulse'
                                                : estaEntregado
                                                    ? 'bg-slate-50 border-slate-200 opacity-60'
                                                    : 'bg-slate-100 border-transparent'
                                                }`}
                                        >
                                            {/* Info del item */}
                                            <div className="flex-1 min-w-0">
                                                <span className={`font-medium text-sm ${estaEntregado ? 'line-through text-muted-foreground' : ''
                                                    }`}>
                                                    {item.cantidad}× {item.nombre_item}
                                                </span>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {(() => {
                                                        const { variant, className: badgeCls } = getEstadoBadgeColor(item.estado_item);
                                                        return (
                                                            <Badge variant={variant} className={`text-[10px] ${badgeCls ?? ''}`}>
                                                                {estaEntregado ? '✓ Entregado' : item.estado_item || 'pendiente'}
                                                            </Badge>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Precio */}
                                            <span className="font-mono text-sm text-slate-600">Bs {Number(item.subtotal).toFixed(2)}</span>

                                            {/* Botón Entregar — solo si está LISTO */}
                                            {estaListo && (
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs shrink-0"
                                                    onClick={() => entregarItem(idx)}
                                                    title="Marcar como entregado al cliente"
                                                >
                                                    <PackageCheck className="w-3.5 h-3.5 mr-1" />
                                                    Entregar
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-3 pt-3 border-t flex justify-between font-bold">
                                <span>Total Actual:</span>
                                <span className="text-green-700">Bs {Number(pedidoVivo.total).toFixed(2)}</span>
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
                            {pedidoVivo ? 'Agregar más items' : 'El pedido está vacío'}
                        </p>
                        <p className="mb-6">Abre el menú para agregar platos y bebidas</p>
                        <Button size="lg" onClick={() => setMostrarMenu(true)} className="gap-2">
                            <Plus className="w-5 h-5" /> Agregar Items
                        </Button>
                    </div>
                ) : (
                    <div className="w-full max-w-3xl mx-auto">
                        <h3 className="font-bold text-sm uppercase text-muted-foreground mb-3">
                            {pedidoVivo ? 'Items a Agregar' : 'Nuevo Pedido'}
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
                <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 border-2 border-primary/20 shadow-2xl bg-background text-foreground">
                    <div className="p-4 border-b border-primary/10 flex flex-col gap-4 bg-background z-10 sticky top-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-serif font-bold flex items-center gap-2 text-primary">
                                <BookOpen className="w-6 h-6" /> Menú "El Jardín"
                            </h2>
                            <Button variant="ghost" size="sm" onClick={() => setMostrarMenu(false)} className="hover:bg-primary/5">
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
                                    className={`whitespace-nowrap px-6 rounded-md font-serif font-medium transition-all ${categoriaActiva === cat
                                        ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20"
                                        : "bg-background text-foreground border-primary/30 hover:bg-primary/5 hover:border-primary/60"
                                        }`}
                                    size="sm"
                                >
                                    {cat}
                                </Button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar plato o bebida..."
                                className="pl-9 bg-secondary/50 border-primary/20 focus:ring-primary/30"
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
                                itemsFiltrados.map((item: ElementoMenu) => (
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

