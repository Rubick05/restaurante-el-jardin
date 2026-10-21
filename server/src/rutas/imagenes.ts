import { Router } from 'express';
import { subirAImgBB } from '../utils/imgbb.js';
import { cloudinary } from '../utils/cloudinary.js';

const router = Router();

// POST /api/imagenes/upload
router.post('/upload', async (req, res) => {
    try {
        const { imagen_base64, nombre } = req.body;

        if (!imagen_base64) {
            return res.status(400).json({ error: 'No se recibió ninguna imagen en formato base64' });
        }

        const esVideo = typeof imagen_base64 === 'string' && imagen_base64.startsWith('data:video/');

        // Si es video, ImgBB solo soporta imágenes; usamos Cloudinary si está configurado
        if (esVideo) {
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
            const apiKey = process.env.CLOUDINARY_API_KEY;
            const apiSecret = process.env.CLOUDINARY_API_SECRET;

            if (cloudName && apiKey && apiSecret) {
                console.log('🎥 Detectado archivo de video. Subiendo a Cloudinary...');
                const uploadResponse = await cloudinary.uploader.upload(imagen_base64, {
                    folder: 'videos',
                    resource_type: 'video'
                });
                return res.json({ url: uploadResponse.secure_url });
            } else {
                return res.status(400).json({ 
                    error: 'Los videos requieren almacenamiento de Cloudinary configurado en el servidor.' 
                });
            }
        }

        // Subida de imagen a ImgBB como proveedor principal
        console.log('📤 Subiendo imagen a ImgBB...');
        try {
            const resultadoImgBB = await subirAImgBB(imagen_base64, nombre);
            console.log(`✅ Imagen subida exitosamente a ImgBB: ${resultadoImgBB.url}`);
            return res.json({ 
                url: resultadoImgBB.url,
                display_url: resultadoImgBB.display_url,
                thumb_url: resultadoImgBB.thumb_url,
                delete_url: resultadoImgBB.delete_url
            });
        } catch (imgbbError: any) {
            console.warn('⚠️ Falló la subida a ImgBB:', imgbbError.message);

            // Fallback a Cloudinary si está disponible
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
            const apiKey = process.env.CLOUDINARY_API_KEY;
            const apiSecret = process.env.CLOUDINARY_API_SECRET;

            if (cloudName && apiKey && apiSecret) {
                console.log('🔄 Intentando subida de respaldo a Cloudinary...');
                const uploadResponse = await cloudinary.uploader.upload(imagen_base64, {
                    folder: 'imagenes',
                    resource_type: 'image'
                });
                console.log(`✅ Imagen subida a Cloudinary como respaldo: ${uploadResponse.secure_url}`);
                return res.json({ url: uploadResponse.secure_url });
            }

            throw imgbbError;
        }
    } catch (error: any) {
        console.error('❌ Error en el proceso de subida de imagen:', error);
        res.status(500).json({ error: error.message || 'Error interno al procesar e intentar subir la imagen' });
    }
});

export default router;
