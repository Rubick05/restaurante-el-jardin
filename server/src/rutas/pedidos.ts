import { Router } from 'express';
import { pool } from '../bd/pool';
import { emisorTiempoReal } from '../sincronizacion/emisor-tiempo-real';

const router = Router();

// ──────────────────────────────────────────────────────────────────
// GET /api/pedidos
// Devuelve todos los pedidos activos (pendiente, en_proceso, listo)
// O con ?fecha=YYYY-MM-DD para el resumen del día
// ──────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { fecha, todos, hoy } = req.query;

    let sql = '';
    let params: any[] = [];

    if (fecha) {
      // Pedidos de un día específico
      sql = `
                SELECT p.*,
                       json_agg(json_build_object(
                           'id', i.id,
                           'id_elemento_menu', i.id_elemento_menu,
                           'nombre_item', i.nombre_item,
                           'categoria', i.categoria,
                           'cantidad', i.cantidad,
                           'precio_unitario', i.precio_unitario,
                           'subtotal', i.subtotal,
                           'estado_item', i.estado_item,
                           'instrucciones', i.instrucciones
                       ) ORDER BY i.creado_en) AS items
                FROM pedidos p
                LEFT JOIN items_pedido i ON i.id_pedido = p.id
                WHERE DATE(p.creado_en AT TIME ZONE 'America/La_Paz') = $1
                GROUP BY p.id
                ORDER BY p.numero_ficha ASC
            `;
      params = [fecha];
    } else if (hoy === 'true') {
      // Pedidos del día de hoy (incluyendo pagados, para admin)
      sql = `
                SELECT p.*,
                       json_agg(json_build_object(
                           'id', i.id,
                           'id_elemento_menu', i.id_elemento_menu,
                           'nombre_item', i.nombre_item,
                           'categoria', i.categoria,
                           'cantidad', i.cantidad,
                           'precio_unitario', i.precio_unitario,
                           'subtotal', i.subtotal,
                           'estado_item', i.estado_item,
                           'instrucciones', i.instrucciones
                       ) ORDER BY i.creado_en) AS items
                FROM pedidos p
                LEFT JOIN items_pedido i ON i.id_pedido = p.id
                WHERE DATE(p.creado_en AT TIME ZONE 'America/La_Paz') = DATE(NOW() AT TIME ZONE 'America/La_Paz')
                GROUP BY p.id
                ORDER BY p.creado_en ASC
            `;
    } else if (todos === 'true') {
      // Todos los pedidos (para admin general)
      sql = `
                SELECT p.*,
                       json_agg(json_build_object(
                           'id', i.id,
                           'id_elemento_menu', i.id_elemento_menu,
                           'nombre_item', i.nombre_item,
                           'categoria', i.categoria,
                           'cantidad', i.cantidad,
                           'precio_unitario', i.precio_unitario,
                           'subtotal', i.subtotal,
                           'estado_item', i.estado_item,
                           'instrucciones', i.instrucciones
                       ) ORDER BY i.creado_en) AS items
                FROM pedidos p
                LEFT JOIN items_pedido i ON i.id_pedido = p.id
                GROUP BY p.id
                ORDER BY p.creado_en DESC
                LIMIT 200
            `;
    } else {
      // Pedidos activos (para cocina y mesero)
      sql = `
                SELECT p.*,
                       json_agg(json_build_object(
                           'id', i.id,
                           'id_elemento_menu', i.id_elemento_menu,
                           'nombre_item', i.nombre_item,
                           'categoria', i.categoria,
                           'cantidad', i.cantidad,
                           'precio_unitario', i.precio_unitario,
                           'subtotal', i.subtotal,
                           'estado_item', i.estado_item,
                           'instrucciones', i.instrucciones
                       ) ORDER BY i.creado_en) AS items
                FROM pedidos p
                LEFT JOIN items_pedido i ON i.id_pedido = p.id
                WHERE p.estado NOT IN ('pagado', 'cancelado')
                GROUP BY p.id
                ORDER BY p.creado_en ASC
            `;
    }

    const resultado = await pool.query(sql, params);

    // Normalizar: si items es null (pedido sin items), se usa []
    const pedidos = resultado.rows.map(p => ({
      ...p,
      items: p.items?.[0] === null ? [] : (p.items || [])
    }));

    res.json(pedidos);
  } catch (error: any) {
    console.error('Error GET /api/pedidos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────
// GET /api/pedidos/hoy
// Shortcut para pedidos de hoy (dashboard admin)
// ──────────────────────────────────────────────────────────────────
router.get('/hoy', async (req, res) => {
  try {
    const sql = `
            SELECT p.*,
                   json_agg(json_build_object(
                       'id', i.id,
                       'nombre_item', i.nombre_item,
                       'categoria', i.categoria,
                       'cantidad', i.cantidad,
                       'precio_unitario', i.precio_unitario,
                       'subtotal', i.subtotal,
                       'estado_item', i.estado_item
                   ) ORDER BY i.creado_en) AS items
            FROM pedidos p
            LEFT JOIN items_pedido i ON i.id_pedido = p.id
            WHERE DATE(p.creado_en AT TIME ZONE 'America/La_Paz') = CURRENT_DATE AT TIME ZONE 'America/La_Paz'
            GROUP BY p.id
            ORDER BY p.numero_ficha ASC
        `;
    const resultado = await pool.query(sql);
    const pedidos = resultado.rows.map(p => ({
      ...p,
      items: p.items?.[0] === null ? [] : (p.items || [])
    }));
    res.json(pedidos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────
// POST /api/pedidos
// Crear un nuevo pedido con todos sus items
// ──────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      id, id_restaurante, id_mesero,
      numero_ficha, numero_letrero,
      items, subtotal, total, estado, notas, creado_en
    } = req.body;

    // Generación Centralizada de Número de Ficha (A prueba de concurrencia)
    const resPrev = await client.query(`SELECT numero_ficha FROM pedidos WHERE id = $1`, [id]);

    let ficha;
    if (resPrev.rows.length > 0) {
      // Si el pedido ya existía (ej. reintento de red), conservamos su ficha oficial
      ficha = resPrev.rows[0].numero_ficha;
    } else {
      // Pedido nuevo: calculamos concurrente desde la base de datos la siguiente ficha
      const r = await client.query(`
            SELECT COALESCE(MAX(numero_ficha), 0) + 1 AS siguiente
            FROM pedidos
            WHERE DATE(creado_en AT TIME ZONE 'America/La_Paz') = DATE(NOW() AT TIME ZONE 'America/La_Paz')
        `);
      ficha = r.rows[0].siguiente;
    }

    const sqlPedido = `
            INSERT INTO pedidos
                (id, id_restaurante, id_mesero, numero_ficha, numero_letrero,
                 subtotal, total, estado, notas, creado_en, actualizado_en)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                    COALESCE($10::timestamptz, NOW()), NOW())
            ON CONFLICT (id) DO UPDATE SET
                estado = EXCLUDED.estado,
                actualizado_en = NOW()
            RETURNING *
        `;

    const pedidoResult = await client.query(sqlPedido, [
      id,
      id_restaurante || 'demo-tenant',
      id_mesero,
      ficha,
      numero_letrero,
      subtotal || 0,
      total || 0,
      estado || 'pendiente',
      notas,
      creado_en
    ]);

    const pedidoGuardado = pedidoResult.rows[0];

    // Insertar items
    const itemsGuardados: any[] = [];
    if (items && Array.isArray(items)) {
      await client.query('DELETE FROM items_pedido WHERE id_pedido = $1', [id]);

      for (const item of items) {
        const itemId = item.id || (await client.query('SELECT gen_random_uuid()::TEXT AS id')).rows[0].id;
        const r = await client.query(`
                    INSERT INTO items_pedido
                        (id, id_pedido, id_elemento_menu, nombre_item, categoria,
                         cantidad, precio_unitario, subtotal, estado_item, instrucciones)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING *
                `, [
          itemId,
          id,
          item.id_elemento_menu,
          item.nombre_item || item.nombre,
          item.categoria,
          item.cantidad,
          item.precio_unitario || 0,
          item.subtotal || 0,
          item.estado_item || 'pendiente',
          item.instrucciones_especiales || item.instrucciones || null
        ]);
        itemsGuardados.push(r.rows[0]);
      }
    }

    await client.query('COMMIT');

    const pedidoCompleto = { ...pedidoGuardado, items: itemsGuardados };

    // Emitir en tiempo real a todos los dispositivos conectados
    emisorTiempoReal.notificarCambio(
      id_restaurante || 'demo-tenant',
      'pedido',
      'nuevo',
      pedidoCompleto
    );

    res.status(201).json({ ok: true, pedido: pedidoCompleto });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error POST /api/pedidos:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────────────────────────
// PATCH /api/pedidos/:id
// Actualizar estado del pedido o estado de un item individual
// Body: { estado? } OR { item_id, estado_item }
// ──────────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, item_id, estado_item, datos_facturacion } = req.body;

    if (item_id && estado_item) {
      // Actualizar estado de un item individual
      const r = await pool.query(`
                UPDATE items_pedido
                SET estado_item = $1, actualizado_en = NOW()
                WHERE id = $2 AND id_pedido = $3
                RETURNING *
            `, [estado_item, item_id, id]);

      if (r.rows.length === 0) {
        return res.status(404).json({ error: 'Item no encontrado' });
      }

      // Emitir cambio de item en tiempo real
      emisorTiempoReal.notificarCambio('demo-tenant', 'pedido', 'item_actualizado', {
        id_pedido: id,
        item: r.rows[0]
      });

      return res.json({ ok: true, item: r.rows[0] });
    }

    // Actualizar estado del pedido
    const campos: string[] = [];
    const valores: any[] = [];
    let idx = 1;

    if (estado) {
      campos.push(`estado = $${idx++}`);
      valores.push(estado);
    }
    if (datos_facturacion) {
      campos.push(`datos_facturacion = $${idx++}`);
      valores.push(JSON.stringify(datos_facturacion));
    }

    const { items: nuevosItems } = req.body;
    if (campos.length === 0 && !nuevosItems && estado !== 'entregado' && estado !== 'pagado') {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    let pedidoActualizado = null;

    if (campos.length > 0) {
      campos.push(`actualizado_en = NOW()`);
      valores.push(id);

      const r = await pool.query(`
                UPDATE pedidos SET ${campos.join(', ')}
                WHERE id = $${idx}
                RETURNING *
            `, valores);

      if (r.rows.length === 0) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }
      pedidoActualizado = r.rows[0];
    } else {
      const r = await pool.query(`SELECT * FROM pedidos WHERE id = $1`, [id]);
      pedidoActualizado = r.rows[0];
    }

    // Si el pedido se entrega o se paga, todos sus items deben marcarse entregados
    if (estado === 'entregado' || estado === 'pagado') {
      await pool.query(`UPDATE items_pedido SET estado_item = 'entregado' WHERE id_pedido = $1`, [id]);
    } else if (nuevosItems && Array.isArray(nuevosItems)) {
      // Actualización explícita de un array de items
      for (const it of nuevosItems) {
        if (it.estado_item && (it.id || it.itemId)) {
          await pool.query(`UPDATE items_pedido SET estado_item = $1 WHERE id = $2`, [it.estado_item, it.id || it.itemId]);
        }
      }
    }

    // Adjuntar items actualizados a la respuesta
    const rItems = await pool.query(`SELECT * FROM items_pedido WHERE id_pedido = $1`, [id]);
    pedidoActualizado.items = rItems.rows;

    // Emitir cambio en tiempo real
    emisorTiempoReal.notificarCambio('demo-tenant', 'pedido', 'actualizado', pedidoActualizado);

    return res.json({ ok: true, pedido: pedidoActualizado });

  } catch (error: any) {
    console.error('Error PATCH /api/pedidos:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────
// POST /api/pedidos/cerrar-dia
// Cierra el día: guarda snapshot en dias_cerrados
// ──────────────────────────────────────────────────────────────────
router.post('/cerrar-dia', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hoy = new Date().toISOString().slice(0, 10);

    // Obtener todos los pedidos de hoy
    const pedidosResult = await client.query(`
            SELECT p.*, json_agg(i.*) AS items
            FROM pedidos p
            LEFT JOIN items_pedido i ON i.id_pedido = p.id
            WHERE DATE(p.creado_en AT TIME ZONE 'America/La_Paz') = $1
            GROUP BY p.id
        `, [hoy]);

    const pedidos = pedidosResult.rows;
    const total = pedidos.reduce((acc: number, p: any) => acc + parseFloat(p.total), 0);
    const totalItems = pedidos.reduce((acc: number, p: any) => acc + (p.items?.filter((i: any) => i !== null).length || 0), 0);

    // Marcar todos como pagados
    await client.query(`
            UPDATE pedidos SET estado = 'pagado', actualizado_en = NOW()
            WHERE estado NOT IN ('pagado', 'cancelado')
            AND DATE(creado_en AT TIME ZONE 'America/La_Paz') = $1
        `, [hoy]);

    // Guardar snapshot
    await client.query(`
            INSERT INTO dias_cerrados (id, fecha, total_recaudado, total_pedidos, total_items, pedidos_snapshot, cerrado_en)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (id) DO UPDATE SET
                total_recaudado = EXCLUDED.total_recaudado,
                pedidos_snapshot = EXCLUDED.pedidos_snapshot,
                cerrado_en = NOW()
        `, [hoy, hoy, total, pedidos.length, totalItems, JSON.stringify(pedidos)]);

    await client.query('COMMIT');

    emisorTiempoReal.notificarCambio('demo-tenant', 'dia', 'cerrado', { fecha: hoy, total });

    res.json({ ok: true, fecha: hoy, total_recaudado: total, total_pedidos: pedidos.length });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────────────────────────
// DELETE /api/pedidos/:id
// Elimina un pedido permanentemente
// ──────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mover a cancelado o simplemente eliminar.
    // Para eliminar permanentemente (y sus items por ON DELETE CASCADE):
    await client.query('DELETE FROM pedidos WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Emitir evento para que las cocinas y otras tablets lo remuevan en vivo
    emisorTiempoReal.notificarCambio('demo-tenant', 'pedido', 'eliminado', { id });

    res.json({ ok: true, mensaje: 'Pedido eliminado correctamente' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error DELETE /api/pedidos:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
