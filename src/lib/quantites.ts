// Mise à l'échelle des quantités d'une ligne d'ingrédient et détection des minuteurs dans les étapes.

const FRAC: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const MOTS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, huit: 8, dix: 10, douze: 12 };

// Lit la quantité au début de la ligne. Renvoie [valeur, longueur lue, plage?]
export function lireQuantite(ligne: string): { v: number; fin: number; max?: number } | null {
  const s = ligne;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^\s*(\d+)\s+(\d+)\/(\d+)/))) return { v: +m[1] + +m[2] / +m[3], fin: m[0].length };
  if ((m = s.match(/^\s*(\d+)\s*([½¼¾⅓⅔])/))) return { v: +m[1] + FRAC[m[2]], fin: m[0].length };
  if ((m = s.match(/^\s*([½¼¾⅓⅔])/))) return { v: FRAC[m[1]], fin: m[0].length };
  if ((m = s.match(/^\s*(\d+)\/(\d+)/))) return { v: +m[1] / +m[2], fin: m[0].length };
  if ((m = s.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:-|à)\s*(\d+(?:[.,]\d+)?)/))) return { v: parseFloat(m[1].replace(',', '.')), max: parseFloat(m[2].replace(',', '.')), fin: m[0].length };
  if ((m = s.match(/^\s*(\d+(?:[.,]\d+)?)/))) return { v: parseFloat(m[1].replace(',', '.')), fin: m[0].length };
  if ((m = s.match(/^\s*(une?|deux|trois|quatre|cinq|six|huit|dix|douze)\b/i))) return { v: MOTS[m[1].toLowerCase()], fin: m[0].length };
  return null;
}

export function formater(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0';
  const entier = Math.floor(v), reste = v - entier;
  const fr = [[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']] as const;
  if (v < 10) for (const [f, c] of fr) if (Math.abs(reste - f) < 0.04) return entier ? `${entier} ${c}` : c;
  if (v >= 100) return String(Math.round(v / 5) * 5);
  if (v >= 10) return String(Math.round(v));
  const r = Math.round(v * 10) / 10;
  return String(r).replace('.', ',');
}

export function ajusterLigne(ligne: string, facteur: number): string {
  if (facteur === 1) return ligne;
  const q = lireQuantite(ligne);
  if (!q) return ligne;
  const debut = ligne.slice(0, ligne.length - ligne.trimStart().length);
  // sans unité de poids ou de volume (oignon, gousse, pincée, œuf…), on arrondit au demi supérieur : jamais « ⅔ gousse »
  const mesure = /^\s*(kg|g|gr|grammes?|kilos?|l|litres?|dl|cl|ml|c\.|cuill|cs|cc|cas|cac|càs|càc)\b/i.test(ligne.slice(q.fin));
  const f = (x: number) => mesure ? formater(x * facteur) : formater(x * facteur >= 3 ? Math.round(x * facteur) : Math.max(0.5, Math.ceil(x * facteur * 2 - 1e-9) / 2));
  const txt = q.max != null ? `${f(q.v)} à ${f(q.max)}` : f(q.v);
  return debut + txt + ligne.slice(q.fin);
}

// Minuteurs : « 20 min », « 1 h 30 », « 45 minutes », « 2 heures »
export function minuteurs(etape: string): { texte: string; secondes: number }[] {
  const out: { texte: string; secondes: number }[] = [];
  const re = /(\d+)\s*(?:h|heures?)\s*(\d{1,2})?(?:\s*min(?:utes?)?)?|(\d+)\s*(?:min(?:utes?)?|mn)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(etape))) {
    const s = m[3] != null ? +m[3] * 60 : +m[1] * 3600 + (m[2] ? +m[2] * 60 : 0);
    if (s > 0 && s <= 24 * 3600) out.push({ texte: m[0].trim(), secondes: s });
  }
  return out;
}

export const duree = (min?: number) => !min ? '' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ' ' + String(min % 60).padStart(2, '0') : ''}`;
