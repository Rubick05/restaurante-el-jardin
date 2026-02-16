import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bdLocal, ElementoMenu } from '@/lib/bd/bd-local';
import { Switch } from '@/componentes/ui/switch'; // Assuming shadcn switch exists or standard checkbox
import { apiMenu } from '@/lib/api/menu';
import { motorSincronizacion } from '@/lib/bd/motor-sincronizacion';
import { useContextoRestaurante } from '@/hooks/useContextoRestaurante';

export default function ControlInventario() {
    const { tenantId } = useContextoRestaurante();
    const queryClient = useQueryClient();
    const [filtro, setFiltro] = useState('');

    const { data: elementos } = useQuery({
        queryKey: ['menu-inventario'],
        queryFn: () => bdLocal.elementosMenu.toArray()
    });

    const toggleDispo = async (item: ElementoMenu) => {
        const nuevaDispo = !item.disponible;

        // 1. Actualización Optimista Local
        await bdLocal.elementosMenu.update(item.id, {
            disponible: nuevaDispo,
            actualizado_en: new Date().toISOString()
        });

        // 2. Encolar sincronización
        await motorSincronizacion.encolarOperacion(
            'elemento_menu',
            item.id,
            'actualizar',
            { disponible: nuevaDispo },
            tenantId
        );

        // 3. Invalidar queries
        queryClient.invalidateQueries({ queryKey: ['menu-inventario'] });
    };

    const itemsFiltrados = elementos?.filter(e =>
        e.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        e.categoria.toLowerCase().includes(filtro.toLowerCase())
    );

    const porCategoria = itemsFiltrados?.reduce((acc, item) => {
        const cat = item.categoria || 'Sin Categoría';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, ElementoMenu[]>);

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-4">Control de Disponibilidad (86)</h2>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Buscar plato..."
                    className="w-full p-2 border rounded-md"
                    value={filtro}
                    onChange={e => setFiltro(e.target.value)}
                />
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
                {porCategoria && Object.entries(porCategoria).map(([categoria, items]) => (
                    <div key={categoria}>
                        <h3 className="font-bold text-gray-500 uppercase text-sm mb-3 border-b">{categoria}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    className={`
                                        flex items-center justify-between p-3 rounded-md border 
                                        ${!item.disponible ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}
                                    `}
                                >
                                    <div>
                                        <p className={`font-medium ${!item.disponible ? 'text-red-700 line-through' : ''}`}>
                                            {item.nombre}
                                        </p>
                                        <p className="text-xs text-gray-500">${item.precio_actual}</p>
                                    </div>
                                    <button
                                        onClick={() => toggleDispo(item)}
                                        className={`
                                            px-3 py-1 text-sm font-bold rounded-full transition-colors
                                            ${item.disponible
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : 'bg-red-100 text-red-700 hover:bg-red-200'}
                                        `}
                                    >
                                        {item.disponible ? 'EN STOCK' : 'AGOTADO'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
