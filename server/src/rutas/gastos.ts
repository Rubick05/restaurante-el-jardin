import { Router } from 'express';
import { pool } from '../bd/pool';
import { emisorTiempoReal } from '../sincronizacion/emisor-tiempo-real';

const router = Router();

// GET /api/gastos — obtener todos los gastos
router.get('/', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT * FROM gastos
            ORDER BY fecha DESC, creado_en DESC
        `);
        res.json(r.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/gastos — crear o actualizar un gasto (soporte de sincronización offline con UUIDs locales)
router.post('/', async (req, res) => {
    try {
        const { id, id_restaurante, descripcion, monto, categoria, fecha } = req.body;
        
        const r = await pool.query(`
            INSERT INTO gastos
                (id, id_restaurante, descripcion, monto, categoria, fecha, creado_en, actualizado_en)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                descripcion = EXCLUDED.descripcion,
                monto = EXCLUDED.monto,
                categoria = EXCLUDED.categoria,
                fecha = COALESCE(EXCLUDED.fecha, gastos.fecha),
                actualizado_en = NOW()
            RETURNING *
        `, [id, id_restaurante || 'demo-tenant', descripcion, monto, categoria, fecha]);

        emisorTiempoReal.notificarCambio(id_restaurante || 'demo-tenant', 'gasto', 'actualizado', r.rows[0]);
        res.status(201).json(r.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/gastos/:id — eliminar un gasto
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM gastos WHERE id = $1', [id]);
        
        emisorTiempoReal.notificarCambio('demo-tenant', 'gasto', 'eliminado', { id });
        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
