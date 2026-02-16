import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Intentar cargar .env desde la raíz del proyecto (3 niveles arriba desde src/bd)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

// En producción esto vendrá de variables de entorno de Railway
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});
