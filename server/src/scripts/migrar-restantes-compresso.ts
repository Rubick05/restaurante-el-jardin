import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { Jimp } from 'jimp';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function descargarYComprimir(url: string): Promise<string> {
    console.log(`⏳ Descargando imagen pesada: ${url}`);
    
    // Descargar imagen como buffer
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error al descargar la imagen (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`⏳ Cargando en Jimp para compresión (Tamaño original: ${(buffer.length / 1024 / 1024).toFixed(2)} MB)...`);
    
    // Leer con Jimp
    const image = await Jimp.read(buffer);
    
    // Redimensionar si es muy ancha (ej. más de 1200px)
    const maxWidth = 1000;
    if (image.width > maxWidth) {
        console.log(`Resize de ${image.width}px a ${maxWidth}px`);
        image.resize({ w: maxWidth });
    }
    
    // Comprimir y obtener buffer JPEG con calidad 75%
    console.log('Comprimiendo a JPEG con calidad 75%...');
    const compressedBuffer = await image.getBuffer('image/jpeg', { quality: 75 });
    console.log(`✅ Compresión completada. Nuevo tamaño: ${(compressedBuffer.length / 1024).toFixed(1)} KB`);
    
    // Subir buffer en formato base64 a Cloudinary
    const base64Data = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
    
    console.log('Subiendo imagen comprimida a Cloudinary...');
    const uploadRes = await cloudinary.uploader.upload(base64Data, {
        folder: 'menu',
        resource_type: 'image'
    });
    
    return uploadRes.secure_url;
}

async function migrarRestantes() {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
        console.error('❌ Error: DATABASE_URL no está configurada.');
        process.exit(1);
    }

    console.log('🔌 Conectando a la base de datos...');
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Conexión establecida. Buscando registros restantes en Supabase...');

        // 1. Obtener platos que sigan en Supabase
        const resMenu = await client.query(
            "SELECT id, nombre, url_imagen FROM elementos_menu WHERE url_imagen LIKE '%supabase.co%'"
        );
        console.log(`Se encontraron ${resMenu.rows.length} platos pendientes de migración.`);

        for (const row of resMenu.rows) {
            try {
                console.log(`\nPlato: "${row.nombre}"`);
                const nuevaUrl = await descargarYComprimir(row.url_imagen);
                await client.query(
                    "UPDATE elementos_menu SET url_imagen = $1 WHERE id = $2",
                    [nuevaUrl, row.id]
                );
                console.log(`✅ Plato "${row.nombre}" migrado con éxito a Cloudinary!`);
            } catch (err: any) {
                console.error(`❌ Error migrando plato "${row.nombre}":`, err.message);
            }
        }

        console.log('\n🎉 ¡Proceso de compresión y migración de restantes finalizado!');

    } catch (error: any) {
        console.error('❌ Error general durante la migración:', error);
    } finally {
        await client.end();
    }
}

migrarRestantes();
