// Lecture du texte d'une photo (page de livre, fiche, capture d'écran) directement sur le téléphone.
// Le moteur (Tesseract) et le dictionnaire français sont téléchargés à la première utilisation (quelques Mo),
// d'où le chargement à la demande : le reste de l'appli n'est pas alourdi.
export async function lireTexteImage(fichier: Blob, progres?: (p: number) => void): Promise<string> {
  const image = await preparer(fichier);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('fra', 1, {
    logger: m => { if (m.status === 'recognizing text') progres?.(m.progress); },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// Photo remise droite (orientation du téléphone), réduite à 2 000 px et passée en niveaux de gris :
// la lecture est plus rapide et plus fiable.
async function preparer(fichier: Blob, max = 2000): Promise<Blob> {
  const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d')!;
  ctx.filter = 'grayscale(1) contrast(1.2)';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('image')), 'image/png'));
}
