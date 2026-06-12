import { Router } from 'express';
import { pool } from '../bd/pool';
import { emisorTiempoReal } from '../sincronizacion/emisor-tiempo-real';

const router = Router();

// GET /api/promociones — Traer todas las promociones activas (fecha_fin IS NULL o fecha_fin >= HOY)
// Se ordenan por campo "orden" ascendente
router.get('/', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT * FROM promociones
            WHERE fecha_inicio <= CURRENT_DATE 
              AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
            ORDER BY orden ASC, creado_en DESC
        `);
        res.json(r.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/promociones/todas — Traer TODAS incluyendo inactivas/vencidas (para el admin)
router.get('/todas', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT * FROM promociones
            ORDER BY orden ASC, creado_en DESC
        `);
        res.json(r.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/promociones — crear o actualizar promoción
router.post('/', async (req, res) => {
    try {
        const { id, titulo, subtitulo, badge, tipo, imagen_url, imagen_base64, fecha_inicio, fecha_fin, orden } = req.body;
        
        let query;
        let params;
        
        if (id) {
            // Actualizar
            query = `
                UPDATE promociones 
                SET titulo = $1, subtitulo = $2, badge = $3, tipo = $4, 
                    imagen_url = $5, imagen_base64 = $6, fecha_inicio = $7, 
                    fecha_fin = $8, orden = $9
                WHERE id = $10
                RETURNING *
            `;
            params = [titulo, subtitulo, badge, tipo, imagen_url, imagen_base64, fecha_inicio || new Date().toISOString().split('T')[0], fecha_fin || null, orden || 1, id];
        } else {
            // Insertar nueva
            query = `
                INSERT INTO promociones
                    (titulo, subtitulo, badge, tipo, imagen_url, imagen_base64, fecha_inicio, fecha_fin, orden)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                RETURNING *
            `;
            params = [titulo, subtitulo, badge, tipo, imagen_url, imagen_base64, fecha_inicio || new Date().toISOString().split('T')[0], fecha_fin || null, orden || 1];
        }

        const r = await pool.query(query, params);
        emisorTiempoReal.notificarCambio('demo-tenant', 'promociones', 'actualizado', r.rows[0]);
        res.status(201).json(r.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/promociones/:id
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM promociones WHERE id = $1', [req.params.id]);
        emisorTiempoReal.notificarCambio('demo-tenant', 'promociones', 'eliminado', { id: req.params.id });
        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
