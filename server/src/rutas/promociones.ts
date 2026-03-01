import { Router } from 'express';
import { pool } from '../bd/pool';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/promociones — todas las promociones
router.get('/', async (req, res) => {
    try {
        const { activa } = req.query;
        let query = 'SELECT * FROM promociones';
        const values: any[] = [];

        if (activa === 'true') {
            query += ' WHERE activa = $1';
            values.push(true);
        }

        query += ' ORDER BY creado_en DESC';

        const r = await pool.query(query, values);
        res.json(r.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/promociones — crear promoción
router.post('/', async (req, res) => {
    try {
        const { titulo, tipo_media, media_base64, activa } = req.body;

        if (!titulo || !media_base64) {
            return res.status(400).json({ error: 'Título y media son obligatorios' });
        }

        const id = uuidv4();
        const r = await pool.query(`
            INSERT INTO promociones (id, titulo, tipo_media, media_base64, activa)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [id, titulo, tipo_media || 'imagen', media_base64, activa ?? true]);

        res.status(201).json(r.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/promociones/:id — actualizar promoción
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const campos = req.body;
        const sets: string[] = [];
        const vals: any[] = [];
        let i = 1;

        for (const k of Object.keys(campos)) {
            sets.push(`${k} = $${i++}`);
            vals.push(campos[k]);
        }

        if (sets.length === 0) return res.json({});

        vals.push(id);
        const r = await pool.query(
            `UPDATE promociones SET ${sets.join(',')} WHERE id = $${i} RETURNING *`,
            vals
        );
        res.json(r.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/promociones/:id
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM promociones WHERE id = $1', [req.params.id]);
        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
