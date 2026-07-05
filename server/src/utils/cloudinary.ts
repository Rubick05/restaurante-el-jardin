import { v2 as cloudinary } from 'cloudinary';

// Configurar Cloudinary usando variables de entorno
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Extrae el public ID de una imagen a partir de su URL de Cloudinary.
 * Ejemplo: https://res.cloudinary.com/cloud_name/image/upload/v12345/folder/name.png -> folder/name
 */
export function obtenerPublicIdCloudinary(url: string | null | undefined): string | null {
    if (!url || !url.includes('res.cloudinary.com')) return null;
    try {
        const parts = url.split('/image/upload/');
        if (parts.length < 2) return null;
        
        // Remover la versión si existe (formato: vXXXXXXXX/)
        const pathPart = parts[1].replace(/^v\d+\//, '');
        
        // Quitar la extensión
        const lastDot = pathPart.lastIndexOf('.');
        if (lastDot === -1) return pathPart;
        return pathPart.substring(0, lastDot);
    } catch (e) {
        console.error('Error al extraer public_id de Cloudinary:', e);
        return null;
    }
}

/**
 * Elimina una imagen de Cloudinary dada su URL pública.
 */
export async function eliminarImagenCloudinary(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const publicId = obtenerPublicIdCloudinary(url);
    if (!publicId) return;
    
    try {
        console.log(`🗑️ Eliminando imagen de Cloudinary: ${publicId}`);
        const res = await cloudinary.uploader.destroy(publicId);
        console.log(`✅ Resultado de eliminación de Cloudinary (${publicId}):`, res.result);
    } catch (err: any) {
        console.error(`❌ Error al eliminar imagen de Cloudinary (${publicId}):`, err.message);
    }
}

export { cloudinary };
