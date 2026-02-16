import { bdLocal, OperacionSincronizacion } from './bd-local';
import { apiSincronizacion } from '../api/sincronizacion';
import { v4 as uuidv4 } from 'uuid';

export const motorSincronizacion = {
    encolarOperacion: async (
        tipo_entidad: 'pedido' | 'item_pedido' | 'elemento_menu',
        id_entidad: string,
        operacion: 'crear' | 'actualizar' | 'eliminar',
        carga_util: any,
        id_restaurante: string
    ) => {
        const op: OperacionSincronizacion = {
            id: uuidv4(),
            id_restaurante,
            tipo_entidad,
            id_entidad,
            operacion,
            carga_util,
            timestamp_cliente: new Date().toISOString(),
            procesado: false,
            conteo_reintentos: 0,
        };

        await bdLocal.colaSincronizacion.add(op);

        // Intentar sincronizar inmediatamente si hay red (se puede mejorar con un listener de online)
        if (navigator.onLine) {
            motorSincronizacion.procesarCola(id_restaurante);
        }
    },

    procesarCola: async (tenantId: string) => {
        const pendientes = await bdLocal.colaSincronizacion
            .where('procesado')
            .equals(0 as any) // Dexie boolean storage quirk sometimes
            .toArray();

        if (pendientes.length === 0) return;

        try {
            // Filtramos solo los no procesados (boolean check real)
            const operacionesParaEnviar = pendientes.filter(p => !p.procesado);
            if (operacionesParaEnviar.length === 0) return;

            const resultado = await apiSincronizacion.enviarLote(operacionesParaEnviar, tenantId);

            if (resultado && resultado.procesados) {
                await bdLocal.colaSincronizacion.bulkDelete(resultado.procesados);
            }
        } catch (error) {
            console.error("Error procesando cola de sincronización:", error);
        }
    }
};
