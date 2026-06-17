import { Router } from 'express';
import { pool } from '../bd/pool';
import { emisorTiempoReal } from '../sincronizacion/emisor-tiempo-real';

const router = Router();

// GET /api/web-config — obtener todas las configuraciones web
router.get('/', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM web_config');
        const config: Record<string, any> = {};
        r.rows.forEach(row => {
            config[row.clave] = row.valor;
        });
        res.json(config);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/web-config — guardar o actualizar una clave de configuración
router.post('/', async (req, res) => {
    try {
        const { clave, valor } = req.body;
        if (!clave || valor === undefined) {
            return res.status(400).json({ error: 'Faltan parámetros clave o valor' });
        }

        const r = await pool.query(`
            INSERT INTO web_config (clave, valor, actualizado_en)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (clave) DO UPDATE SET
                valor = EXCLUDED.valor,
                actualizado_en = NOW()
            RETURNING *
        `, [clave, JSON.stringify(valor)]);

        emisorTiempoReal.notificarCambio('demo-tenant', 'web-config', 'actualizado', {
            clave,
            valor
        });

        res.json({ ok: true, config: r.rows[0] });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
