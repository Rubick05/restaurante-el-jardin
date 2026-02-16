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
            await bdLocal.mesas.clear();

            // 2. Insertar Menú Cochabambino
            const items = [
                // Platos Fuertes
                { nombre: "Pique Macho", precio: 60.00, cat: "Platos Fuertes", img: "https://images.unsplash.com/photo-1594970487933-d9d164d1421f?q=80&w=300&auto=format&fit=crop" }, // Placeholder genérico, idealmente usar fotos reales
                { nombre: "Silpancho", precio: 35.00, cat: "Platos Fuertes", img: "https://images.unsplash.com/photo-1604579976378-43869279d30c?q=80&w=300&auto=format&fit=crop" },
                { nombre: "Chicharrón", precio: 50.00, cat: "Platos Fuertes", img: "https://images.unsplash.com/photo-1626804475297-411db7051a61?q=80&w=300&auto=format&fit=crop" },
                { nombre: "Lapping", precio: 45.00, cat: "Platos Fuertes", img: null },
                { nombre: "Planchitas", precio: 30.00, cat: "Platos Fuertes", img: null },
                { nombre: "Falso Conejo", precio: 25.00, cat: "Platos Fuertes", img: null },

                // Sopas
                { nombre: "Sopa de Maní", precio: 15.00, cat: "Sopas", img: null },
                { nombre: "Chairo", precio: 15.00, cat: "Sopas", img: null },

                // Bebidas
                { nombre: "Coca Cola 2L", precio: 15.00, cat: "Bebidas", img: null },
                { nombre: "Coca Cola Personal", precio: 5.00, cat: "Bebidas", img: null },
                { nombre: "Fanta 2L", precio: 15.00, cat: "Bebidas", img: null },
                { nombre: "Sprite 2L", precio: 15.00, cat: "Bebidas", img: null },
                { nombre: "Jugo de Naranja", precio: 10.00, cat: "Bebidas", img: null },
                { nombre: "Limonada", precio: 8.00, cat: "Bebidas", img: null },

                // Cervezas
                { nombre: "Huari", precio: 20.00, cat: "Cervezas", img: null },
                { nombre: "Paceña", precio: 18.00, cat: "Cervezas", img: null },
                { nombre: "Taquiña", precio: 18.00, cat: "Cervezas", img: null },

                // Entradas/Guarniciones
                { nombre: "Porción de Arroz", precio: 5.00, cat: "Guarniciones", img: null },
                { nombre: "Porción de Papas", precio: 8.00, cat: "Guarniciones", img: null },
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

            // 3. Insertar Mesas (Resetear a disponibles)
            const mesas = [
                { n: '1', z: 'Principal', c: 4 },
                { n: '2', z: 'Principal', c: 2 },
                { n: '3', z: 'Principal', c: 4 },
                { n: '4', z: 'Principal', c: 6 },
                { n: '5', z: 'Terraza', c: 2 },
                { n: '6', z: 'Terraza', c: 4 },
                { n: '7', z: 'Terraza', c: 8 },
                { n: '8', z: 'Barra', c: 1 },
            ];

            const batchMesas = mesas.map((m, i) => ({
                id: uuidv4(),
                id_restaurante: 'demo-tenant',
                numero: m.n,
                zona: m.z,
                capacidad: m.c,
                estado: 'disponible' as const,
                posX: i % 4,
                posY: Math.floor(i / 4)
            }));

            await bdLocal.mesas.bulkAdd(batchMesas);

            // Invalidar queries para que el menú se actualice
            await queryClient.invalidateQueries({ queryKey: ['menu'] });
            await queryClient.invalidateQueries({ queryKey: ['mesas'] });
            await queryClient.invalidateQueries({ queryKey: ['pedidos-cocina'] });
            await refetch(); // Refetch conteos

            alert("✅ Datos de Cochabamba insertados correctamente! BD Reiniciada.");
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
