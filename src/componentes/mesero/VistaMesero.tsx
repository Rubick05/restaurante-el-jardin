import { useState } from "react";
import NavegadorMenu from "./NavegadorMenu";
import TableroFichas from "./TableroFichas"; // Ahora es la Lista de Pedidos
import { Button } from "@/componentes/ui/button";
import { PlusCircle, UtensilsCrossed } from "lucide-react";
import { Pedido } from "@/lib/bd/bd-local";
import { ModalCobro } from "./ModalCobro";

export default function VistaMesero() {
    const [modo, setModo] = useState<"lista" | "menu">("lista");
    const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);
    const [pedidoACobrar, setPedidoACobrar] = useState<Pedido | null>(null);
    const [modalCobroAbierto, setModalCobroAbierto] = useState(false);

    const irANuevoPedido = () => {
        setPedidoSeleccionado(null);
        setModo("menu");
    };

    const irAEditarPedido = (pedido: Pedido) => {
        setPedidoSeleccionado(pedido);
        setModo("menu");
    };

    const volverALista = () => {
        setModo("lista");
        setPedidoSeleccionado(null);
    };

    const abrirCobro = (pedido: Pedido) => {
        setPedidoACobrar(pedido);
        setModalCobroAbierto(true);
    };

    const cerrarCobro = () => {
        setModalCobroAbierto(false);
        setPedidoACobrar(null);
    };

    if (modo === "menu") {
        return (
            <NavegadorMenu
                onVolver={volverALista}
                pedidoExistente={pedidoSeleccionado}
            />
        );
    }

    return (
        <div className="h-full flex flex-col relative w-full bg-background">
            {/* Header */}
            <header className="px-6 py-4 bg-card border-b border-border shadow-sm sticky top-0 z-10 flex justify-between items-center glow-gold">
                <div>
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <UtensilsCrossed className="w-6 h-6 text-primary text-glow-gold" />
                        Mis Pedidos
                    </h2>
                    <p className="text-sm text-muted-foreground">Gestiona las órdenes activas</p>
                </div>
                <Button
                    onClick={irANuevoPedido}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-2 hidden md:flex font-bold"
                >
                    <PlusCircle className="w-5 h-5" />
                    Nuevo Pedido
                </Button>
            </header>

            {/* Contenido: Lista de Pedidos */}
            <div className="flex-1 overflow-y-auto p-2">
                <TableroFichas
                    onPedidoSelect={irAEditarPedido}
                    onCobrarPedido={abrirCobro}
                />
            </div>

            {/* Botón Flotante (Móvil) */}
            <div className="md:hidden fixed bottom-6 right-6 z-50">
                <Button
                    size="icon"
                    className="rounded-full w-14 h-14 shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground p-0 font-bold"
                    onClick={irANuevoPedido}
                >
                    <PlusCircle className="w-8 h-8" />
                </Button>
            </div>

            {/* Modal de Cobro */}
            {pedidoACobrar && (
                <ModalCobro
                    open={modalCobroAbierto}
                    onOpenChange={(open) => { if (!open) cerrarCobro(); }}
                    pedido={pedidoACobrar}
                    onCobrado={cerrarCobro}
                />
            )}
        </div>
    );
}
