import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';

const router = Router();

// Configurar Cloudinary usando variables de entorno
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// POST /api/imagenes/upload
router.post('/upload', async (req, res) => {
    try {
        const { imagen_base64 } = req.body;

        if (!imagen_base64) {
            return res.status(400).json({ error: 'No se recibió ninguna imagen en formato base64' });
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !apiKey || !apiSecret) {
            console.error('⚠️ Cloudinary: Las variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY o CLOUDINARY_API_SECRET no están configuradas.');
            return res.status(500).json({ 
                error: 'El almacenamiento de Cloudinary no está configurado en el servidor. Configura las claves de Cloudinary.' 
            });
        }

        console.log(`📤 Subiendo archivo a Cloudinary...`);

        // Subir directamente el base64 data URL
        const uploadResponse = await cloudinary.uploader.upload(imagen_base64, {
            folder: 'imagenes',
            resource_type: 'auto' // Detecta y soporta imágenes y videos de forma automática
        });

        console.log(`✅ Archivo subido exitosamente. URL Pública: ${uploadResponse.secure_url}`);

        res.json({ url: uploadResponse.secure_url });
    } catch (error: any) {
        console.error('❌ Error en el proceso de subida de imagen a Cloudinary:', error);
        res.status(500).json({ error: error.message || 'Error interno al procesar e intentar subir la imagen' });
    }
});

export default router;
