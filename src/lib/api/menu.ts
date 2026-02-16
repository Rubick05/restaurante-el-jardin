import { clienteHttp } from './cliente';
import { ElementoMenu } from '../bd/bd-local';

const ENDPOINT = '/menu';

export const apiMenu = {
    obtenerTodos: async (tenantId: string) => {
        return clienteHttp<ElementoMenu[]>(ENDPOINT, {
            method: 'GET',
            tenantId,
        });
    },

    actualizarDisponibilidad: async (id: string, disponible: boolean, tenantId: string) => {
        return clienteHttp<ElementoMenu>(`${ENDPOINT}/${id}/agotado`, {
            method: 'POST',
            body: JSON.stringify({ disponible }),
            tenantId,
        });
    },
};
