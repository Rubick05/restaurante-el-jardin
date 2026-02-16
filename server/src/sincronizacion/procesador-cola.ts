import { pool } from '../bd/pool';
import { resolutorConflictos } from './resolutor-conflictos';
import { emisorTiempoReal } from './emisor-tiempo-real';

interface OperacionSync {
    id: string;
    id_restaurante: string;
    tipo_entidad: 'pedido' | 'item_pedido' | 'elemento_menu';
    id_entidad: string;
    operacion: 'crear' | 'actualizar' | 'eliminar';
    carga_util: any;
}

export const procesadorCola = {
    procesarLote: async (operaciones: OperacionSync[], tenantId: string) => {
        const procesados: string[] = [];
        const errores: any[] = [];

        for (const op of operaciones) {
            try {
                // Validación básica de seguridad
                if (op.id_restaurante !== tenantId) throw new Error("Tenant mismatch");

                await procesadorCola.aplicarOperacion(op);
                procesados.push(op.id);
            } catch (error) {
                console.error(`Error procesando op ${op.id}:`, error);
                errores.push({ id: op.id, error });
            }
        }

        return { procesados, errores };
    },

    aplicarOperacion: async (op: OperacionSync) => {
        const { tipo_entidad, operacion, carga_util, id_entidad, id_restaurante } = op;

        // Mapeo simple de nombres de tablas (pluralización naive)
        let tabla = '';
        if (tipo_entidad === 'pedido') tabla = 'pedidos';
        else if (tipo_entidad === 'item_pedido') tabla = 'items_pedido';
        else if (tipo_entidad === 'elemento_menu') tabla = 'elementos_menu';
        else throw new Error("Entidad desconocida");

        // Lógica específica por operación
        if (operacion === 'crear') {
            const keys = Object.keys(carga_util).join(', ');
            const values = Object.values(carga_util);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

            await pool.query(
                `INSERT INTO ${tabla} (${keys}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
                values
            );

            emisorTiempoReal.notificarCambio(id_restaurante, tipo_entidad, 'nuevo', carga_util);
        }
        else if (operacion === 'actualizar') {
            // Construir query dinámica
            const updates = Object.keys(carga_util).map((key, i) => `${key} = $${i + 2}`).join(', ');
            const values = [id_entidad, ...Object.values(carga_util)]; // id es $1

            await pool.query(
                `UPDATE ${tabla} SET ${updates} WHERE id = $1`,
                values
            );

            emisorTiempoReal.notificarCambio(id_restaurante, tipo_entidad, 'actualizado', { id: id_entidad, ...carga_util });
        }
        else if (operacion === 'eliminar') {
            await pool.query(`DELETE FROM ${tabla} WHERE id = $1`, [id_entidad]);
            emisorTiempoReal.notificarCambio(id_restaurante, tipo_entidad, 'eliminado', { id: id_entidad });
        }
    }
};
