-- ═══════════════════════════════════════════════════════════
--  Restaurante El Jardín — Schema PostgreSQL
--  Ejecutar este script en Railway PostgreSQL
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────── MENÚ ─────────────────────────────
CREATE TABLE IF NOT EXISTS elementos_menu (
    id              TEXT        PRIMARY KEY,
    id_restaurante  TEXT        NOT NULL DEFAULT 'demo-tenant',
    nombre          TEXT        NOT NULL,
    descripcion     TEXT,
    categoria       TEXT        NOT NULL,
    precio_actual   NUMERIC(10,2) NOT NULL,
    disponible      BOOLEAN     NOT NULL DEFAULT TRUE,
    url_imagen      TEXT,
    imagen_base64   TEXT,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────── PEDIDOS ────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos (
    id              TEXT        PRIMARY KEY,
    id_restaurante  TEXT        NOT NULL DEFAULT 'demo-tenant',
    id_mesero       TEXT,
    numero_ficha    INTEGER     NOT NULL DEFAULT 0,
    numero_letrero  INTEGER,
    estado          TEXT        NOT NULL DEFAULT 'pendiente',
    -- estado: pendiente | en_proceso | listo | entregado | pagado | cancelado
    subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
    total           NUMERIC(10,2) NOT NULL DEFAULT 0,
    datos_facturacion JSONB,
    notas           TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────── ITEMS PEDIDO ────────────────────────
CREATE TABLE IF NOT EXISTS items_pedido (
    id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    id_pedido           TEXT        NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    id_elemento_menu    TEXT,
    nombre_item         TEXT        NOT NULL,
    categoria           TEXT,
    cantidad            INTEGER     NOT NULL DEFAULT 1,
    precio_unitario     NUMERIC(10,2) NOT NULL DEFAULT 0,
    subtotal            NUMERIC(10,2) NOT NULL DEFAULT 0,
    estado_item         TEXT        NOT NULL DEFAULT 'pendiente',
    -- estado_item: pendiente | en_proceso | listo | entregado
    instrucciones       TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────── DÍAS CERRADOS ──────────────────────
CREATE TABLE IF NOT EXISTS dias_cerrados (
    id              TEXT        PRIMARY KEY,  -- YYYY-MM-DD
    fecha           TEXT        NOT NULL,
    total_recaudado NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_pedidos   INTEGER     NOT NULL DEFAULT 0,
    total_items     INTEGER     NOT NULL DEFAULT 0,
    pedidos_snapshot JSONB,
    cerrado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────── ÍNDICES ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_creado ON pedidos(creado_en);
CREATE INDEX IF NOT EXISTS idx_items_pedido ON items_pedido(id_pedido);
CREATE INDEX IF NOT EXISTS idx_menu_disponible ON elementos_menu(disponible);

-- ─────────────────────── DATOS INICIALES (MENÚ) ──────────────────
-- Este INSERT carga el menú por defecto si la tabla está vacía
INSERT INTO elementos_menu (id, nombre, categoria, precio_actual, disponible, descripcion) VALUES
  (gen_random_uuid()::TEXT, 'Pique (Media)',           'Plato Fuerte', 80,  TRUE, 'Media porción'),
  (gen_random_uuid()::TEXT, 'Pique (Entero)',           'Plato Fuerte', 120, TRUE, 'Porción entera'),
  (gen_random_uuid()::TEXT, 'Charque (Media)',          'Plato Fuerte', 80,  TRUE, 'Media porción'),
  (gen_random_uuid()::TEXT, 'Charque (Entero)',         'Plato Fuerte', 120, TRUE, 'Porción entera'),
  (gen_random_uuid()::TEXT, 'Planchita (Media)',        'Plato Fuerte', 80,  TRUE, 'Media porción'),
  (gen_random_uuid()::TEXT, 'Planchita (Entera)',       'Plato Fuerte', 120, TRUE, 'Porción entera'),
  (gen_random_uuid()::TEXT, 'Jatun Pampaku',            'Plato Fuerte', 110, TRUE, 'Especialidad de la casa'),
  (gen_random_uuid()::TEXT, 'Lambreado de Conejo',      'Plato Fuerte', 80,  TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Alitas',                   'Plato Fuerte', 25,  TRUE, 'Porción de alitas'),
  (gen_random_uuid()::TEXT, 'Escabeche de Pollo',       'Plato Fuerte', 50,  TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Lomito Borracho',          'Caldos',       30,  TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Kawi',                     'Caldos',       20,  TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Fideos Uchu (Personal)',   'Caldos',       40,  TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Fideos Uchu (Familiar)',   'Caldos',       60,  TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Coca Cola 2L',             'Refrescos',    15,  TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Coca Cola Personal',       'Refrescos',    8,   TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Agua',                     'Refrescos',    5,   TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Fanta / Sprite',           'Refrescos',    8,   TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Cerveza Huari',            'Cervezas',     20,  TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Cerveza Paceña',           'Cervezas',     18,  TRUE, NULL),
  (gen_random_uuid()::TEXT, 'Cerveza Ducal',            'Cervezas',     18,  TRUE, NULL)
ON CONFLICT DO NOTHING;
