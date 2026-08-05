import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { pool } from '../server/src/bd/pool.js';

// Cargar variables de entorno
dotenv.config();

const app = express();

// Rutas de la API (Importaciones directas desde el subdirectorio del servidor)
import pedidosRouter from '../server/src/rutas/pedidos.js';
import menuRouter from '../server/src/rutas/menu.js';
import historialRouter from '../server/src/rutas/historial.js';
import usuariosRouter from '../server/src/rutas/usuarios.js';
import promocionesRouter from '../server/src/rutas/promociones.js';
import gastosRouter from '../server/src/rutas/gastos.js';
import webConfigRouter from '../server/src/rutas/webConfig.js';
import chatRouter from '../server/src/rutas/chat.js';
import imagenesRouter from '../server/src/rutas/imagenes.js';

// Configuración de CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Función aux para obtener el router sin importar si se importó como ES Module ({ default }) o CJS
const r = (mod: any) => mod.default || mod;

// Asignar rutas de API (Prefijos explícitos para Vercel Serverless)
app.use('/api/pedidos', r(pedidosRouter));
app.use('/pedidos', r(pedidosRouter));

app.use('/api/menu', r(menuRouter));
app.use('/menu', r(menuRouter));

app.use('/api/historial', r(historialRouter));
app.use('/historial', r(historialRouter));

app.use('/api/promociones', r(promocionesRouter));
app.use('/promociones', r(promocionesRouter));

app.use('/api/gastos', r(gastosRouter));
app.use('/gastos', r(gastosRouter));

app.use('/api/web-config', r(webConfigRouter));
app.use('/web-config', r(webConfigRouter));

app.use('/api/imagenes', r(imagenesRouter));
app.use('/imagenes', r(imagenesRouter));

app.use('/api/usuarios', r(usuariosRouter));
app.use('/usuarios', r(usuariosRouter));

app.use('/api/chat', r(chatRouter));
app.use('/chat', r(chatRouter));

// Endpoint de verificación de salud
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), env: process.env.NODE_ENV });
});

// Endpoint de prueba de conexión a la BD
app.get('/api/test-db', async (_req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ ok: true, server_time: result.rows[0].now });
    } catch (error: any) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Endpoint del Cron Job de Vercel para el cierre diario automático
app.post('/api/cron/cierre-diario', async (req, res) => {
    // Validar secret de Vercel Cron para seguridad
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    console.log('⏰ [Vercel Cron] Iniciando cierre automático del día...');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Limpiar promociones vencidas
        const resPromo = await client.query(`
            DELETE FROM promociones 
            WHERE fecha_fin IS NOT NULL AND fecha_fin < CURRENT_DATE
            RETURNING id;
        `);
        if (resPromo.rowCount && resPromo.rowCount > 0) {
            console.log(`🧹 [Vercel Cron] Eliminadas ${resPromo.rowCount} promociones expiradas.`);
        }

        // 2. Obtener fecha de cierre (ayer en Bolivia)
        const hoyResult = await client.query(`SELECT (NOW() AT TIME ZONE 'America/La_Paz' - INTERVAL '1 MINUTE')::date AS ayer`);
        const fechaCierre = hoyResult.rows[0].ayer.toISOString().slice(0, 10);

        // 3. Obtener pedidos del día a cerrar
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

        if (pedidos.length === 0) {
            console.log(`⏰ [Vercel Cron] No hubo pedidos el ${fechaCierre}, omitiendo guardado.`);
            await client.query('COMMIT');
            return res.json({ ok: true, mensaje: `Omitido: no hubo pedidos el ${fechaCierre}` });
        }

        // 4. Marcar pedidos del día como pagados
        await client.query(`
            UPDATE pedidos SET estado = 'pagado', actualizado_en = NOW()
            WHERE estado NOT IN('pagado', 'cancelado')
            AND DATE(creado_en AT TIME ZONE 'America/La_Paz') = $1
        `, [fechaCierre]);

        // 5. Guardar snapshot en dias_cerrados (esto disparará Supabase Realtime)
        await client.query(`
            INSERT INTO dias_cerrados(id, fecha, total_recaudado, total_pedidos, total_items, pedidos_snapshot, cerrado_en)
            VALUES($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT(id) DO UPDATE SET
                total_recaudado = EXCLUDED.total_recaudado,
                pedidos_snapshot = EXCLUDED.pedidos_snapshot,
                cerrado_en = NOW()
        `, [fechaCierre, fechaCierre, total, pedidos.length, totalItems, JSON.stringify(pedidos)]);

        await client.query('COMMIT');

        console.log(`✅ [Vercel Cron] Cierre de día ${fechaCierre} completado. Total: Bs ${total}`);
        return res.json({ ok: true, fecha: fechaCierre, total });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('❌ [Vercel Cron] Error en cron de cierre diario:', error);
        return res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Middleware de captura de errores global para evitar caídas silenciosas en Vercel
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('❌ Express Global Error:', err);
    res.status(500).json({
        ok: false,
        error: err.message || 'Internal Server Error',
        details: err.toString()
    });
});

export default function handler(req: any, res: any) {
    return app(req, res);
}
