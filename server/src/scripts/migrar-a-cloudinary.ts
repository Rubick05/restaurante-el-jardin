import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const isSupabaseUrl = (url: any): boolean => {
    return typeof url === 'string' && url.includes('supabase.co');
};

async function subirACloudinary(url: string, folder: string): Promise<string> {
    console.log(`⏳ Subiendo a Cloudinary: ${url}`);
    const uploadRes = await cloudinary.uploader.upload(url, {
        folder: folder,
        resource_type: 'auto'
    });
    console.log(`✅ Subido con éxito: ${uploadRes.secure_url}`);
    return uploadRes.secure_url;
}

async function migrar() {
    const connectionString = process.env.DATABASE_URL;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!connectionString) {
        console.error('❌ Error: DATABASE_URL no está configurada.');
        process.exit(1);
    }

    if (!cloudName || !apiKey || !apiSecret) {
        console.error('❌ Error: Debes configurar CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el .env');
        process.exit(1);
    }

    console.log('🔌 Conectando a la base de datos...');
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Conexión establecida.');

        // 1. Elementos de menú
        console.log('\n--- Migrando platos del menú ---');
        const resMenu = await client.query(
            "SELECT id, nombre, url_imagen FROM elementos_menu WHERE url_imagen LIKE '%supabase.co%'"
        );
        console.log(`Se encontraron ${resMenu.rows.length} platos con imágenes en Supabase.`);

        for (const row of resMenu.rows) {
            try {
                const nuevaUrl = await subirACloudinary(row.url_imagen, 'menu');
                await client.query(
                    "UPDATE elementos_menu SET url_imagen = $1 WHERE id = $2",
                    [nuevaUrl, row.id]
                );
                console.log(`Plato "${row.nombre}" migrado.`);
            } catch (err: any) {
                console.error(`❌ Error migrando plato "${row.nombre}":`, err.message);
            }
        }

        // 2. Promociones
        console.log('\n--- Migrando promociones ---');
        const resPromos = await client.query(
            "SELECT id, titulo, imagen_url FROM promociones WHERE imagen_url LIKE '%supabase.co%'"
        );
        console.log(`Se encontraron ${resPromos.rows.length} promociones con imágenes en Supabase.`);

        for (const row of resPromos.rows) {
            try {
                const nuevaUrl = await subirACloudinary(row.imagen_url, 'promociones');
                await client.query(
                    "UPDATE promociones SET imagen_url = $1 WHERE id = $2",
                    [nuevaUrl, row.id]
                );
                console.log(`Promo "${row.titulo}" migrada.`);
            } catch (err: any) {
                console.error(`❌ Error migrando promo "${row.titulo}":`, err.message);
            }
        }

        // 3. Web Config (QR de Pago, Hero Slides, Galeria Mosaico)
        console.log('\n--- Migrando configuraciones web (web_config) ---');
        const resConfig = await client.query("SELECT clave, valor FROM web_config");
        
        for (const row of resConfig.rows) {
            let modificado = false;
            let valor = row.valor;

            if (row.clave === 'qr_pago') {
                if (valor && isSupabaseUrl(valor.imagen)) {
                    try {
                        const nuevaUrl = await subirACloudinary(valor.imagen, 'config');
                        valor.imagen = nuevaUrl;
                        modificado = true;
                        console.log('QR de Pago migrado.');
                    } catch (err: any) {
                        console.error('❌ Error migrando QR de pago:', err.message);
                    }
                }
            } else if (row.clave === 'hero_slides') {
                if (Array.isArray(valor)) {
                    const nuevosSlides: string[] = [];
                    for (const slide of valor) {
                        if (isSupabaseUrl(slide)) {
                            try {
                                const nuevaUrl = await subirACloudinary(slide, 'hero');
                                nuevosSlides.push(nuevaUrl);
                                modificado = true;
                            } catch (err: any) {
                                console.error(`❌ Error migrando slide:`, err.message);
                                nuevosSlides.push(slide); // Mantener el original si falla
                            }
                        } else {
                            nuevosSlides.push(slide);
                        }
                    }
                    valor = nuevosSlides;
                }
            } else if (row.clave === 'galeria_mosaico') {
                if (Array.isArray(valor)) {
                    const nuevaGaleria: any[] = [];
                    for (const item of valor) {
                        if (item && isSupabaseUrl(item.src)) {
                            try {
                                const nuevaUrl = await subirACloudinary(item.src, 'galeria');
                                item.src = nuevaUrl;
                                modificado = true;
                            } catch (err: any) {
                                console.error(`❌ Error migrando item de galería mosaico:`, err.message);
                            }
                        }
                        nuevaGaleria.push(item);
                    }
                    valor = nuevaGaleria;
                }
            }

            if (modificado) {
                await client.query(
                    "UPDATE web_config SET valor = $1::jsonb, actualizado_en = NOW() WHERE clave = $2",
                    [JSON.stringify(valor), row.clave]
                );
                console.log(`Clave de configuración "${row.clave}" actualizada.`);
            }
        }

        console.log('\n🎉 ¡Proceso de migración a Cloudinary finalizado!');

    } catch (error: any) {
        console.error('❌ Error general durante la migración:', error);
    } finally {
        await client.end();
    }
}

migrar();
