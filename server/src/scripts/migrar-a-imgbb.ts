import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { subirAImgBB } from '../utils/imgbb';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const esUrlImgBB = (url: any): boolean => {
    return typeof url === 'string' && (url.includes('i.ibb.co') || url.includes('ibb.co'));
};

async function migrar() {
    const connectionString = process.env.DATABASE_URL;
    const apiKey = process.env.IMGBB_API_KEY || '424027c5531739d483f18832dced19c9';

    if (!connectionString) {
        console.error('❌ Error: DATABASE_URL no está configurada.');
        process.exit(1);
    }

    if (!apiKey) {
        console.error('❌ Error: IMGBB_API_KEY no está configurada.');
        process.exit(1);
    }

    console.log('🔌 Conectando a la base de datos PostgreSQL...');
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Conexión establecida con la base de datos.');

        // 1. Migrar elementos del menú
        console.log('\n--- 🍔 Verificando Platos del Menú ---');
        const resMenu = await client.query(
            "SELECT id, nombre, url_imagen, imagen_base64 FROM elementos_menu WHERE (imagen_base64 IS NOT NULL AND length(imagen_base64) > 100) OR (url_imagen IS NOT NULL AND url_imagen NOT LIKE '%ibb.co%')"
        );

        console.log(`Encontrados ${resMenu.rows.length} platos para migrar a ImgBB.`);
        for (const row of resMenu.rows) {
            try {
                const fuente = row.imagen_base64 || row.url_imagen;
                if (!fuente) continue;

                console.log(`⏳ Subiendo a ImgBB plato: "${row.nombre}"...`);
                const resImg = await subirAImgBB(fuente, `menu-${row.id}`);
                const nuevaUrl = resImg.url;

                await client.query(
                    'UPDATE elementos_menu SET url_imagen = $1, imagen_base64 = NULL WHERE id = $2',
                    [nuevaUrl, row.id]
                );
                console.log(`✅ Plato "${row.nombre}" migrado con éxito -> ${nuevaUrl}`);
            } catch (err: any) {
                console.error(`❌ Error migrando plato "${row.nombre}":`, err.message);
            }
        }

        // 2. Migrar promociones
        console.log('\n--- 🏷️ Verificando Promociones ---');
        const resPromo = await client.query(
            "SELECT id, titulo, imagen_url, imagen_base64, tipo FROM promociones WHERE (imagen_base64 IS NOT NULL AND length(imagen_base64) > 100) OR (imagen_url IS NOT NULL AND imagen_url NOT LIKE '%ibb.co%')"
        );

        console.log(`Encontradas ${resPromo.rows.length} promociones para migrar.`);
        for (const row of resPromo.rows) {
            try {
                if (row.tipo === 'video') {
                    console.log(`⏩ Saltando promoción "${row.titulo}" (es video)`);
                    continue;
                }
                const fuente = row.imagen_base64 || row.imagen_url;
                if (!fuente) continue;

                console.log(`⏳ Subiendo a ImgBB promo: "${row.titulo}"...`);
                const resImg = await subirAImgBB(fuente, `promo-${row.id}`);
                const nuevaUrl = resImg.url;

                await client.query(
                    'UPDATE promociones SET imagen_url = $1, imagen_base64 = NULL WHERE id = $2',
                    [nuevaUrl, row.id]
                );
                console.log(`✅ Promo "${row.titulo}" migrada con éxito -> ${nuevaUrl}`);
            } catch (err: any) {
                console.error(`❌ Error migrando promo "${row.titulo}":`, err.message);
            }
        }

        // 3. Migrar configuración web (Logo, QR, Hero slides, Banners)
        console.log('\n--- ⚙️ Verificando Configuración Web (Banners, Logo, QR) ---');
        const resConfig = await client.query('SELECT clave, valor FROM web_config');

        for (const row of resConfig.rows) {
            try {
                let modificado = false;
                const valor = typeof row.valor === 'string' ? JSON.parse(row.valor) : row.valor;

                if (!valor) continue;

                // QR o Logo individual
                if (typeof valor === 'string' && (valor.startsWith('data:image/') || (!esUrlImgBB(valor) && valor.startsWith('http')))) {
                    console.log(`⏳ Subiendo a ImgBB config "${row.clave}"...`);
                    const resImg = await subirAImgBB(valor, `config-${row.clave}`);
                    await client.query('UPDATE web_config SET valor = $1 WHERE clave = $2', [JSON.stringify(resImg.url), row.clave]);
                    console.log(`✅ Config "${row.clave}" actualizada -> ${resImg.url}`);
                    continue;
                }

                // Objeto con propiedad imagen
                if (valor && typeof valor === 'object') {
                    if (valor.imagen && !esUrlImgBB(valor.imagen)) {
                        console.log(`⏳ Subiendo imagen en config: "${row.clave}"...`);
                        const resImg = await subirAImgBB(valor.imagen, `config-${row.clave}`);
                        valor.imagen = resImg.url;
                        modificado = true;
                    }

                    // Hero slides array
                    if (Array.isArray(valor.heroSlides)) {
                        for (let i = 0; i < valor.heroSlides.length; i++) {
                            const slide = valor.heroSlides[i];
                            if (slide && !esUrlImgBB(slide)) {
                                console.log(`⏳ Subiendo hero slide ${i + 1}...`);
                                const resImg = await subirAImgBB(slide, `hero-slide-${i + 1}`);
                                valor.heroSlides[i] = resImg.url;
                                modificado = true;
                            }
                        }
                    }

                    if (modificado) {
                        await client.query('UPDATE web_config SET valor = $1 WHERE clave = $2', [JSON.stringify(valor), row.clave]);
                        console.log(`✅ Config "${row.clave}" guardada con nuevas URLs de ImgBB.`);
                    }
                }
            } catch (err: any) {
                console.error(`❌ Error en configuración "${row.clave}":`, err.message);
            }
        }

        console.log('\n🎉 ¡Proceso de migración a ImgBB finalizado con éxito!');
    } catch (err: any) {
        console.error('❌ Error general durante la migración:', err);
    } finally {
        await client.end();
    }
}

migrar();
