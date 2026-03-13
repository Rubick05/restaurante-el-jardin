import { Router } from 'express';
import { pool } from '../bd/pool';

const router = Router();

// GET /api/promociones
// Devuelve las promociones ordenadas por el campo "orden"
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM promociones ORDER BY orden ASC');
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/promociones
// Reemplaza todas las promociones actuales con una nueva lista (máximo 5)
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const promociones = req.body.promociones || [];

        if (promociones.length > 5) {
            return res.status(400).json({ error: 'Solo se permiten hasta 5 promociones' });
        }

        // Borrar actuales
        await client.query('DELETE FROM promociones');

        // Insertar nuevas
        const guardadas = [];
        for (let i = 0; i < promociones.length; i++) {
            const p = promociones[i];
            const r = await client.query(`
                INSERT INTO promociones (tipo, datos_base64, badge, titulo, subtitulo, orden)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [p.tipo, p.datos_base64, p.badge, p.titulo, p.subtitulo, i]);
            guardadas.push(r.rows[0]);
        }

        await client.query('COMMIT');
        res.json({ ok: true, promociones: guardadas });
    } catch (error: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

export default router;
