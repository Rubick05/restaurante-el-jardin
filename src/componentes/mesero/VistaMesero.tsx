import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/componentes/ui/tabs";
import NavegadorMenu from "./NavegadorMenu";
import MapaMesas from "./MapaMesas";
import MisPedidos from "./MisPedidos";
import { useQuery } from "@tanstack/react-query";
import { bdLocal, Mesa } from "@/lib/bd/bd-local";
import { useState } from "react";

export default function VistaMesero() {
    const [tabActivo, setTabActivo] = useState("mapa");
    const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);

    const { data: menuCount } = useQuery({
        queryKey: ['check-menu'],
        queryFn: () => bdLocal.elementosMenu.count()
    });

    const handleMesaSelect = (mesa: Mesa) => {
        setMesaSeleccionada(mesa);
        // Si la mesa está disponible, ir directo a tomar pedido
        // Si está ocupada, el MapaMesas manejará el diálogo de opciones
    };

    const irANuevoPedido = () => {
        setTabActivo("nuevo");
    };

    return (
        <div className="space-y-4">
            {menuCount === 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 text-yellow-800">
                    <p className="font-bold">⚠️ El menú está vacío</p>
                    <p className="text-sm">
                        Para ver platos aquí, ve a <a href="/semilla" className="underline font-bold">/semilla</a> y carga los datos de prueba.
                    </p>
                </div>
            )}

            <Tabs value={tabActivo} onValueChange={setTabActivo} className="w-full">
                <TabsList className="w-full justify-start h-12 bg-slate-100 p-1 mb-4">
                    <TabsTrigger value="nuevo" className="flex-1 max-w-[200px] h-full" onClick={() => setMesaSeleccionada(null)}>
                        Nuevo Pedido (Barra)
                    </TabsTrigger>
                    <TabsTrigger value="mapa" className="flex-1 max-w-[200px] h-full">Mesas</TabsTrigger>
                    <TabsTrigger value="pedidos" className="flex-1 max-w-[200px] h-full">Mis Pedidos</TabsTrigger>
                </TabsList>

                <TabsContent value="nuevo" className="min-h-[500px]">
                    <NavegadorMenu
                        mesaSeleccionada={mesaSeleccionada}
                        onVolver={() => setTabActivo("mapa")}
                    />
                </TabsContent>

                <TabsContent value="mapa">
                    <MapaMesas
                        onMesaSelect={handleMesaSelect}
                        onNavegarPedido={irANuevoPedido}
                    />
                </TabsContent>

                <TabsContent value="pedidos">
                    <MisPedidos />
                </TabsContent>
            </Tabs>
        </div>
    );
}
