import { API_BASE_URL } from '@/hooks/useInicializacion';

/**
 * Utilidades de procesamiento y subida de imágenes.
 * Comprime imágenes del lado del cliente usando Canvas API antes de
 * subirlas o almacenarlas, reduciendo significativamente el tamaño y optimizando la carga.
 */

/**
 * Comprime una imagen usando Canvas API.
 * Redimensiona a maxWidth conservando la proporción y aplica calidad JPEG.
 * Para videos u otros archivos no-imagen, retorna el base64 original sin modificar.
 * 
 * @param file     Archivo de imagen a comprimir
 * @param maxWidth Ancho máximo en píxeles (por defecto 750px)
 * @param quality  Calidad JPEG 0.0–1.0 (por defecto 0.70)
 * @returns        Base64 data URL de la imagen comprimida
 */
export async function comprimirImagen(
  file: File,
  maxWidth = 750,
  quality = 0.70
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Para archivos no-imagen (videos, etc.), leer directamente sin comprimir
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer la imagen'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Error al procesar la imagen'));
      img.onload = () => {
        let { width, height } = img;

        // Redimensionar si supera el ancho máximo
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible en este navegador'));
          return;
        }

        // Fondo blanco para imágenes PNG con transparencia
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Optimiza URLs de imágenes (especialmente Cloudinary) inyectando f_auto, q_auto y ancho límite.
 */
export function optimizarUrlImagen(url?: string | null, width = 800): string {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:') || (url.startsWith('/') && !url.startsWith('//'))) return url;

  if (url.includes('cloudinary.com') && url.includes('/image/upload/')) {
    if (!url.includes('f_auto') && !url.includes('q_auto')) {
      return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width},c_limit/`);
    }
  }

  return url;
}

/**
 * Valida el tamaño de un archivo y muestra un error si es demasiado grande.
 * @param file      Archivo a validar
 * @param maxMB     Tamaño máximo en MB (por defecto 15MB)
 * @returns         true si el archivo es válido
 */
export function validarTamañoArchivo(file: File, maxMB = 15): boolean {
  const maxBytes = maxMB * 1024 * 1024;
  if (file.size > maxBytes) {
    alert(`El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). El máximo permitido es ${maxMB}MB.`);
    return false;
  }
  return true;
}

export interface ResultadoSubidaImagen {
  url: string;
  thumb_url?: string;
  display_url?: string;
}

/**
 * Sube una imagen optimizada a ImgBB.
 * Intenta primero la subida directa a la API de ImgBB para máxima velocidad
 * y menor consumo de recursos del servidor. Si es video o hay fallo de red,
 * delega la subida al endpoint del servidor backend (/api/imagenes/upload).
 * 
 * @param imagenBase64 Cadena data URL o base64 de la imagen
 * @param nombre       Nombre opcional para el archivo
 */
export async function subirImagenAImgBB(
  imagenBase64: string,
  nombre?: string
): Promise<ResultadoSubidaImagen> {
  const esVideo = typeof imagenBase64 === 'string' && imagenBase64.startsWith('data:video/');
  const imgbbApiKey = (import.meta.env.VITE_IMGBB_API_KEY as string) || '424027c5531739d483f18832dced19c9';

  // Si no es un video, intentamos primero subir directo a ImgBB para acelerar la carga
  if (!esVideo && imgbbApiKey) {
    try {
      const limpia = imagenBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
      const params = new URLSearchParams();
      params.append('image', limpia);
      if (nombre) params.append('name', nombre);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.url) {
          return {
            url: json.data.url,
            display_url: json.data.display_url,
            thumb_url: json.data.thumb?.url
          };
        }
      }
    } catch (directError) {
      console.warn('Subida directa a ImgBB falló, usando endpoint del backend como alternativa...', directError);
    }
  }

  // Fallback: subida a través del backend (/api/imagenes/upload)
  const res = await fetch(`${API_BASE_URL}/api/imagenes/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagen_base64: imagenBase64, nombre })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Error al subir la imagen');
  }

  const data = await res.json();
  return {
    url: data.url,
    thumb_url: data.thumb_url,
    display_url: data.display_url
  };
}
