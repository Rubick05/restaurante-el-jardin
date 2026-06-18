import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function migrarDatos() {
    // Obtener URIs de conexión desde los argumentos
    const sourceUrl = process.argv[2];
    const targetUrl = process.argv[3];

    if (!sourceUrl || !targetUrl) {
        console.error('\n❌ Error: Debes proporcionar ambas cadenas de conexión.');
        console.error('Uso: npx ts-node src/scripts/migrar-datos.ts "URL_ORIGEN_RAILWAY" "URL_DESTINO_SUPABASE"');
        console.error('\nEjemplo:');
        console.error('npx ts-node src/scripts/migrar-datos.ts "postgresql://postgres:...@metro.proxy.rlwy.net:12352/railway" "postgresql://postgres:...@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require"\n');
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

        // Inicializar esquema de tablas en Supabase antes de vaciar
        const rutaSchema = path.resolve(__dirname, '../../../database/esquema.sql');
        if (fs.existsSync(rutaSchema)) {
            console.log('📝 Inicializando esquema de tablas en Supabase...');
            const sql = fs.readFileSync(rutaSchema, 'utf-8');
            await clientDest.query(sql);
            console.log('✅ Esquema inicializado correctamente en Supabase.');
        } else {
            console.warn('⚠️ No se encontró el archivo de esquema.sql en', rutaSchema);
        }

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

        console.log('🧹 Vaciando tablas en la base de datos de destino...');
        // Vaciamos en sentido inverso para evitar errores de claves foráneas
        for (let i = tablas.length - 1; i >= 0; i--) {
            const tabla = tablas[i];
            console.log(`   Vaciando tabla ${tabla}...`);
            await clientDest.query(`TRUNCATE TABLE "${tabla}" CASCADE`);
        }
        console.log('✅ Base de datos de destino limpia y lista para recibir datos.');

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
