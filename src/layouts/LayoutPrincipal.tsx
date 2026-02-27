import { useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
    UtensilsCrossed,
    Settings,
    ChefHat,
    Calendar,
    ClipboardList,
    LogOut,
    UserCircle,
    PackageCheck,
    QrCode,
    History,
    Menu,
    X,
} from "lucide-react";
import { Button } from "@/componentes/ui/button";
import { useAuth } from "@/lib/auth/contexto-auth";

export default function LayoutPrincipal() {
    const { usuarioActual, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarAbierto, setSidebarAbierto] = useState(false);

    const handleLogout = () => {
        logout();
        navigate("/login", { replace: true });
    };

    const cerrarSidebar = () => setSidebarAbierto(false);

    const esCamarero = usuarioActual?.rol === 'camarero';
    const esCocinero = usuarioActual?.rol === 'cocinero';
    const esAdmin = usuarioActual?.rol === 'administrador';

    const etiquetaRol = ({
        administrador: '👑 Administrador',
        cocinero: '👨‍🍳 Cocina',
        camarero: '🍽️ Camarero',
    } as Record<string, string>)[usuarioActual?.rol ?? ''] ?? '';

    const esRutaActiva = (ruta: string) =>
        location.pathname === ruta || location.pathname.startsWith(ruta + '/');

    const NavLink = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) => (
        <Link to={to} onClick={cerrarSidebar}>
            <Button
                variant={esRutaActiva(to) ? "secondary" : "ghost"}
                className={`w-full justify-start gap-3 text-sm font-medium ${esRutaActiva(to) ? 'bg-amber-50 text-amber-900 border border-amber-200' : ''
                    }`}
            >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
            </Button>
        </Link>
    );

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-5 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-800 rounded-lg">
                        <UtensilsCrossed className="w-5 h-5 text-amber-100" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold font-serif leading-none">El Jardín</h1>
                        <span className="text-[10px] text-muted-foreground">{etiquetaRol}</span>
                    </div>
                </div>
                {/* Botón cerrar en móvil */}
                <button
                    className="md:hidden p-1 rounded-md hover:bg-slate-100"
                    onClick={cerrarSidebar}
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {/* CAMARERO */}
                {(esCamarero || esAdmin) && (
                    <>
                        {esAdmin && (
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 pt-2 pb-1">
                                Mesero
                            </p>
                        )}
                        <NavLink to="/mesero" icon={UtensilsCrossed} label="Tomar Pedidos" />
                        <NavLink to="/historial-camarero" icon={ClipboardList} label="Mi Historial" />
                    </>
                )}

                {/* COCINERO */}
                {(esCocinero || esAdmin) && (
                    <>
                        {esAdmin && (
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 pt-3 pb-1">
                                Cocina
                            </p>
                        )}
                        <NavLink to="/cocina" icon={ChefHat} label="Tablero Cocina" />
                        <NavLink to="/historial-entregas" icon={PackageCheck} label="Historial Entregas" />
                    </>
                )}

                {/* ADMIN */}
                {esAdmin && (
                    <>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 pt-3 pb-1">
                            Administración
                        </p>
                        <NavLink to="/admin/pedidos-dia" icon={Calendar} label="Pedidos del Día" />
                        <NavLink to="/admin" icon={Settings} label="Gestión Menú" />
                        <NavLink to="/admin/qr" icon={QrCode} label="Gestión QR" />
                        <NavLink to="/admin/historial-dias" icon={History} label="Historial Días" />
                    </>
                )}
            </nav>

            {/* Footer usuario */}
            <div className="p-4 border-t space-y-2">
                <div className="flex items-center gap-2 px-2">
                    <UserCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{usuarioActual?.nombre}</p>
                        <p className="text-xs text-muted-foreground">{usuarioActual?.usuario}</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleLogout}
                >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                </Button>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">

            {/* ── Sidebar DESKTOP (siempre visible en md+) ── */}
            <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0">
                <SidebarContent />
            </aside>

            {/* ── Sidebar MÓVIL (drawer deslizable) ── */}
            {/* Overlay */}
            {sidebarAbierto && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden"
                    onClick={cerrarSidebar}
                />
            )}
            {/* Drawer */}
            <aside className={`
                fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 z-50
                transform transition-transform duration-300 ease-in-out md:hidden
                ${sidebarAbierto ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <SidebarContent />
            </aside>

            {/* ── Contenido principal ── */}
            <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Header con hamburguesa en móvil */}
                <header className="h-14 border-b bg-white/90 backdrop-blur-sm sticky top-0 z-30 px-4 flex items-center justify-between shrink-0 shadow-sm">
                    {/* Hamburguesa (solo móvil) */}
                    <button
                        className="md:hidden p-2 rounded-md hover:bg-slate-100 mr-2"
                        onClick={() => setSidebarAbierto(true)}
                        aria-label="Abrir menú"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="md:hidden p-1.5 bg-amber-800 rounded-md">
                            <UtensilsCrossed className="w-4 h-4 text-amber-100" />
                        </div>
                        <span className="font-semibold text-sm text-muted-foreground truncate">
                            <span className="hidden sm:inline">{etiquetaRol} · </span>
                            {usuarioActual?.nombre}
                        </span>
                    </div>

                    {/* Logout rápido en móvil */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="md:hidden text-red-600 hover:bg-red-50 p-2"
                        onClick={handleLogout}
                        aria-label="Cerrar sesión"
                    >
                        <LogOut className="w-4 h-4" />
                    </Button>
                </header>

                {/* Contenido de la ruta */}
                <div className="flex-1 overflow-auto p-3 md:p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
