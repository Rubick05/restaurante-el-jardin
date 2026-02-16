import { Router } from 'express';
import { pool } from '../bd/pool';

const router = Router();

// GET /api/pedidos - Obtener pedidos (Dashboard/Cocina)
router.get('/', async (req, res) => {
  try {
    // Por ahora simple, en producción paginado
    const resultado = await pool.query(`
      SELECT * FROM pedidos 
      WHERE estado IN ('pendiente', 'en_proceso', 'listo') 
      ORDER BY creado_en ASC
    `);
    res.json(resultado.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/pedidos - Sincronizar/Crear pedido
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Log para depuración
    console.log('Recibiendo pedido:', req.body);

    const { id, id_restaurante, id_mesa, items, subtotal, total, estado, creado_en } = req.body;

    // 1. Insertar Pedido
    // Usamos ON CONFLICT para soportar sincronización idempotente (si ya existe, no duplicar)
    const sqlPedido = `
      INSERT INTO pedidos (id, id_restaurante, id_mesa, subtotal, total, estado, creado_en, actualizado_en)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET
        estado = EXCLUDED.estado,
        actualizado_en = NOW()
      RETURNING *
    `;

    await client.query(sqlPedido, [id, id_restaurante, id_mesa, subtotal, total, estado, creado_en]);

    // 2. Insertar Items (Si existen en el payload)
    if (items && Array.isArray(items)) {
      // Primero limpiamos items anteriores si es una actualización para evitar duplicados complejos
      await client.query('DELETE FROM items_pedido WHERE id_pedido = $1', [id]);

      for (const item of items) {
        // Asegurar valores por defecto
        const precio = item.precio || item.precio_unitario || 0;
        const notas = item.notas || '';

        await client.query(`
            INSERT INTO items_pedido (id_pedido, id_elemento_menu, cantidad, precio_unitario, notas)
            VALUES ($1, $2, $3, $4, $5)
          `, [id, item.id_elemento_menu, item.cantidad, precio, notas]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, id });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creando pedido:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
