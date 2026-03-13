import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

import { USUARIOS_SISTEMA } from '../../src/lib/auth/usuarios';

// ─── Auto-migración: crea las tablas si no existen al iniciar ─────────────────
export async function inicializarBaseDeDatos() {
    const client = await pool.connect();
    try {
        console.log('🗄️  Iniciando migración automática...');

        await client.query(`
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

            CREATE TABLE IF NOT EXISTS pedidos (
                id              TEXT        PRIMARY KEY,
                id_restaurante  TEXT        NOT NULL DEFAULT 'demo-tenant',
                id_mesero       TEXT,
                numero_ficha    INTEGER     NOT NULL DEFAULT 0,
                numero_letrero  INTEGER,
                estado          TEXT        NOT NULL DEFAULT 'pendiente',
                subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
                total           NUMERIC(10,2) NOT NULL DEFAULT 0,
                datos_facturacion JSONB,
                notas           TEXT,
                creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

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
                instrucciones       TEXT,
                creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS dias_cerrados (
                id              TEXT        PRIMARY KEY,
                fecha           TEXT        NOT NULL,
                total_recaudado NUMERIC(10,2) NOT NULL DEFAULT 0,
                total_pedidos   INTEGER     NOT NULL DEFAULT 0,
                total_items     INTEGER     NOT NULL DEFAULT 0,
                pedidos_snapshot JSONB,
                cerrado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS promociones (
                id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
                tipo            TEXT        NOT NULL CHECK (tipo IN ('imagen', 'video')),
                datos_base64    TEXT        NOT NULL,
                badge           TEXT,
                titulo          TEXT,
                subtitulo       TEXT,
                orden           INTEGER     NOT NULL DEFAULT 0,
                creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS usuarios (
                id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
                nombre          TEXT        NOT NULL,
                usuario         TEXT        NOT NULL UNIQUE,
                password        TEXT        NOT NULL,
                rol             TEXT        NOT NULL CHECK (rol IN ('administrador', 'cocinero', 'camarero')),
                creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
            CREATE INDEX IF NOT EXISTS idx_pedidos_creado ON pedidos(creado_en);
            CREATE INDEX IF NOT EXISTS idx_items_pedido   ON items_pedido(id_pedido);
            CREATE INDEX IF NOT EXISTS idx_menu_disponible ON elementos_menu(disponible);
            CREATE INDEX IF NOT EXISTS idx_promociones_orden ON promociones(orden);
        `);

        // Insertar usuarios por defecto si la tabla está vacía
        const resUsuarios = await client.query('SELECT COUNT(*) FROM usuarios');
        if (parseInt(resUsuarios.rows[0].count) === 0) {
            console.log('👤 Cargando usuarios iniciales...');
            for (const u of USUARIOS_SISTEMA) {
                await client.query(
                    \`INSERT INTO usuarios (id, nombre, usuario, password, rol) VALUES ($1, $2, $3, $4, $5)\`,
                    [u.id, u.nombre, u.usuario, u.password, u.rol]
                );
            }
            console.log('✅ Usuarios iniciales cargados');
        }

        // Insertar menú inicial solo si la tabla está vacía
        const { rows } = await client.query('SELECT COUNT(*) FROM elementos_menu');
        if (parseInt(rows[0].count) === 0) {
            console.log('🍽️  Cargando menú inicial...');
            await client.query(`
                INSERT INTO elementos_menu(id, nombre, categoria, precio_actual, disponible, descripcion) VALUES
                    (gen_random_uuid():: TEXT, 'Pique (Media)', 'Plato Fuerte', 80, TRUE, 'Media porción'),
                    (gen_random_uuid():: TEXT, 'Pique (Entero)', 'Plato Fuerte', 120, TRUE, 'Porción entera'),
                    (gen_random_uuid():: TEXT, 'Charque (Media)', 'Plato Fuerte', 80, TRUE, 'Media porción'),
                (gen_random_uuid():: TEXT, 'Charque (Entero)', 'Plato Fuerte', 120, TRUE, 'Porción entera'),
                (gen_random_uuid():: TEXT, 'Planchita (Media)', 'Plato Fuerte', 80, TRUE, 'Media porción'),
                (gen_random_uuid():: TEXT, 'Planchita (Entera)', 'Plato Fuerte', 120, TRUE, 'Porción entera'),
                (gen_random_uuid():: TEXT, 'Jatun Pampaku', 'Plato Fuerte', 110, TRUE, 'Especialidad de la casa'),
                (gen_random_uuid():: TEXT, 'Lambreado de Conejo', 'Plato Fuerte', 80, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Alitas', 'Plato Fuerte', 25, TRUE, 'Porción de alitas'),
                (gen_random_uuid():: TEXT, 'Escabeche de Pollo', 'Plato Fuerte', 50, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Lomito Borracho', 'Caldos', 30, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Kawi', 'Caldos', 20, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Fideos Uchu (Personal)', 'Caldos', 40, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Fideos Uchu (Familiar)', 'Caldos', 60, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Coca Cola 2L', 'Refrescos', 15, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Coca Cola Personal', 'Refrescos', 8, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Agua', 'Refrescos', 5, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Fanta / Sprite', 'Refrescos', 8, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Cerveza Huari', 'Cervezas', 20, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Cerveza Paceña', 'Cervezas', 18, TRUE, NULL),
                (gen_random_uuid():: TEXT, 'Cerveza Ducal', 'Cervezas', 18, TRUE, NULL)
                `);
            console.log('✅ Menú inicial cargado (21 items)');
        }

        console.log('✅ Base de datos lista');
    } catch (err) {
        console.error('❌ Error en migración:', err);
        // No lanzamos el error para no bloquear el servidor si BD no está lista
    } finally {
        client.release();
    }
}
