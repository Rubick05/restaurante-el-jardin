import { clienteHttp } from './cliente';
import { Pedido } from '../bd/bd-local';

const ENDPOINT = '/pedidos';

export const apiPedidos = {
    crear: async (pedido: Pedido, tenantId: string) => {
        return clienteHttp<Pedido>(ENDPOINT, {
            method: 'POST',
            body: JSON.stringify(pedido),
            tenantId,
        });
    },

    obtenerTodos: async (tenantId: string) => {
        return clienteHttp<Pedido[]>(ENDPOINT, {
            method: 'GET',
            tenantId,
        });
    },

    actualizarEstado: async (id: string, estado: string, tenantId: string) => {
        return clienteHttp<Pedido>(`${ENDPOINT}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ estado }),
            tenantId,
        });
    },
};
