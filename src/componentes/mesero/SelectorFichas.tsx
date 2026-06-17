import { useQuery } from '@tanstack/react-query';
import { bdLocal, Pedido } from '@/lib/bd/bd-local';
import { Button } from '@/componentes/ui/button';
import { Hash } from 'lucide-react';
import { API_BASE_URL, normalizarPedidos } from '@/hooks/useInicializacion';

interface Props {
    onSelect: (numero: string) => void;
    fichaActual?: string;
}

export default function SelectorFichas({ onSelect, fichaActual }: Props) {
    // Obtener fichas ocupadas
    const { data: pedidosActivos = [] } = useQuery({
        queryKey: ['pedidos-activos'],
        queryFn: async (): Promise<Pedido[]> => {
            // Intentar cargar desde servidor primero
            try {
                const res = await fetch(`${API_BASE_URL}/api/pedidos`);
                if (res.ok) {
                    const data = normalizarPedidos(await res.json());
                    // Guardar en local para mantener sincronía
                    await bdLocal.pedidos.bulkPut(data as Pedido[]);
                    return data.filter((p: Pedido) => p.estado !== 'pagado' && p.estado !== 'cancelado');
                }
            } catch { /* offline fallback */ }

            return await bdLocal.pedidos
                .filter(p => p.estado !== 'pagado' && p.estado !== 'cancelado')
                .toArray();
        },
        refetchInterval: 5000 // Actualizar status letreros cada 5 seg
    });

    const fichasOcupadas = new Set(
        pedidosActivos
            .filter(p => p.numero_letrero)
            .map(p => String(p.numero_letrero))
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
                            className={`h-16 text-2xl font-black transition-all ${ocupada && !esActual ? "opacity-40 bg-muted/20 text-muted-foreground/30 cursor-not-allowed border-dashed border-border" : ""
                                } ${esActual ? "ring-2 ring-primary bg-primary text-primary-foreground text-glow-gold glow-gold scale-105" : ""}`}
                        >
                            <Hash className="w-4 h-4 mr-1 opacity-70" />
                            {numero}
                        </Button>
                    );
                })}
            </div>
            <div className="flex gap-4 justify-center mt-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-secondary rounded border border-border"></div>
                    <span>Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-muted/20 border border-dashed border-border rounded opacity-50"></div>
                    <span>Ocupada</span>
                </div>
                {fichaActual && (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-primary rounded ring-1 ring-primary"></div>
                        <span>Actual</span>
                    </div>
                )}
            </div>
        </div>
    );
}
