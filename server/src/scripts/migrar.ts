import { pool } from '../bd/pool';
import fs from 'fs';
import path from 'path';

async function migrar() {
    try {
        console.log('📦 Iniciando migración a Railway PostgreSQL...');

        // Buscar el archivo SQL en la raíz del proyecto
        const rutaSchema = path.resolve(__dirname, '../../../database/esquema.sql');

        if (!fs.existsSync(rutaSchema)) {
            throw new Error(`No se encontró el archivo de esquema en: ${rutaSchema}`);
        }

        const sql = fs.readFileSync(rutaSchema, 'utf-8');

        console.log('📝 Ejecutando script SQL...');
        await pool.query(sql);

        console.log('✅ ¡Migración completada con éxito!');
        console.log('🚀 Tu base de datos en la nube ya tiene las tablas listas.');
    } catch (error) {
        console.error('❌ Error en la migración:', error);
    } finally {
        await pool.end();
    }
}

migrar();
