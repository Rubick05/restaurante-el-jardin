import { Card, CardHeader, CardTitle, CardContent } from "@/componentes/ui/card";

export default function GestionPersonal() {
    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Gestión de Personal</h2>

            <Card>
                <CardHeader>
                    <CardTitle>Usuarios y Roles</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <p className="font-bold">⚠️ Integración con Clerk Pendiente</p>
                        <p className="mt-2 text-sm text-yellow-700">
                            Para gestionar usuarios, necesitamos configurar las llaves de API de Clerk en el archivo `.env`.
                            Por ahora, el sistema utiliza un usuario administrador predeterminado.
                        </p>
                    </div>

                    <div className="mt-8">
                        <h3 className="text-lg font-medium mb-4">Lista de Demo</h3>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap">Admin Principal</td>
                                    <td className="px-6 py-4 whitespace-nowrap">Administrador</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-green-600">Activo</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap">Mesero Demo</td>
                                    <td className="px-6 py-4 whitespace-nowrap">Mesero</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-green-600">Activo</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap">Chef Demo</td>
                                    <td className="px-6 py-4 whitespace-nowrap">Cocina</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-green-600">Activo</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
