import { useQuery } from '@tanstack/react-query';
import { bdLocal } from '@/lib/bd/bd-local';
import { Button } from '@/componentes/ui/button';
import { Hash } from 'lucide-react';

interface Props {
    onSelect: (numero: string) => void;
    fichaActual?: string;
}

export default function SelectorFichas({ onSelect, fichaActual }: Props) {
    // Obtener fichas ocupadas
    const { data: pedidosActivos = [] } = useQuery({
        queryKey: ['fichas-ocupadas'],
        queryFn: async () => {
            // Usar la misma lógica robusta que en NavegadorMenu
            return await bdLocal.pedidos
                .filter(p => p.estado !== 'pagado' && p.estado !== 'cancelado')
                .toArray();
        },
        refetchInterval: 2000 // Actualizar más frecuentemente
    });

    const fichasOcupadas = new Set(
        pedidosActivos
            .filter(p => p.numero_letrero)
            .map(p => p.numero_letrero!)
    );

    const fichas = Array.from({ length: 30 }, (_, i) => (i + 1).toString());

    return (
        <div className="p-4">
            <h3 className="text-lg font-bold mb-4 text-center">
                Selecciona un Letrero Disponible
            </h3>
            <div className="grid grid-cols-5 gap-3 max-w-xl mx-auto">
                {fichas.map((numero) => {
                    const ocupada = fichasOcupadas.has(numero);
                    const esActual = fichaActual === numero;

                    return (
                        <Button
                            key={numero}
                            variant={esActual ? "default" : ocupada ? "outline" : "secondary"}
                            disabled={ocupada && !esActual}
                            onClick={() => onSelect(numero)}
                            className={`h-16 text-2xl font-black transition-all ${ocupada && !esActual ? "opacity-30 cursor-not-allowed" : ""
                                } ${esActual ? "ring-2 ring-orange-500 bg-orange-600" : ""}`}
                        >
                            <Hash className="w-4 h-4 mr-1" />
                            {numero}
                        </Button>
                    );
                })}
            </div>
            <div className="flex gap-4 justify-center mt-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-secondary rounded"></div>
                    <span>Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-muted border rounded opacity-30"></div>
                    <span>Ocupada</span>
                </div>
                {fichaActual && (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-600 rounded ring-2 ring-orange-500"></div>
                        <span>Actual</span>
                    </div>
                )}
            </div>
        </div>
    );
}
