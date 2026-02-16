import dotenv from 'dotenv';
import path from 'path';

// Cargar .env root
const pathEnv = path.resolve(__dirname, '../../../.env');
console.log('Ruta .env:', pathEnv);
const result = dotenv.config({ path: pathEnv });

if (result.error) {
    console.error('❌ Error cargando .env:', result.error);
} else {
    console.log('✅ .env cargado correctamente');
}

const dbUrl = process.env.DATABASE_URL;

console.log('--- Diagnóstico ---');
console.log('DATABASE_URL existe:', !!dbUrl);
console.log('Longitud:', dbUrl?.length);
if (dbUrl) {
    console.log('Empieza con:', dbUrl.substring(0, 15) + '...');
    // Check common mistakes
    if (dbUrl.includes('"') || dbUrl.includes("'")) {
        console.warn('⚠️ ADVERTENCIA: La URL contiene comillas. Elimínalas del archivo .env');
    }
    if (dbUrl.startsWith('DATABASE_URL=')) {
        console.warn('⚠️ ADVERTENCIA: La URL incluye el nombre de la variable. Bórralo.');
    }
} else {
    console.error('❌ DATABASE_URL es undefined');
}
