import { Link, Outlet, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/componentes/ui/button";
import { useAuth } from "@/lib/auth/contexto-auth";

export default function LayoutPrincipal() {
    const { usuarioActual, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login", { replace: true });
    };

    const esCamarero = usuarioActual?.rol === 'camarero';
    const esCocinero = usuarioActual?.rol === 'cocinero';
    const esAdmin = usuarioActual?.rol === 'administrador';

    const etiquetaRol = ({
        administrador: '👑 Administrador',
        cocinero: '👨‍🍳 Cocina',
        camarero: '🍽️ Camarero',
    } as Record<string, string>)[usuarioActual?.rol ?? ''] ?? '';

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
                <div className="p-6 flex-1">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-8">
                        <div className="p-2 bg-amber-800 rounded-lg">
                            <UtensilsCrossed className="w-6 h-6 text-amber-100" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight font-serif">El Jardín</h1>
                            <span className="text-[10px] text-muted-foreground">{etiquetaRol}</span>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        {/* CAMARERO: tomar pedidos + su historial */}
                        {(esCamarero || esAdmin) && (
                            <>
                                <Link to="/mesero">
                                    <Button variant="ghost" className="w-full justify-start gap-2">
                                        <UtensilsCrossed className="w-4 h-4" />
                                        Tomar Pedidos
                                    </Button>
                                </Link>
                                <Link to="/historial-camarero">
                                    <Button variant="ghost" className="w-full justify-start gap-2">
                                        <ClipboardList className="w-4 h-4" />
                                        Mi Historial
                                    </Button>
                                </Link>
                            </>
                        )}

                        {/* COCINERO: tablero cocina + historial de entregas */}
                        {(esCocinero || esAdmin) && (
                            <>
                                <Link to="/cocina">
                                    <Button variant="ghost" className="w-full justify-start gap-2">
                                        <ChefHat className="w-4 h-4" />
                                        Cocina
                                    </Button>
                                </Link>
                                <Link to="/historial-entregas">
                                    <Button variant="ghost" className="w-full justify-start gap-2">
                                        <PackageCheck className="w-4 h-4" />
                                        Historial Entregas
                                    </Button>
                                </Link>
                            </>
                        )}

                        {/* ADMIN: pedidos del día + gestión menú + QR */}
                        {esAdmin && (
                            <>
                                <div className="pt-3 pb-1">
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-3">
                                        Administración
                                    </span>
                                </div>
                                <Link to="/admin/pedidos-dia">
                                    <Button variant="ghost" className="w-full justify-start gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Pedidos del Día
                                    </Button>
                                </Link>
                                <Link to="/admin">
                                    <Button variant="ghost" className="w-full justify-start gap-2">
                                        <Settings className="w-4 h-4" />
                                        Gestión Menú
                                    </Button>
                                </Link>
                                <Link to="/admin/qr">
                                    <Button variant="ghost" className="w-full justify-start gap-2">
                                        <QrCode className="w-4 h-4" />
                                        Gestión QR
                                    </Button>
                                </Link>
                                <Link to="/admin/historial-dias">
                                    <Button variant="ghost" className="w-full justify-start gap-2">
                                        <History className="w-4 h-4" />
                                        Historial Días
                                    </Button>
                                </Link>
                            </>
                        )}
                    </nav>
                </div>

                {/* Footer: usuario y logout */}
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
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-auto">
                <header className="h-14 border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-6 flex items-center justify-between">
                    <span className="font-semibold text-sm text-muted-foreground">
                        {etiquetaRol} · {usuarioActual?.nombre}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="md:hidden text-red-600 hover:bg-red-50"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-4 h-4" />
                    </Button>
                </header>
                <div className="p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
