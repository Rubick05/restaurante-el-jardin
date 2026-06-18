import { Client } from 'pg';

async function migrarDatos() {
    const sourceUrl = process.argv[2];
    const targetUrl = process.argv[3];

    if (!sourceUrl || !targetUrl) {
        console.error('\n❌ Error: Debes proporcionar ambas cadenas de conexión.');
        console.error('Uso: npx ts-node src/scripts/migrar-datos.ts "URL_ORIGEN_RAILWAY" "URL_DESTINO_SUPABASE"');
        process.exit(1);
    }

    console.log('🔄 Iniciando migración de datos...');
    console.log('🔌 Conectando a la base de datos de origen (Railway)...');
    const clientSrc = new Client({
        connectionString: sourceUrl,
        ssl: sourceUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    console.log('🔌 Conectando a la base de datos de destino (Supabase)...');
    const clientDest = new Client({
        connectionString: targetUrl,
        ssl: targetUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        await clientSrc.connect();
        console.log('✅ Conexión establecida con Origen.');
        await clientDest.connect();
        console.log('✅ Conexión establecida con Destino.');

        console.log('🧹 Limpiando tablas previas incorrectas en Supabase...');
        // Dropear todas las tablas (incluso las del esquema.sql erróneo si existen)
        const dropQueries = [
            'DROP TABLE IF EXISTS items_pedido CASCADE',
            'DROP TABLE IF EXISTS pedidos CASCADE',
            'DROP TABLE IF EXISTS elementos_menu CASCADE',
            'DROP TABLE IF EXISTS usuarios CASCADE',
            'DROP TABLE IF EXISTS dias_cerrados CASCADE',
            'DROP TABLE IF EXISTS promociones CASCADE',
            'DROP TABLE IF EXISTS gastos CASCADE',
            'DROP TABLE IF EXISTS web_config CASCADE',
            'DROP TABLE IF EXISTS mesas CASCADE',
            'DROP TABLE IF EXISTS precios_elementos_menu CASCADE',
            'DROP TABLE IF EXISTS restaurantes CASCADE',
            'DROP TABLE IF EXISTS cola_sincronizacion CASCADE'
        ];
        for (const query of dropQueries) {
            await clientDest.query(query).catch(() => {});
        }
        console.log('✅ Base de datos de destino limpia.');

        console.log('📝 Inicializando esquema de base de datos correcto en Supabase...');
        // Crear las tablas con el esquema real usado por la app
        await clientDest.query(`
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

            CREATE TABLE IF NOT EXISTS promociones (
                id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
                titulo          TEXT        NOT NULL,
                subtitulo       TEXT,
                badge           TEXT,
                tipo            TEXT        NOT NULL DEFAULT 'imagen',
                imagen_url      TEXT,
                imagen_base64   TEXT,
                fecha_inicio    DATE        NOT NULL DEFAULT CURRENT_DATE,
                fecha_fin       DATE,
                orden           INTEGER     NOT NULL DEFAULT 1,
                creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS gastos (
                id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
                id_restaurante  TEXT        NOT NULL DEFAULT 'demo-tenant',
                descripcion     TEXT        NOT NULL,
                monto           NUMERIC(10,2) NOT NULL,
                categoria       TEXT        NOT NULL,
                fecha           DATE        NOT NULL DEFAULT CURRENT_DATE,
                creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS web_config (
                clave           TEXT        PRIMARY KEY,
                valor           JSONB       NOT NULL,
                actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            ALTER TABLE elementos_menu ADD COLUMN IF NOT EXISTS costo NUMERIC(10,2) NOT NULL DEFAULT 0;
        `);
        console.log('✅ Esquema correcto inicializado en Supabase.');

        // Lista de tablas ordenadas por dependencias de llaves foráneas
        const tablas = [
            'usuarios',
            'elementos_menu',
            'promociones',
            'gastos',
            'web_config',
            'dias_cerrados',
            'pedidos',
            'items_pedido'
        ];

        // Copiar los datos tabla por tabla
        for (const tabla of tablas) {
            console.log(`\n📦 Copiando tabla: ${tabla}...`);
            const { rows } = await clientSrc.query(`SELECT * FROM "${tabla}"`);
            console.log(`   Se encontraron ${rows.length} registros en origen.`);

            if (rows.length === 0) {
                console.log(`   Saltando tabla ${tabla} (vacía).`);
                continue;
            }

            const columnas = Object.keys(rows[0]);
            const columnasString = columnas.map(c => `"${c}"`).join(', ');
            const placeholders = columnas.map((_, idx) => `$${idx + 1}`).join(', ');
            
            const insertQuery = `INSERT INTO "${tabla}" (${columnasString}) VALUES (${placeholders})`;

            let contador = 0;
            for (const row of rows) {
                const valores = columnas.map(c => row[c]);
                await clientDest.query(insertQuery, valores);
                contador++;
            }
            console.log(`   🎉 Completado: ${contador}/${rows.length} registros copiados en ${tabla}.`);
        }

        console.log('\n🌟 ¡Felicidades! La migración de datos ha finalizado con éxito.');
        console.log('🚀 Supabase ya contiene todos los datos de tu restaurante.');

    } catch (err) {
        console.error('\n❌ Error durante el proceso de migración:', err);
    } finally {
        await clientSrc.end().catch(() => {});
        await clientDest.end().catch(() => {});
    }
}

migrarDatos();
