import { bdLocal } from '@/lib/bd/bd-local';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/componentes/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/componentes/ui/card';
import { CheckCircle2, RotateCw } from 'lucide-react';
import { useState } from 'react';

export default function PaginaSemilla() {
    const queryClient = useQueryClient();
    const [cargando, setCargando] = useState(false);

    // Consulta para ver conteos actuales
    const { data: conteos, refetch } = useQuery({
        queryKey: ['conteos-bd'],
        queryFn: async () => {
            return {
                menu: await bdLocal.elementosMenu.count(),
                pedidos: await bdLocal.pedidos.count()
            };
        }
    });

    const sembrarDatos = async () => {
        setCargando(true);
        try {
            // 1. Limpiar BD existente
            await bdLocal.elementosMenu.clear();
            await bdLocal.pedidos.clear();
            await bdLocal.itemsPedido.clear();
            await bdLocal.mesas.clear(); // Ya no usaremos mesas predefinidas, pero limpiamos por si acaso

            // 2. Insertar Menú Cochabambino
            const items = [
                { nombre: "Pique Macho", precio: 60.00, cat: "Platos Fuertes", img: "https://images.unsplash.com/photo-1594970487933-d9d164d1421f?q=80&w=300&auto=format&fit=crop" },
                { nombre: "Silpancho", precio: 35.00, cat: "Platos Fuertes", img: "https://images.unsplash.com/photo-1604579976378-43869279d30c?q=80&w=300&auto=format&fit=crop" },
                { nombre: "Chicharrón", precio: 50.00, cat: "Platos Fuertes", img: "https://images.unsplash.com/photo-1626804475297-411db7051a61?q=80&w=300&auto=format&fit=crop" },
                { nombre: "Lapping", precio: 45.00, cat: "Platos Fuertes", img: null },
                { nombre: "Planchitas", precio: 30.00, cat: "Platos Fuertes", img: null },
                { nombre: "Falso Conejo", precio: 25.00, cat: "Platos Fuertes", img: null },
                { nombre: "Sopa de Maní", precio: 15.00, cat: "Sopas", img: null },
                { nombre: "Chairo", precio: 15.00, cat: "Sopas", img: null },
                { nombre: "Coca Cola 2L", precio: 15.00, cat: "Bebidas", img: null },
                { nombre: "Coca Cola Personal", precio: 5.00, cat: "Bebidas", img: null },
                { nombre: "Huari", precio: 20.00, cat: "Cervezas", img: null },
                { nombre: "Paceña", precio: 18.00, cat: "Cervezas", img: null },
                { nombre: "Porción de Arroz", precio: 5.00, cat: "Guarniciones", img: null },
            ];

            const batchMenu = items.map(item => ({
                id: uuidv4(),
                id_restaurante: 'demo-tenant',
                nombre: item.nombre,
                categoria: item.cat,
                precio_actual: item.precio,
                url_imagen: item.img || undefined,
                disponible: true,
                actualizado_en: new Date().toISOString()
            }));

            await bdLocal.elementosMenu.bulkAdd(batchMenu);

            // 3. Generar Historial de Ventas (Pedidos Pagados de HOY)
            const historialPedidos = [];
            const ahora = new Date();

            // Generar 15 pedidos pasados (hace 1-8 horas)
            for (let i = 0; i < 15; i++) {
                const haceHoras = Math.floor(Math.random() * 8) + 1;
                const fecha = new Date(ahora.getTime() - haceHoras * 60 * 60 * 1000).toISOString();

                // Items aleatorios
                const numItems = Math.floor(Math.random() * 3) + 1;
                const itemsPedido = [];
                let total = 0;

                for (let j = 0; j < numItems; j++) {
                    const itemMenu = batchMenu[Math.floor(Math.random() * batchMenu.length)];
                    const cantidad = Math.floor(Math.random() * 2) + 1;
                    const subtotal = itemMenu.precio_actual * cantidad;
                    total += subtotal;
                    itemsPedido.push({
                        id_elemento_menu: itemMenu.id,
                        nombre_item: itemMenu.nombre,
                        cantidad: cantidad,
                        precio_unitario: itemMenu.precio_actual,
                        subtotal: subtotal,
                        categoria: itemMenu.categoria
                    });
                }

                historialPedidos.push({
                    id: uuidv4(),
                    id_restaurante: 'demo-tenant',
                    id_mesa: 'historial', // Irrelevante para historial
                    id_mesero: 'admin',
                    numero_pedido: `HIST-${1000 + i}`,
                    numero_ficha: (50 + i).toString(), // Fichas altas para historial
                    estado: 'pagado',
                    tipo_pedido: Math.random() > 0.7 ? 'llevar' : 'mesa',
                    subtotal: total,
                    impuesto: 0,
                    total: total,
                    creado_en: fecha,
                    actualizado_en: fecha,
                    version: 1,
                    sincronizado: false,
                    items: itemsPedido,
                    datos_facturacion: Math.random() > 0.5 ? { tipo: 'recibo' } : { tipo: 'factura', nit_ci: '8574932', razon_social: 'Cliente Ejemplo' }
                });
            }

            // 4. Generar Pedidos ACTIVOS (Pendientes, Cocina, Listos)
            const pedidosActivos = [];
            const estadosActivos = ['pendiente', 'en_proceso', 'listo', 'entregado'];

            for (let i = 0; i < 8; i++) {
                const estado = estadosActivos[i % estadosActivos.length];
                const fecha = new Date(ahora.getTime() - (Math.random() * 60 * 1000)).toISOString(); // Hace minutos

                const itemMenu = batchMenu[Math.floor(Math.random() * 5)]; // Solo platos principales
                const cantidad = 1;

                pedidosActivos.push({
                    id: uuidv4(),
                    id_restaurante: 'demo-tenant',
                    id_mesa: 'activo',
                    id_mesero: 'mesero1',
                    numero_pedido: `ACT-${200 + i}`,
                    numero_ficha: (i + 1).toString(), // Fichas 1 a 8
                    estado: estado,
                    tipo_pedido: 'mesa',
                    subtotal: itemMenu.precio_actual,
                    impuesto: 0,
                    total: itemMenu.precio_actual,
                    creado_en: fecha,
                    actualizado_en: fecha,
                    version: 1,
                    sincronizado: false,
                    items: [{
                        id_elemento_menu: itemMenu.id,
                        nombre_item: itemMenu.nombre,
                        cantidad: cantidad,
                        precio_unitario: itemMenu.precio_actual,
                        subtotal: itemMenu.precio_actual,
                        categoria: itemMenu.categoria
                    }]
                });
            }

            await bdLocal.pedidos.bulkAdd([...historialPedidos, ...pedidosActivos] as any);

            // Invalidar queries
            await queryClient.invalidateQueries({ queryKey: ['menu'] });
            await queryClient.invalidateQueries({ queryKey: ['pedidos-activos'] });
            await queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });
            await queryClient.invalidateQueries({ queryKey: ['resumen-dia'] });
            await refetch();

            alert("✅ Datos COMPLETOS sembrados:\n- 15 Ventas Históricas (Prueba Resumen)\n- 8 Pedidos Activos (Prueba Cocina/Fichas)");
        } catch (e) {
            console.error(e);
            alert("❌ Error al insertar datos");
        } finally {
            setCargando(false);
        }
    };


    return (
        <div className="max-w-md mx-auto space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Inicializar Datos</h2>
                <p className="text-muted-foreground">Puebla la base de datos local para pruebas.</p>
            </div>

            <Card>
                <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-4 bg-secondary rounded-lg">
                            <div className="text-3xl font-bold">{conteos?.menu || 0}</div>
                            <div className="text-sm text-muted-foreground">Items Menú</div>
                        </div>
                        <div className="p-4 bg-secondary rounded-lg">
                            <div className="text-3xl font-bold">{conteos?.pedidos || 0}</div>
                            <div className="text-sm text-muted-foreground">Pedidos</div>
                        </div>
                    </div>

                    <Button
                        onClick={sembrarDatos}
                        className="w-full"
                        disabled={cargando}
                    >
                        {cargando ? <RotateCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {cargando ? 'Sembrando...' : 'Sembrar Datos de Prueba'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
