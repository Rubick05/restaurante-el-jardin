/**
 * Utilidad para interactuar con la API de ImgBB
 * Permite subir imágenes de forma rápida y obtener URLs públicas directas en CDN (i.ibb.co)
 */

export interface ImgBBUploadResult {
    id: string;
    url: string;
    display_url: string;
    delete_url?: string;
    thumb_url?: string;
    width?: number;
    height?: number;
    size?: number;
}

/**
 * Sube una imagen a ImgBB.
 * @param imagen Cadena base64 (con o sin prefijo data:image/...), URL remota o Buffer.
 * @param nombre Nombre opcional para el archivo.
 * @returns Datos de la imagen alojada en ImgBB.
 */
export async function subirAImgBB(imagen: string | Buffer, nombre?: string): Promise<ImgBBUploadResult> {
    const apiKey = process.env.IMGBB_API_KEY || '424027c5531739d483f18832dced19c9';

    if (!apiKey) {
        throw new Error('IMGBB_API_KEY no está configurada en las variables de entorno.');
    }

    let base64Limpia: string;

    if (Buffer.isBuffer(imagen)) {
        base64Limpia = imagen.toString('base64');
    } else if (typeof imagen === 'string') {
        // Si viene con prefijo Data URL ej. data:image/png;base64,... lo limpiamos
        const match = imagen.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
        if (match) {
            base64Limpia = match[1];
        } else {
            base64Limpia = imagen;
        }
    } else {
        throw new Error('Formato de imagen inválido para subir a ImgBB.');
    }

    const params = new URLSearchParams();
    params.append('image', base64Limpia);
    if (nombre) {
        params.append('name', nombre);
    }

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RestaurantePelusa/1.0',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
    });

    const data: any = await response.json();

    if (!response.ok || !data.success) {
        const errorMsg = data?.error?.message || `Error en ImgBB HTTP ${response.status}`;
        console.error('❌ Error devuelto por ImgBB:', data);
        throw new Error(`ImgBB API Error: ${errorMsg}`);
    }

    const resData = data.data;

    return {
        id: resData.id,
        url: resData.url, // URL directa ej: https://i.ibb.co/DxqTVN7/nombre.png
        display_url: resData.display_url,
        delete_url: resData.delete_url,
        thumb_url: resData.thumb?.url,
        width: resData.width,
        height: resData.height,
        size: resData.size
    };
}
