// Lecture du texte d'une photo (page de livre, fiche, capture d'écran) directement sur le téléphone.
// Le moteur (Tesseract) et le dictionnaire français sont téléchargés à la première utilisation (quelques Mo),
// d'où le chargement à la demande : le reste de l'appli n'est pas alourdi.
//
// Une page de recette est faite de blocs (titre, ingrédients, étapes…), souvent sur deux colonnes, avec des photos.
// La mise en page automatique de Tesseract est la plus fiable sur une vraie photo (testé sur une page de livre
// en deux colonnes avec encadré « Conseil ») ; en secours, mode « texte épars » : on refait la mise en page
// à partir de la position de chaque mot (lignes, colonnes, paragraphes).

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

// Une seule lecture (mode « auto » de Tesseract), puis trois façons de remettre la page en ordre,
// car aucune ne réussit sur toutes les photos :
//  - « découpe » (decouperPage) : on cherche les grands espaces blancs de la page (entre deux bandes, entre deux
//    colonnes) et on coupe récursivement : la plus stable sur une vraie page de livre ;
//  - « blocs » (depuisBlocs) : les blocs proposés par Tesseract lui-même ;
//  - « lignes » (mettreEnPage) : regroupement des mots en lignes puis colonnes.
// On garde la première qui trouve à la fois des ingrédients et des étapes (note de juger), sinon la mieux notée.
// Deux passages : la photo telle quelle (en gris), puis une version « nettoyée » (fond éclairci, ombres et
// photo sombre corrigées). Sur les essais, chacune rattrape des photos que l'autre lit mal.
// La lecture retenue est renvoyée avec les autres essais (« autres »), qui servent à compléter les ingrédients.
export async function lirePhoto(fichier: Blob, progres?: (p: number) => void, juger?: (p: Paragraphe[]) => number): Promise<Paragraphe[] & { autres: Paragraphe[][] }> {
  const { gris, nettoyee, largeur } = await preparer(fichier);
  const { createWorker, PSM } = await import('tesseract.js');
  let passe = 0;
  const worker = await createWorker('fra', 1, {
    logger: m => { if (m.status === 'recognizing text') progres?.((passe + m.progress) / 2); },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
    const essais: Paragraphe[][] = [];
    for (const image of [gris, nettoyee]) {
      const blocs = ((await worker.recognize(image, {}, { blocks: true, text: true })).data.blocks ?? []) as unknown as BlocTess[];
      essais.push(...lectures(blocs, largeur));
      passe++;
    }
    return Object.assign(meilleureLecture(essais, juger).lecture, { autres: essais });
  } finally {
    await worker.terminate();
  }
}

const lectures = (blocs: BlocTess[], largeur: number) => {
  const mots = blocs.flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words)))
    .map(w => ({ texte: w.text, conf: w.confidence, bbox: w.bbox }));
  return [depuisBlocs(blocs), decouperPage(blocs), mettreEnPage(mots, largeur)];
};

export function meilleureLecture(essais: Paragraphe[][], juger?: (p: Paragraphe[]) => number) {
  let lecture: Paragraphe[] = [], note = -1;
  for (const p of essais) { const n = juger ? juger(p) : 0; if (n > note) { lecture = p; note = n; } }
  return { lecture, note };
}

export function choisirLecture(blocs: BlocTess[], largeur: number, juger?: (p: Paragraphe[]) => number): Paragraphe[] {
  return meilleureLecture(lectures(blocs, largeur), juger).lecture;
}

// Découpe de la page par les espaces blancs (méthode « XY-cut ») :
// la page est coupée au plus grand espace blanc, horizontal (entre deux bandes) ou vertical (entre deux colonnes),
// puis chaque morceau est recoupé de la même façon, jusqu'à des blocs de lignes serrées.
// L'ordre de lecture suit les coupes : de haut en bas, puis de gauche à droite.
// Une photo penchée est d'abord redressée (angle moyen des lignes), sinon les espaces blancs disparaissent.
type MotXY = { texte: string; x0: number; x1: number; y0: number; y1: number; h: number };
export function decouperPage(blocs: BlocTess[]): Paragraphe[] {
  const lignesT = blocs.flatMap(b => b.paragraphs.flatMap(p => p.lines));
  const angles = lignesT.filter(l => l.baseline && l.baseline.x1 - l.baseline.x0 > 300)
    .map(l => Math.atan2(l.baseline!.y1 - l.baseline!.y0, l.baseline!.x1 - l.baseline!.x0));
  const a = angles.length ? mediane(angles) : 0;
  const cos = Math.cos(a), sin = Math.sin(a);
  const mots: MotXY[] = [];
  for (const l of lignesT) for (const w of l.words) {
    const t = w.text.trim();
    if (!t || w.confidence < 45) continue;
    const lettres = t.match(/[a-zà-ÿ0-9½¼¾]/gi)?.length ?? 0;
    // les puces (• lue * ® »…) et numéros mal lus (« %. ») servent au découpage : on garde les signes courts nets
    if (!lettres ? !(/^[•*®©»«·¢=+°%]\.?$/.test(t) && w.confidence >= 60) : lettres / t.length < 0.5) continue;
    const cx = (w.bbox.x0 + w.bbox.x1) / 2, cy = (w.bbox.y0 + w.bbox.y1) / 2;
    const rx = cx * cos + cy * sin, ry = -cx * sin + cy * cos;
    const dx = (w.bbox.x1 - w.bbox.x0) / 2, dy = (w.bbox.y1 - w.bbox.y0) / 2;
    mots.push({ texte: t, x0: rx - dx, x1: rx + dx, y0: ry - dy, y1: ry + dy, h: 2 * dy });
  }
  if (!mots.length) return [];
  const hMed = mediane(mots.map(m => m.h));

  // espaces blancs le long d'un axe : intervalles non couverts par les mots
  const espaces = (iv: [number, number][]) => {
    const tri = [...iv].sort((x, y) => x[0] - y[0]);
    const out: { debut: number; taille: number }[] = [];
    let fin = tri[0][1];
    for (const [d, f] of tri.slice(1)) { if (d > fin) out.push({ debut: fin, taille: d - fin }); fin = Math.max(fin, f); }
    return out;
  };
  const feuilles: MotXY[][] = [];
  const couper = (ms: MotXY[]) => {
    if (ms.length < 2) { if (ms.length) feuilles.push(ms); return; }
    const h = mediane(ms.map(m => m.h));
    const eh = espaces(ms.map(m => [m.y0, m.y1])).filter(e => e.taille >= 0.9 * Math.min(h, hMed));
    const ev = espaces(ms.map(m => [m.x0, m.x1])).filter(e => e.taille >= 1.6 * Math.min(h, hMed));
    // on coupe au plus grand espace (un espace vertical doit être plus large qu'un espace entre mots)
    const gh = eh.sort((x, y) => y.taille - x.taille)[0], gv = ev.sort((x, y) => y.taille - x.taille)[0];
    if (gh && (!gv || gh.taille >= gv.taille * 0.8)) {
      const c = gh.debut + gh.taille / 2;
      couper(ms.filter(m => (m.y0 + m.y1) / 2 < c)); couper(ms.filter(m => (m.y0 + m.y1) / 2 >= c));
    } else if (gv) {
      const c = gv.debut + gv.taille / 2;
      couper(ms.filter(m => (m.x0 + m.x1) / 2 < c)); couper(ms.filter(m => (m.x0 + m.x1) / 2 >= c));
    } else feuilles.push(ms);
  };
  couper(mots);

  // dans chaque bloc : mots regroupés en lignes, lignes en paragraphes (espace vertical nettement plus grand que l'interligne)
  const out: Paragraphe[] = [];
  feuilles.forEach((ms, groupe) => {
    const lignes: MotXY[][] = [];
    for (const m of [...ms].sort((x, y) => x.x0 - y.x0)) {
      // un mot rejoint la ligne s'il en recouvre au moins la moitié de la hauteur (« g », « p » descendent plus bas)
      // (comparé au dernier mot de la ligne : une photo un peu penchée ne mélange pas deux lignes voisines)
      let l: MotXY[] | undefined, best = 0;
      for (const x of lignes) {
        const d = x[x.length - 1];
        const rec = (Math.min(d.y1, m.y1) - Math.max(d.y0, m.y0)) / Math.min(m.h, d.h);
        if (rec >= 0.5 && rec > best && m.x0 - d.x1 < 4 * hMed) { l = x; best = rec; }
      }
      if (l) l.push(m); else lignes.push([m]);
    }
    lignes.sort((x, y) => mediane(x.map(z => z.y0)) - mediane(y.map(z => z.y0)));
    const info = lignes.map(l => {
      const t = [...l].sort((x, y) => x.x0 - y.x0);
      return { texte: t.map(x => x.texte).join(' '), y0: Math.min(...l.map(x => x.y0)), y1: Math.max(...l.map(x => x.y1)), x0: Math.min(...l.map(x => x.x0)), h: mediane(l.map(x => x.h)) };
    });
    const ecarts = info.slice(1).map((l, i) => l.y0 - info[i].y1);
    const normal = Math.max(0, mediane(ecarts));
    const seuil = Math.max(normal * 1.6, normal + 0.3 * hMed);
    let cur: typeof info = [];
    const pousser = () => {
      if (!cur.length) return;
      out.push({ lignes: cur.map(l => l.texte), hauteur: mediane(cur.map(l => l.h)), haut: cur[0].y0, gauche: Math.min(...cur.map(l => l.x0)), groupe });
      cur = [];
    };
    info.forEach((l, i) => {
      const der = cur[cur.length - 1];
      if (der && (ecarts[i - 1] > seuil || l.h > der.h * 1.6 || der.h > l.h * 1.6)) pousser();
      cur.push(l);
    });
    pousser();
  });
  return out;
}

// Blocs trouvés par Tesseract (mode auto) : un paragraphe Tesseract = un paragraphe de la fiche.
// Les lignes illisibles (morceaux de photo, fourrure, reflets…) sont écartées.
export type BlocTess = { paragraphs: { lines: { text: string; confidence: number; baseline?: Boite; words: { text: string; confidence: number; bbox: Boite }[] }[] }[] };
export function depuisBlocs(blocs: BlocTess[]): Paragraphe[] {
  const out: Paragraphe[] = [];
  blocs.forEach((b, groupe) => {
    for (const p of b.paragraphs) {
      const lignes = p.lines.filter(l => {
        const t = l.text.trim();
        const lettres = t.match(/[a-zà-ÿ0-9]/gi)?.length ?? 0;
        return t && l.confidence >= 55 && lettres >= 2 && lettres / t.replace(/\s/g, '').length >= 0.6;
      });
      if (!lignes.length) continue;
      const mots = lignes.flatMap(l => l.words);
      out.push({
        lignes: lignes.map(l => l.text.replace(/\s+/g, ' ').trim()),
        hauteur: mediane(mots.map(w => w.bbox.y1 - w.bbox.y0)),
        haut: Math.min(...mots.map(w => w.bbox.y0)),
        gauche: Math.min(...mots.map(w => w.bbox.x0)),
        groupe,
      });
    }
  });
  return out;
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
// Version « nettoyée » : chaque point est divisé par la luminosité du fond autour de lui (fond estimé sur une
// image réduite 16 fois), ce qui efface ombres et dégradés, puis le contraste est étiré.
async function preparer(fichier: Blob, cible = 2600): Promise<{ gris: Blob; nettoyee: Blob; largeur: number }> {
  const bmp = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const k = Math.min(2, cible / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  const W = c.width = Math.round(bmp.width * k), H = c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.filter = 'grayscale(1)';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, W, H);
  bmp.close();
  const enPng = (cv: HTMLCanvasElement) => new Promise<Blob>((ok, ko) => cv.toBlob(b => b ? ok(b) : ko(new Error('image')), 'image/png'));
  const gris = await enPng(c);

  // fond : image réduite, floutée, agrandie
  const f = document.createElement('canvas');
  f.width = Math.max(1, Math.round(W / 16)); f.height = Math.max(1, Math.round(H / 16));
  const fctx = f.getContext('2d')!;
  fctx.filter = 'blur(2px)';
  fctx.drawImage(c, 0, 0, f.width, f.height);
  const fond = document.createElement('canvas');
  fond.width = W; fond.height = H;
  const gctx = fond.getContext('2d', { willReadFrequently: true })!;
  gctx.imageSmoothingQuality = 'high';
  gctx.drawImage(f, 0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H), bg = gctx.getImageData(0, 0, W, H).data, d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const v = Math.min(255, (d[i] / Math.max(bg[i], 1)) * 255) | 0; d[i] = v; hist[v]++; }
  // étirement : 2 % des points les plus sombres en noir, à partir de 60 % (le papier) en blanc
  const n = W * H; let cum = 0, bas = 0, haut = 255;
  for (let v = 0; v < 256; v++) { cum += hist[v]; if (cum <= n * 0.02) bas = v; if (cum <= n * 0.6) haut = v; }
  const e = 255 / Math.max(haut - bas, 1);
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, (d[i] - bas) * e)); d[i] = d[i + 1] = d[i + 2] = v; }
  ctx.putImageData(img, 0, 0);
  const nettoyee = await enPng(c);
  return { gris, nettoyee, largeur: W };
}
