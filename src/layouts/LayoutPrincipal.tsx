import { Link, Outlet } from "react-router-dom";
import { UtensilsCrossed, LayoutDashboard, Settings, ChefHat } from "lucide-react";
import { Button } from "@/componentes/ui/button";

export default function LayoutPrincipal() {
    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="p-2 bg-primary rounded-lg">
                            <UtensilsCrossed className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Pelusa</h1>
                    </div>

                    <nav className="space-y-2">
                        <Link to="/">
                            <Button variant="ghost" className="w-full justify-start gap-2">
                                <LayoutDashboard className="w-4 h-4" />
                                Panel
                            </Button>
                        </Link>
                        <Link to="/mesero">
                            <Button variant="ghost" className="w-full justify-start gap-2">
                                <UtensilsCrossed className="w-4 h-4" />
                                Mesero
                            </Button>
                        </Link>
                        <Link to="/cocina">
                            <Button variant="ghost" className="w-full justify-start gap-2">
                                <ChefHat className="w-4 h-4" />
                                Cocina
                            </Button>
                        </Link>
                        <Link to="/admin">
                            <Button variant="ghost" className="w-full justify-start gap-2">
                                <Settings className="w-4 h-4" />
                                Administración
                            </Button>
                        </Link>
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t font-mono text-xs text-slate-400">
                    v0.1.0 Alpha (Offline-First)
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="h-16 border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10 px-6 flex items-center justify-between">
                    <h2 className="font-semibold text-lg">Panel de Control</h2>
                    <div className="flex items-center gap-4">
                        {/* Aquí iría el UserButton de Clerk */}
                        <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse"></div>
                    </div>
                </header>

                <div className="p-6">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
