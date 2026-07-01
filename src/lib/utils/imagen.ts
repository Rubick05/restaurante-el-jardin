/**
 * Utilidades de procesamiento de imágenes para el admin panel.
 * Comprime imágenes del lado del cliente usando Canvas API antes de
 * almacenarlas como base64, reduciendo significativamente el tamaño.
 */

/**
 * Comprime una imagen usando Canvas API.
 * Redimensiona a maxWidth conservando la proporción y aplica calidad JPEG.
 * Para videos u otros archivos no-imagen, retorna el base64 original sin modificar.
 * 
 * @param file     Archivo de imagen a comprimir
 * @param maxWidth Ancho máximo en píxeles (por defecto 900px)
 * @param quality  Calidad JPEG 0.0–1.0 (por defecto 0.82)
 * @returns        Base64 data URL de la imagen comprimida
 */
export async function comprimirImagen(
  file: File,
  maxWidth = 900,
  quality = 0.82
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
