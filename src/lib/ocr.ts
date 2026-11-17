// Lecture du texte d'une photo (page de livre, fiche, capture d'écran) directement sur le téléphone.
// Le moteur (Tesseract) et le dictionnaire français sont téléchargés à la première utilisation (quelques Mo),
// d'où le chargement à la demande : le reste de l'appli n'est pas alourdi.
//
// Une page de recette est faite de blocs (titre, ingrédients, étapes…), souvent sur deux colonnes, avec des photos.
// La mise en page automatique de Tesseract perd souvent le titre (collé à la photo) ou mélange deux colonnes
// sur une même ligne. On lui demande donc seulement de trouver les mots (mode « texte épars »),
// puis on refait la mise en page à partir de la position de chaque mot : lignes, colonnes, paragraphes.

export interface Paragraphe {
  lignes: string[];
  hauteur: number; // hauteur moyenne des lignes, en pixels (grand = titre)
  haut: number;
  gauche: number;
  groupe: number; // colonne (ou bloc pleine largeur) d'où vient le paragraphe, dans l'ordre de lecture
}

type Boite = { x0: number; y0: number; x1: number; y1: number };
export interface Mot { texte: string; conf: number; bbox: Boite }
interface Morceau { mots: Mot[]; x0: number; x1: number; y0: number; y1: number; h: number }

export async function lirePhoto(fichier: Blob, progres?: (p: number) => void): Promise<Paragraphe[]> {
  const { image, largeur } = await preparer(fichier);
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('fra', 1, {
    logger: m => { if (m.status === 'recognizing text') progres?.(m.progress); },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(image, {}, { blocks: true, text: true });
    const mots = (data.blocks ?? []).flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words)))
      .map(w => ({ texte: w.text, conf: w.confidence, bbox: w.bbox as Boite }));
    return mettreEnPage(mots, largeur);
  } finally {
    await worker.terminate();
  }
}

const mediane = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const texteDe = (m: Morceau) => m.mots.map(w => w.texte).join(' ').replace(/\s+/g, ' ').trim();
const lisible = (m: Morceau) => {
  const t = texteDe(m);
  const lettres = t.match(/[a-zà-ÿ0-9]/gi)?.length ?? 0;
  const conf = m.mots.reduce((s, w) => s + w.conf, 0) / m.mots.length;
  if (/^\d{1,2}\s*[.)]?$/.test(t)) return conf >= 55; // numéro d'étape seul
  return conf >= 55 && lettres >= 2 && lettres / t.replace(/\s/g, '').length >= 0.6;
};

export function mettreEnPage(tous: Mot[], largeur: number): Paragraphe[] {
  // 1. Lignes : chaque mot rejoint la ligne dont le dernier mot est juste à sa gauche, à la même hauteur
  //    (tolère une page un peu penchée) ; un grand espace (gouttière entre colonnes) commence un autre morceau.
  const mots = tous.filter(w => w.texte.trim() && w.conf >= 30 && w.bbox.y1 > w.bbox.y0).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const morceaux: Morceau[] = [];
  for (const w of mots) {
    const h = w.bbox.y1 - w.bbox.y0, cy = (w.bbox.y0 + w.bbox.y1) / 2;
    let meilleur: Morceau | null = null, ecart = Infinity;
    for (const m of morceaux) {
      const der = m.mots[m.mots.length - 1].bbox;
      const gap = w.bbox.x0 - der.x1;
      const dy = Math.abs(cy - (der.y0 + der.y1) / 2);
      const hh = Math.max(h, m.h);
      if (gap > -hh * 0.3 && gap < Math.max(2.2 * hh, 40) && dy < hh * 0.55 && h < m.h * 1.8 && m.h < h * 1.8 && dy + gap / 10 < ecart) { meilleur = m; ecart = dy + gap / 10; }
    }
    if (meilleur) {
      meilleur.mots.push(w);
      meilleur.x1 = Math.max(meilleur.x1, w.bbox.x1); meilleur.y0 = Math.min(meilleur.y0, w.bbox.y0); meilleur.y1 = Math.max(meilleur.y1, w.bbox.y1);
      meilleur.h = mediane(meilleur.mots.map(x => x.bbox.y1 - x.bbox.y0));
    } else morceaux.push({ mots: [w], x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1, h });
  }
  const lignes = morceaux.filter(lisible);
  if (!lignes.length) return [];
  const hMed = mediane(lignes.map(m => m.h));

  // 2. Colonnes : les départs de ligne qui reviennent souvent (au moins 3 fois) sont des débuts de colonne.
  const departs: number[][] = [];
  for (const m of [...lignes].sort((a, b) => a.x0 - b.x0)) {
    const d = departs.find(c => m.x0 - c[0] < 4 * hMed);
    if (d) d.push(m.x0); else departs.push([m.x0]);
  }
  const colonnes = departs.filter(d => d.length >= 3).map(d => mediane(d));
  const colonneDe = (m: Morceau) => colonnes.reduce((best, c, i) => Math.abs(m.x0 - c) < Math.abs(m.x0 - colonnes[best]) ? i : best, 0);
  // une ligne qui déborde sur la colonne suivante (titre, introduction, encadré) traverse la page :
  // elle découpe la page en bandes, et dans chaque bande on lit colonne par colonne
  // (on ne regarde que les colonnes à droite de la sienne : un numéro d'étape qui dépasse à gauche ne compte pas)
  const traverse = (m: Morceau) => colonnes.some(c => c > colonnes[colonneDe(m)] && m.x0 < c - 4 * hMed && m.x1 > c + 2 * hMed) || m.x1 - m.x0 > largeur * 0.7;

  const ordre: Morceau[][] = [];
  let bande: Morceau[] = [];
  const viderBande = () => {
    const parCol = new Map<number, Morceau[]>();
    for (const m of bande) { const c = colonneDe(m); parCol.set(c, [...(parCol.get(c) ?? []), m]); }
    [...parCol.keys()].sort((a, b) => colonnes[a] - colonnes[b]).forEach(c => ordre.push(parCol.get(c)!.sort((a, b) => a.y0 - b.y0)));
    bande = [];
  };
  for (const m of [...lignes].sort((a, b) => a.y0 - b.y0)) {
    if (traverse(m)) {
      // un intertitre court juste au-dessus (« Astuce ») appartient à ce bloc large, pas à la colonne
      const titre = bande.filter(b => m.y0 - b.y1 >= -hMed * 0.3 && m.y0 - b.y1 < 1.5 * hMed && Math.abs(b.x0 - m.x0) < 2 * hMed).sort((a, b) => b.y1 - a.y1)[0];
      if (titre) bande = bande.filter(b => b !== titre);
      viderBande();
      const prec = ordre[ordre.length - 1];
      // plusieurs lignes larges qui se suivent (introduction sur 2 lignes) restent ensemble
      if (!titre && prec && traverse(prec[prec.length - 1]) && m.y0 - prec[prec.length - 1].y1 < 1.3 * hMed) prec.push(m); else ordre.push(titre ? [titre, m] : [m]);
    } else {
      // la dernière ligne d'un bloc large est souvent courte : elle reste avec son bloc
      const prec = ordre[ordre.length - 1];
      const der = prec?.[prec.length - 1];
      if (!bande.length && der && traverse(der) && m.y0 - der.y1 < 1.3 * hMed && Math.abs(m.x0 - Math.min(...prec.map(x => x.x0))) < 2 * hMed) prec.push(m);
      else bande.push(m);
    }
  }
  viderBande();

  // 3. Paragraphes : dans une colonne, un écart vertical nettement plus grand que l'interligne habituel
  //    (espace entre deux étapes) ou un changement franc de taille de lettres
  const out: Paragraphe[] = [];
  for (const [groupe, col] of ordre.entries()) {
    const ecarts = col.slice(1).map((m, i) => m.y0 - col[i].y1).filter(e => e > -hMed);
    const normal = Math.max(0, mediane(ecarts));
    const seuil = Math.max(normal * 1.8, normal + 0.45 * hMed);
    let p: { lignes: Morceau[] } | null = null;
    const pousser = () => {
      if (!p) return;
      const l = p.lignes;
      out.push({ lignes: l.map(texteDe), hauteur: l.reduce((s, m) => s + m.h, 0) / l.length, haut: l[0].y0, gauche: Math.min(...l.map(m => m.x0)), groupe });
      p = null;
    };
    for (const m of col) {
      const cur = p as { lignes: Morceau[] } | null;
      const der = cur?.lignes[cur.lignes.length - 1];
      if (der && (m.y0 - der.y1 > seuil || m.h > der.h * 1.6 || der.h > m.h * 1.6)) pousser();
      if (!p) p = { lignes: [] };
      (p as { lignes: Morceau[] }).lignes.push(m);
    }
    pousser();
  }
  return out;
}

// Photo remise droite (orientation du téléphone), en niveaux de gris, ramenée à environ 2 600 px de long :
// une photo trop petite est agrandie (Tesseract lit mal les lettres de moins de 20 px), une trop grande réduite.
async function preparer(fichier: Blob, cible = 2600): Promise<{ image: Blob; largeur: number }> {
  const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const k = Math.min(2, cible / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d')!;
  ctx.filter = 'grayscale(1)';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const image = await new Promise<Blob>((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('image')), 'image/png'));
  return { image, largeur: c.width };
}
