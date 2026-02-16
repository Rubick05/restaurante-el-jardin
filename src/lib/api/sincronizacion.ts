import { clienteHttp } from './cliente';
import { OperacionSincronizacion } from '../bd/bd-local';

const ENDPOINT = '/sincronizar';

export const apiSincronizacion = {
    enviarLote: async (operaciones: OperacionSincronizacion[], tenantId: string) => {
        return clienteHttp<{ procesados: string[], errores: any[] }>(ENDPOINT, {
            method: 'POST',
            body: JSON.stringify({ operaciones }),
            tenantId,
        });
    },
};
