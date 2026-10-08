/**
 * Utilidad de compresión y redimensionamiento en el navegador del cliente.
 * Reduce fotos pesadas de celulares (5MB - 20MB) a menos de 500KB sin perder nitidez de texto.
 * Evita el error 413 "Request Entity Too Large" de Vercel (límite de 4.5MB).
 */

export async function compressAndResizeImage(
  file: File, 
  maxDimension = 1600, 
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const src = event.target?.result as string;
      compressAndResizeDataUrl(src, maxDimension, quality)
        .then(resolve)
        .catch(reject);
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo desde el dispositivo.'));
    };

    reader.readAsDataURL(file);
  });
}

export async function compressAndResizeDataUrl(
  dataUrl: string,
  maxDimension = 1600,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Mantener proporción de aspecto
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const optimizedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(optimizedBase64);
    };

    img.onerror = () => {
      reject(new Error('No se pudo procesar la imagen.'));
    };

    img.src = dataUrl;
  });
}
