import { Router } from 'express';

const router = Router();

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

// POST /api/imagenes/upload
router.post('/upload', async (req, res) => {
    try {
        const { imagen_base64 } = req.body;

        if (!imagen_base64) {
            return res.status(400).json({ error: 'No se recibió ninguna imagen en formato base64' });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('⚠️ Supabase Storage: Las variables SUPABASE_URL o SUPABASE_ANON_KEY no están configuradas.');
            return res.status(500).json({ 
                error: 'El almacenamiento de Supabase no está configurado en el servidor. Configura SUPABASE_URL y SUPABASE_ANON_KEY.' 
            });
        }

        const parsed = parseBase64(imagen_base64);
        if (!parsed) {
            return res.status(400).json({ error: 'El formato base64 de la imagen es inválido' });
        }

        const { mimeType, buffer } = parsed;
        const ext = MIME_TO_EXT[mimeType] || 'jpg';
        const filename = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

        // Normalizar URL eliminando barras diagonales al final si las tiene
        const normalizedSupabaseUrl = supabaseUrl.replace(/\/+$/, '');
        const uploadUrl = `${normalizedSupabaseUrl}/storage/v1/object/imagenes/${filename}`;

        console.log(`📤 Subiendo archivo ${filename} (${mimeType}) a Supabase Storage...`);

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
            console.error(`❌ Error en la API de Supabase Storage: Code ${response.status} - ${errText}`);
            return res.status(500).json({ 
                error: `Error al subir imagen a Supabase Storage: ${response.status} - ${errText}` 
            });
        }

        const publicUrl = `${normalizedSupabaseUrl}/storage/v1/object/public/imagenes/${filename}`;
        console.log(`✅ Archivo subido exitosamente. URL Pública: ${publicUrl}`);

        res.json({ url: publicUrl });
    } catch (error: any) {
        console.error('❌ Error en el proceso de subida de imagen:', error);
        res.status(500).json({ error: error.message || 'Error interno al procesar e intentar subir la imagen' });
    }
});

export default router;
