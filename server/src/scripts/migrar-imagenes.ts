import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm'
};

function parseBase64(base64String: string) {
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return null;
    }
    return {
        mimeType: matches[1],
        buffer: Buffer.from(matches[2], 'base64')
    };
}

async function subirASupabase(base64: string, supabaseUrl: string, supabaseKey: string, prefijo: string): Promise<string> {
    const parsed = parseBase64(base64);
    if (!parsed) {
        throw new Error('Base64 inválido');
    }

    const { mimeType, buffer } = parsed;
    const ext = MIME_TO_EXT[mimeType] || 'jpg';
    const filename = `${prefijo}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const normalizedSupabaseUrl = supabaseUrl.replace(/\/+$/, '');
    const uploadUrl = `${normalizedSupabaseUrl}/storage/v1/object/imagenes/${filename}`;

    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': mimeType
        },
        body: buffer
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Error Supabase API (${response.status}): ${errText}`);
    }

    return `${normalizedSupabaseUrl}/storage/v1/object/public/imagenes/${filename}`;
}

async function migrar() {
    const connectionString = process.env.DATABASE_URL;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!connectionString) {
        console.error('❌ Error: DATABASE_URL no está configurada.');
        process.exit(1);
    }

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Error: Debes configurar SUPABASE_URL y SUPABASE_ANON_KEY en tu entorno o archivo .env');
        process.exit(1);
    }

    console.log('🔌 Conectando a la base de datos...');
    const client = new Client({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Conexión establecida.');

        // 1. Migrar elementos_menu
        console.log('\n--- Migrando imágenes de Elementos de Menú ---');
        const resMenu = await client.query(
            "SELECT id, nombre, imagen_base64 FROM elementos_menu WHERE imagen_base64 IS NOT NULL AND imagen_base64 != ''"
        );
        console.log(`Se encontraron ${resMenu.rows.length} platos con imágenes base64.`);

        for (const row of resMenu.rows) {
            try {
                console.log(`⏳ Subiendo imagen de: "${row.nombre}"...`);
                const urlPublica = await subirASupabase(row.imagen_base64, supabaseUrl, supabaseKey, 'plato');
                
                await client.query(
                    "UPDATE elementos_menu SET url_imagen = $1, imagen_base64 = NULL WHERE id = $2",
                    [urlPublica, row.id]
                );
                console.log(`✅ Migrado: "${row.nombre}" -> ${urlPublica}`);
            } catch (err: any) {
                console.error(`❌ Error migrando "${row.nombre}":`, err.message);
            }
        }

        // 2. Migrar promociones
        console.log('\n--- Migrando imágenes de Promociones ---');
        const resPromos = await client.query(
            "SELECT id, titulo, imagen_base64 FROM promociones WHERE imagen_base64 IS NOT NULL AND imagen_base64 != ''"
        );
        console.log(`Se encontraron ${resPromos.rows.length} promociones con imágenes base64.`);

        for (const row of resPromos.rows) {
            try {
                console.log(`⏳ Subiendo imagen de promo: "${row.titulo}"...`);
                const urlPublica = await subirASupabase(row.imagen_base64, supabaseUrl, supabaseKey, 'promo');
                
                await client.query(
                    "UPDATE promociones SET imagen_url = $1, imagen_base64 = NULL WHERE id = $2",
                    [urlPublica, row.id]
                );
                console.log(`✅ Migrado: "${row.titulo}" -> ${urlPublica}`);
            } catch (err: any) {
                console.error(`❌ Error migrando promo "${row.titulo}":`, err.message);
            }
        }

        // 3. Migrar QR de Pago en web_config
        console.log('\n--- Migrando QR de Pago de web_config ---');
        const resConfig = await client.query(
            "SELECT clave, valor FROM web_config WHERE clave = 'qr_pago'"
        );

        if (resConfig.rows.length > 0) {
            const qrPago = resConfig.rows[0].valor;
            if (qrPago && qrPago.imagen && qrPago.imagen.startsWith('data:')) {
                try {
                    console.log('⏳ Subiendo imagen de QR de pago...');
                    const urlPublica = await subirASupabase(qrPago.imagen, supabaseUrl, supabaseKey, 'qr-pago');
                    
                    const nuevoValor = {
                        imagen: urlPublica,
                        fecha: qrPago.fecha || new Date().toISOString()
                    };

                    await client.query(
                        "UPDATE web_config SET valor = $1::jsonb, actualizado_en = NOW() WHERE clave = 'qr_pago'",
                        [JSON.stringify(nuevoValor)]
                    );
                    console.log(`✅ Migrado QR de pago -> ${urlPublica}`);
                } catch (err: any) {
                    console.error('❌ Error migrando QR de pago:', err.message);
                }
            } else {
                console.log('ℹ️ El QR de pago ya es una URL o no contiene base64.');
            }
        } else {
            console.log('ℹ️ No se encontró configuración de QR de pago.');
        }

        console.log('\n🎉 ¡Migración de imágenes completada!');

    } catch (error: any) {
        console.error('❌ Error general durante la migración:', error);
    } finally {
        await client.end();
    }
}

migrar();
