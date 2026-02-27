import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { useAuth, ProveedorAuth } from "@/lib/auth/contexto-auth";
import LayoutPrincipal from "@/layouts/LayoutPrincipal";
import PaginaSemilla from "@/paginas/PaginaSemilla";
import VistaMesero from "@/componentes/mesero/VistaMesero";
import TableroCocina from "@/componentes/cocina/TableroCocina";
import HistorialEntregas from "@/componentes/cocina/HistorialEntregas";
import GestionMenu from "@/componentes/admin/GestionMenu";
import GestionQR from "@/componentes/admin/GestionQR";
import HistorialDias from "@/componentes/admin/HistorialDias";
import ResumenPedidosDia from '@/componentes/admind/ResumenPedidosDia';
import HistorialCamarero from '@/componentes/camarero/HistorialCamarero';
import PantallaLogin from '@/componentes/auth/PantallaLogin';
import { useSocketSync } from '@/hooks/useSocketSync';
import { useInicializacion } from '@/hooks/useInicializacion';

function RutaProtegida({
  elemento,
  rolesPermitidos,
}: {
  elemento: React.ReactElement;
  rolesPermitidos?: string[];
}) {
  const { usuarioActual, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="animate-spin border-4 border-amber-600 border-t-transparent rounded-full w-10 h-10" />
      </div>
    );
  }

  if (!usuarioActual) return <Navigate to="/login" replace />;

  if (rolesPermitidos && !rolesPermitidos.includes(usuarioActual.rol)) {
    return <Navigate to="/sin-acceso" replace />;
  }

  return elemento;
}

function InicioSegunRol() {
  const { usuarioActual, cargando } = useAuth();
  if (cargando) return null;
  if (!usuarioActual) return <Navigate to="/login" replace />;
  if (usuarioActual.rol === 'camarero') return <Navigate to="/mesero" replace />;
  if (usuarioActual.rol === 'cocinero') return <Navigate to="/cocina" replace />;
  return <Navigate to="/admin/pedidos-dia" replace />;
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: <PantallaLogin />,
  },
  {
    path: "/",
    element: <RutaProtegida elemento={<LayoutPrincipal />} />,
    children: [
      { index: true, element: <InicioSegunRol /> },

      // ── CAMARERO ──────────────────────────────────────────
      {
        path: "mesero",
        element: (
          <RutaProtegida
            elemento={<VistaMesero />}
            rolesPermitidos={['camarero', 'administrador']}
          />
        ),
      },
      {
        // Solo el propio camarero (o admin) puede ver el historial
        path: "historial-camarero",
        element: (
          <RutaProtegida
            elemento={<HistorialCamarero />}
            rolesPermitidos={['camarero', 'administrador']}
          />
        ),
      },

      // ── COCINA ────────────────────────────────────────────
      {
        path: "cocina",
        element: (
          <RutaProtegida
            elemento={<TableroCocina />}
            rolesPermitidos={['cocinero', 'administrador']}
          />
        ),
      },

      // ── ADMIN ─────────────────────────────────────────────
      {
        path: "admin",
        element: (
          <RutaProtegida
            elemento={<GestionMenu />}
            rolesPermitidos={['administrador']}
          />
        ),
      },
      {
        path: "admin/pedidos-dia",
        element: (
          <RutaProtegida
            elemento={<ResumenPedidosDia />}
            rolesPermitidos={['administrador']}
          />
        ),
      },

      // ── UTILIDADES ────────────────────────────────────────
      { path: "semilla", element: <PaginaSemilla /> },
      { path: "sin-acceso", element: <InicioSegunRol /> },

      // ── HISTORIAL ENTREGAS (cocina) ────────────────────────
      {
        path: "historial-entregas",
        element: (
          <RutaProtegida
            elemento={<HistorialEntregas />}
            rolesPermitidos={['cocinero', 'administrador']}
          />
        ),
      },

      // ── QR (admin) ────────────────────────────────────────
      {
        path: "admin/qr",
        element: (
          <RutaProtegida
            elemento={<GestionQR />}
            rolesPermitidos={['administrador']}
          />
        ),
      },

      // ── HISTORIAL DÍAS (admin) ─────────────────────────────
      {
        path: "admin/historial-dias",
        element: (
          <RutaProtegida
            elemento={<HistorialDias />}
            rolesPermitidos={['administrador']}
          />
        ),
      },
    ],
  },
]);


function AppInterna() {
  useSocketSync();
  useInicializacion();
  return <RouterProvider router={router} />;
}

function App() {
  return (
    <ProveedorAuth>
      <AppInterna />
    </ProveedorAuth>
  );
}

export default App;
