/**
 * Utility to load the logo as base64 for PDF embedding.
 * We load it once and cache it as a data URL for jsPDF.
 */
import logoUrl from '../assets/logo.png';

let cachedBase64 = null;

/**
 * Convert the logo to a base64 data URL via a canvas element.
 * Resizes to a small header-friendly size (200x200) to keep PDFs lightweight.
 * Returns a Promise that resolves to a base64 PNG data URL string.
 */
export async function getLogoBase64(size = 200) {
  if (cachedBase64) return cachedBase64;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Draw with white circular background for clean PDF rendering
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.clip();

      // Scale and center the image
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

      cachedBase64 = canvas.toDataURL('image/png');
      resolve(cachedBase64);
    };
    img.onerror = () => {
      console.warn('Could not load logo for PDF');
      resolve(null);
    };
    img.src = logoUrl;
  });
}
