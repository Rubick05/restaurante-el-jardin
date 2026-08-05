import { Router } from 'express';
import { pool } from '../bd/pool.js';
import { emisorTiempoReal } from '../sincronizacion/emisor-tiempo-real.js';
import { eliminarImagenCloudinary } from '../utils/cloudinary.js';

const router = Router();

// GET /api/promociones — Traer todas las promociones activas (fecha_fin IS NULL o fecha_fin >= HOY)
// Se ordenan por campo "orden" ascendente
// GET /api/promociones — Traer todas las promociones activas (sin base64)
router.get('/', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT id, titulo, subtitulo, badge, tipo, imagen_url, fecha_inicio, fecha_fin, orden, creado_en FROM promociones
            WHERE fecha_inicio <= CURRENT_DATE 
              AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
            ORDER BY orden ASC, creado_en DESC
        `);
        res.json(r.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/promociones/todas — Traer TODAS (para admin, sin base64)
router.get('/todas', async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT id, titulo, subtitulo, badge, tipo, imagen_url, fecha_inicio, fecha_fin, orden, creado_en FROM promociones
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
        const { id, titulo, subtitulo, badge, tipo, imagen_url, fecha_inicio, fecha_fin, orden } = req.body;
        
        let query;
        let params;
        let viejaUrl: string | null = null;
        
        if (id) {
            // Obtener la imagen anterior si existe para borrarla si cambia
            const viejoPromo = await pool.query('SELECT imagen_url FROM promociones WHERE id = $1', [id]);
            viejaUrl = viejoPromo.rows[0]?.imagen_url;

            // Actualizar
            query = `
                UPDATE promociones 
                SET titulo = $1, subtitulo = $2, badge = $3, tipo = $4, 
                    imagen_url = $5, fecha_inicio = $6, 
                    fecha_fin = $7, orden = $8
                WHERE id = $9
                RETURNING id, titulo, subtitulo, badge, tipo, imagen_url, fecha_inicio, fecha_fin, orden, creado_en
            `;
            params = [titulo, subtitulo, badge, tipo, imagen_url, fecha_inicio || new Date().toISOString().split('T')[0], fecha_fin || null, orden || 1, id];
        } else {
            // Insertar nueva
            query = `
                INSERT INTO promociones
                    (titulo, subtitulo, badge, tipo, imagen_url, fecha_inicio, fecha_fin, orden)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING id, titulo, subtitulo, badge, tipo, imagen_url, fecha_inicio, fecha_fin, orden, creado_en
            `;
            params = [titulo, subtitulo, badge, tipo, imagen_url, fecha_inicio || new Date().toISOString().split('T')[0], fecha_fin || null, orden || 1];
        }

        const r = await pool.query(query, params);

        // Si cambió la imagen con éxito y la anterior era diferente, borrar la anterior
        if (viejaUrl && viejaUrl !== imagen_url) {
            eliminarImagenCloudinary(viejaUrl);
        }

        emisorTiempoReal.notificarCambio('demo-tenant', 'promociones', 'actualizado', r.rows[0]);
        res.status(201).json(r.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/promociones/:id
router.delete('/:id', async (req, res) => {
    try {
        // Obtener la imagen de la promoción antes de borrarla
        const promoRes = await pool.query('SELECT imagen_url FROM promociones WHERE id = $1', [req.params.id]);
        const urlImagen = promoRes.rows[0]?.imagen_url;

        await pool.query('DELETE FROM promociones WHERE id = $1', [req.params.id]);

        // Si tenía imagen, borrarla de Cloudinary
        if (urlImagen) {
            eliminarImagenCloudinary(urlImagen);
        }

        emisorTiempoReal.notificarCambio('demo-tenant', 'promociones', 'eliminado', { id: req.params.id });
        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
