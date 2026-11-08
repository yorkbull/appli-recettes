// Photo réduite à 1 200 px et compressée en JPEG (environ 180 Ko) avant d'être enregistrée
export async function compresserPhoto(fichier: Blob, max = 1200, cible = 180_000): Promise<string> {
  const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  let q = 0.82;
  let url = c.toDataURL('image/jpeg', q);
  while (url.length * 0.75 > cible && q > 0.5) { q -= 0.08; url = c.toDataURL('image/jpeg', q); }
  return url;
}
