import { Router } from 'express';
import { pool } from '../bd/pool';

const router = Router();

// GET /api/historial — días cerrados
router.get('/', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT id, fecha, total_recaudado, total_pedidos, total_items, pedidos_snapshot, cerrado_en
            FROM dias_cerrados
            ORDER BY fecha DESC
            LIMIT 90
        `);
        res.json(r.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/historial/:id — eliminar día del historial
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM dias_cerrados WHERE id = $1', [req.params.id]);
        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
