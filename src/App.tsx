import { createBrowserRouter, RouterProvider } from "react-router-dom";
import LayoutPrincipal from "@/layouts/LayoutPrincipal";
import PaginaSemilla from "@/paginas/PaginaSemilla";
import VistaMesero from "@/componentes/mesero/VistaMesero";
import TableroCocina from "@/componentes/cocina/TableroCocina";
import GestionMenu from "@/componentes/admin/GestionMenu";

// Páginas placeholder temporales
const Dashboard = () => (
  <div className="space-y-4">
    <h3 className="text-xl font-medium">Resumen del Día</h3>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="p-6 bg-white rounded-xl shadow-sm border">Ventas: $0.00</div>
      <div className="p-6 bg-white rounded-xl shadow-sm border">Pedidos Activos: 0</div>
    </div>
  </div>
);



const router = createBrowserRouter([
  {
    path: "/",
    element: <LayoutPrincipal />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "mesero", element: <VistaMesero /> },
      { path: "cocina", element: <TableroCocina /> },
      { path: "admin", element: <GestionMenu /> },
      { path: "semilla", element: <PaginaSemilla /> }, // Ruta oculta para devs
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
