import { Router } from 'express';
import { pool } from '../bd/pool';
import { emisorTiempoReal } from '../sincronizacion/emisor-tiempo-real';

const router = Router();

// GET /api/menu — todos los elementos del menú
router.get('/', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT * FROM elementos_menu
            ORDER BY categoria, nombre
        `);
        res.json(r.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/menu — crear elemento
router.post('/', async (req, res) => {
    try {
        const { id, nombre, categoria, precio_actual, disponible, descripcion, url_imagen, imagen_base64 } = req.body;
        const r = await pool.query(`
            INSERT INTO elementos_menu
                (id, nombre, categoria, precio_actual, disponible, descripcion, url_imagen, imagen_base64, actualizado_en)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
            ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                categoria = EXCLUDED.categoria,
                precio_actual = EXCLUDED.precio_actual,
                disponible = EXCLUDED.disponible,
                descripcion = EXCLUDED.descripcion,
                url_imagen = EXCLUDED.url_imagen,
                imagen_base64 = EXCLUDED.imagen_base64,
                actualizado_en = NOW()
            RETURNING *
        `, [id, nombre, categoria, precio_actual, disponible ?? true, descripcion, url_imagen, imagen_base64]);
        emisorTiempoReal.notificarCambio('demo-tenant', 'menu', 'actualizado', r.rows[0]);
        res.status(201).json(r.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/menu/:id — actualizar campo(s)
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
        sets.push(`actualizado_en = NOW()`);
        vals.push(id);
        const r = await pool.query(
            `UPDATE elementos_menu SET ${sets.join(',')} WHERE id = $${i} RETURNING *`,
            vals
        );
        emisorTiempoReal.notificarCambio('demo-tenant', 'menu', 'actualizado', r.rows[0]);
        res.json(r.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/menu/:id
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM elementos_menu WHERE id = $1', [req.params.id]);
        emisorTiempoReal.notificarCambio('demo-tenant', 'menu', 'eliminado', { id: req.params.id });
        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
