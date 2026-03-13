import cron from 'node-cron';
import { pool } from '../bd/pool';
import { emisorTiempoReal } from '../sincronizacion/emisor-tiempo-real';

export function inicializarCronDiario() {
    // Se ejecuta todos los días a las 00:00:00 hora local del servidor 
    // Para asegurarse de cubrir zona horaria de Bolivia, especificamos timezone "America/La_Paz"
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ [CRON-DIARIO] Iniciando cierre automático del día...');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Aseguramos que 'hoy' usa la fecha de Bolivia para el cierre que corresponde al día que acaba de terminar
            // (Ej: A las 00:00 de hoy, se cierra el día de "ayer")
            const hoyResult = await client.query(`SELECT (NOW() AT TIME ZONE 'America/La_Paz' - INTERVAL '1 MINUTE')::date AS ayer`);
            const fechaCierre = hoyResult.rows[0].ayer.toISOString().slice(0, 10);

            const pedidosResult = await client.query(`
                SELECT p.*, json_agg(i.*) AS items
                FROM pedidos p
                LEFT JOIN items_pedido i ON i.id_pedido = p.id
                WHERE DATE(p.creado_en AT TIME ZONE 'America/La_Paz') = $1
                GROUP BY p.id
            `, [fechaCierre]);

            const pedidos = pedidosResult.rows;
            const total = pedidos.reduce((acc: number, p: any) => acc + parseFloat(p.total), 0);
            const totalItems = pedidos.reduce((acc: number, p: any) => acc + (p.items?.filter((i: any) => i !== null).length || 0), 0);

            // Evitamos guardar un registro "vacío" si no hubo pedidos ese día
            if (pedidos.length === 0) {
                console.log(\`⏰ [CRON-DIARIO] No hubo pedidos el \${fechaCierre}, omitiendo guardado.\`);
                await client.query('COMMIT');
                return;
            }

            // Marcar pedidos como pagados
            await client.query(`
                UPDATE pedidos SET estado = 'pagado', actualizado_en = NOW()
                WHERE estado NOT IN('pagado', 'cancelado')
                AND DATE(creado_en AT TIME ZONE 'America/La_Paz') = $1
                    `, [fechaCierre]);

            // Guardar snapshot de los pedidos
            await client.query(`
                INSERT INTO dias_cerrados(id, fecha, total_recaudado, total_pedidos, total_items, pedidos_snapshot, cerrado_en)
                VALUES($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT(id) DO UPDATE SET
                    total_recaudado = EXCLUDED.total_recaudado,
                    pedidos_snapshot = EXCLUDED.pedidos_snapshot,
                    cerrado_en = NOW()
                        `, [fechaCierre, fechaCierre, total, pedidos.length, totalItems, JSON.stringify(pedidos)]);

            await client.query('COMMIT');

            // Emitir evento para actualizar UIs activas
            emisorTiempoReal.notificarCambio('demo-tenant', 'dia', 'cerrado', { fecha: fechaCierre, total });
            
            console.log(\`✅ [CRON-DIARIO] Día \${fechaCierre} cerrado correctamente. Total: Bs \${total}\`);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ [CRON-DIARIO] Error al cerrar el día:', error);
        } finally {
            client.release();
        }
    }, {
        scheduled: true,
        timezone: "America/La_Paz"
    });

    console.log('⏰ Cronjob diario configurado (Se ejecutará a las 00:00 America/La_Paz)');
}
