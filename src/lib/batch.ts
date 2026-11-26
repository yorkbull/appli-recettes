// Batch cooking : deux sessions par semaine.
// - le dimanche, on cuisine les repas du dimanche soir au mercredi midi ;
// - le mercredi, on cuisine les repas du mercredi soir au vendredi midi.
// Pour chaque session : repas couverts, plan de cuisine dans le bon ordre, temps estimé, conservation.
// Principes suivis (méthode « chaîne de production ») : tout sortir et préchauffer d'abord, lancer en premier
// ce qui cuit le plus longtemps, éplucher et couper par lots pendant les cuissons, finir par l'assemblage,
// refroidir en moins de 2 heures, mettre en boîtes étiquetées.
import type { Case, Moment, Planning, Recette } from '../types';
import { MOMENTS, MOMENT_LABEL } from '../types';
import { ajouterJours, dateLongue, depuisIso, nomJour } from './dates';
import { lireLigne, rayonDe } from './courses';
import { ajusterLigne, minuteurs, duree } from './quantites';

export interface Session { jour: string; type: 'dimanche' | 'mercredi'; debut: [string, Moment]; fin: [string, Moment] }

// Session qui commence ce jour-là (dimanche ou mercredi), avec les repas qu'elle couvre
export function sessionDu(jour: string): Session {
  const j = depuisIso(jour).getDay();
  if (j === 0) return { jour, type: 'dimanche', debut: [jour, 'soir'], fin: [ajouterJours(jour, 3), 'midi'] };
  return { jour, type: 'mercredi', debut: [jour, 'soir'], fin: [ajouterJours(jour, 2), 'midi'] };
}

// Prochaine session à partir d'une date (le jour même compte) ; décalage pour passer aux suivantes
export function prochaineSession(depuis: string, decalage = 0): Session {
  let d = depuis;
  while (![0, 3].includes(depuisIso(d).getDay())) d = ajouterJours(d, 1);
  for (let i = 0; i < Math.abs(decalage); i++) {
    const pas = decalage > 0 ? 1 : -1;
    d = ajouterJours(d, pas);
    while (![0, 3].includes(depuisIso(d).getDay())) d = ajouterJours(d, pas);
  }
  return sessionDu(d);
}

const ordre = (d: string, m: Moment) => `${d}-${MOMENTS.indexOf(m)}`;
export const libelleRepas = (d: string, m: Moment) => `${nomJour(d)} ${MOMENT_LABEL[m].toLowerCase()}`;
export const titreSession = (s: Session) => `${dateLongue(s.jour).replace(/^./, c => c.toUpperCase())}`;
export const periodeSession = (s: Session) => `Repas du ${libelleRepas(...s.debut)} au ${libelleRepas(...s.fin)}`;

export interface Repas { date: string; moment: Moment; c: Case }

// Repas du planning couverts par la session, dans l'ordre
export function repasCouverts(s: Session, planning: Planning): Repas[] {
  const out: Repas[] = [];
  const a = ordre(...s.debut), b = ordre(...s.fin);
  for (let d = s.debut[0]; d <= s.fin[0]; d = ajouterJours(d, 1)) for (const m of MOMENTS) {
    const k = ordre(d, m), c = planning[d]?.[m];
    if (c && k >= a && k <= b) out.push({ date: d, moment: m, c });
  }
  return out;
}

// Planning réduit aux repas de la session (pour la liste de courses)
export function planningSession(s: Session, planning: Planning): { jours: string[]; planning: Planning } {
  const p: Planning = {};
  for (const r of repasCouverts(s, planning)) p[r.date] = { ...(p[r.date] ?? {}), [r.moment]: r.c };
  const jours: string[] = [];
  for (let d = s.debut[0]; d <= s.fin[0]; d = ajouterJours(d, 1)) jours.push(d);
  return { jours, planning: p };
}

export interface Plat { r: Recette; portions: number; repas: Repas[] }

// Plats à cuisiner : une recette prévue plusieurs fois se cuisine une fois (comme pour les courses : ce sont des restes,
// on garde le plus grand nombre de portions prévu)
export function platsSession(repas: Repas[], parId: Record<string, Recette>): Plat[] {
  const m = new Map<string, Plat>();
  for (const x of repas) {
    if ((x.c.type !== 'recette' && x.c.type !== 'restes') || !parId[x.c.recetteId]) continue;
    const p = m.get(x.c.recetteId) ?? { r: parId[x.c.recetteId], portions: 0, repas: [] };
    p.repas.push(x);
    if (x.c.type === 'recette') p.portions = Math.max(p.portions, x.c.portions);
    m.set(x.c.recetteId, p);
    // plats de remplacement (« un plat pour Marion ») : à cuisiner aussi
    if (x.c.type === 'recette') for (const a of x.c.pour ?? []) {
      if (!parId[a.recetteId]) continue;
      const q = m.get(a.recetteId) ?? { r: parId[a.recetteId], portions: 0, repas: [] };
      if (!q.repas.includes(x)) q.repas.push(x);
      q.portions = Math.max(q.portions, a.portions);
      m.set(a.recetteId, q);
    }
  }
  for (const p of m.values()) if (!p.portions) p.portions = p.r.portions || 1;
  return [...m.values()];
}

// --- Classement des étapes ---
const sa = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const FOUR = /four|enfourn|gratin(er)?\b|rotir/;
const PRECHAUFFE = /prechauff/;
const LONG_MIN = 20; // une cuisson de 20 min et plus se lance tôt et tourne pendant qu'on fait autre chose

export interface Tache { id: string; phase: 1 | 2 | 3 | 4 | 5; texte: string; plat?: string; minutes?: number; attente?: boolean }

const temperature = (etapes: string[]) => {
  for (const e of etapes) { const m = e.match(/(\d{3})\s*°/); if (m) return +m[1]; }
  return null;
};
const dureeEtape = (e: string) => minuteurs(e).reduce((n, t) => Math.max(n, t.secondes / 60), 0);
const cuissonLongue = (r: Recette) => Math.max(0, ...r.etapes.map(dureeEtape));

// Ingrédients à éplucher ou couper, regroupés par lot (tous les oignons ensemble, etc.)
function lotsPreparation(plats: Plat[]): string[] {
  const lots = new Map<string, string[]>();
  for (const { r, portions } of plats) {
    const f = portions / (r.portions || 1);
    for (const ligne of r.ingredients) {
      const lu = lireLigne(ligne, f)[0];
      if (!lu || lu.valeur == null || rayonDe(lu.nom) !== 'legumes' || /persil|ciboulette|basilic|coriandre|menthe|aneth|thym|romarin|laurier/.test(sa(lu.nom))) continue;
      const cle = sa(lu.nom).split(' ')[0].replace(/s$/, '');
      lots.set(cle, [...(lots.get(cle) ?? []), `${ajusterLigne(ligne, f)} (${r.titre})`]);
    }
  }
  return [...lots.values()].map(l => l.join(' + '));
}

// induction : l'eau bout en quelques minutes, on la lance juste avant les cuissons au lieu de la faire chauffer dès le début
export function planCuisine(plats: Plat[], induction = false): { taches: Tache[]; minutesSession: number; minutesSepares: number } {
  const taches: Tache[] = [];
  // 1. Mise en route
  const temps = [...new Set(plats.map(p => temperature(p.r.etapes)).filter((t): t is number => t != null))].sort((a, b) => b - a);
  taches.push({ id: 'sortir', phase: 1, texte: 'Sortir tous les ingrédients, les ustensiles et les boîtes de conservation.' });
  if (temps.length) taches.push({ id: 'four', phase: 1, texte: `Préchauffer le four à ${temps[0]} °C${temps.length > 1 ? ` (on baissera ensuite à ${temps.slice(1).join(' puis ')} °C)` : ''}.` });
  const eau = plats.some(p => /pates|spaghetti|riz|semoule|tagliatelle|penne|coquillette|quinoa|boulgour/.test(sa(p.r.ingredients.join(' '))));
  if (eau && !induction) taches.push({ id: 'eau', phase: 1, texte: 'Mettre une grande casserole d’eau à chauffer pour les pâtes, le riz ou la semoule.' });
  if (eau && induction) taches.push({ id: 'eau', phase: 1, texte: 'Mettre une grande casserole d’eau en Booster avec un couvercle pour les pâtes, le riz ou la semoule : elle bout en 5 minutes environ.' });
  if (induction) taches.push({ id: 'plaques', phase: 1, texte: 'Plaques à induction : poser sur chaque plaque la casserole ou la poêle prévue (fond aimanté) et garder une plaque libre pour les cuissons rapides.' });

  // 2. Plats à cuisson longue, le plus long d'abord : leurs étapes jusqu'au lancement de la cuisson
  // 3. Pendant que ça cuit : éplucher et couper par lots les légumes des autres plats
  // 4. Les autres plats, puis la fin des plats longs
  const tries = [...plats].sort((a, b) => cuissonLongue(b.r) - cuissonLongue(a.r));
  const courts: Plat[] = [];
  const apres: Tache[] = [];
  for (const p of tries) {
    const { r } = p;
    const etapes = r.etapes.map((e, i) => ({ e, i, min: dureeEtape(e) })).filter(x => !(PRECHAUFFE.test(sa(x.e)) && !/[.;]\s+\S/.test(x.e.trim().replace(/\.$/, ''))));
    const k = etapes.findIndex(x => x.min >= LONG_MIN || (FOUR.test(sa(x.e)) && x.min >= 15));
    if (k < 0) { courts.push(p); continue; }
    etapes.forEach((x, j) => {
      const t: Tache = { id: `${r.id}-${x.i}`, phase: j <= k ? 2 : 4, texte: x.e, plat: r.titre, minutes: x.min || undefined, attente: j === k };
      (j <= k ? taches : apres).push(t);
    });
  }
  for (const [i, lot] of lotsPreparation(courts).entries()) taches.push({ id: 'lot' + i, phase: 3, texte: `Éplucher et couper : ${lot}.` });
  for (const { r } of courts) r.etapes.forEach((e, i) => {
    if (PRECHAUFFE.test(sa(e)) && !/[.;]\s+\S/.test(e.trim().replace(/\.$/, ''))) return;
    taches.push({ id: `${r.id}-${i}`, phase: 4, texte: e, plat: r.titre, minutes: dureeEtape(e) || undefined });
  });
  taches.push(...apres);

  // 5. Refroidir et ranger
  taches.push({ id: 'refroidir', phase: 5, texte: 'Laisser refroidir les plats, 2 heures maximum à température ambiante (un bain d’eau froide accélère), puis les mettre au frigo.' });
  taches.push({ id: 'boites', phase: 5, texte: 'Répartir en boîtes et noter sur chacune le plat et le repas prévu.' });
  taches.push({ id: 'vaisselle', phase: 5, texte: 'Laver les ustensiles au fil des cuissons pour finir avec un plan de travail propre.' });

  // Temps estimé : préparations à la suite, cuissons longues en parallèle, 15 min de rangement
  const prep = plats.reduce((n, p) => n + (p.r.preparationMin ?? 15), 0);
  const actives = taches.filter(t => t.phase === 4 && t.minutes).reduce((n, t) => n + (t.minutes ?? 0), 0);
  const chaineLongue = Math.max(0, ...plats.map(p => (p.r.preparationMin ?? 15) + cuissonLongue(p.r)));
  const minutesSession = Math.round((Math.max(prep + actives * 0.6, chaineLongue) + 15) / 5) * 5;
  const minutesSepares = Math.round(plats.reduce((n, p) => n + (p.r.preparationMin ?? 15) + (p.r.cuissonMin ?? cuissonLongue(p.r)) + 10, 0) / 5) * 5;
  return { taches, minutesSession, minutesSepares };
}

export const TITRES_PHASES: Record<Tache['phase'], string> = {
  1: 'Mise en route', 2: 'Lancer d’abord les cuissons longues', 3: 'Pendant que ça cuit : éplucher et couper par lots', 4: 'Cuisiner les autres plats', 5: 'Refroidir et ranger',
};

// --- Conservation ---
const POISSON = /saumon|thon|cabillaud|colin|lieu|merlu|poisson|crevette|moule|gambas|saint-jacques|sardine|maquereau|truite|dorade|crabe|surimi/;
const FRAGILE = /salade|laitue|roquette|mache|avocat|concombre|pousses|basilic|coriandre|menthe|ciboulette|cresson/;

export interface Conseil { repas: Repas; plat: string; lieu: 'frigo' | 'congelateur'; texte: string }

export function conservation(s: Session, plats: Plat[]): { conseils: Conseil[]; jourMeme: string[] } {
  const conseils: Conseil[] = [];
  const jourMeme = new Set<string>();
  for (const p of plats) {
    const poisson = POISSON.test(sa(p.r.ingredients.join(' ')));
    const max = poisson ? 2 : 3; // jours au frigo après la cuisson
    for (const x of p.repas) {
      const jours = Math.round((depuisIso(x.date).getTime() - depuisIso(s.jour).getTime()) / 864e5);
      const quand = libelleRepas(x.date, x.moment);
      if (jours <= max) conseils.push({ repas: x, plat: p.r.titre, lieu: 'frigo', texte: `Frigo, pour ${quand}.` });
      else conseils.push({ repas: x, plat: p.r.titre, lieu: 'congelateur', texte: `Congélateur${poisson ? ' (poisson : 2 jours maximum au frigo)' : ''}. Le passer au frigo la veille, ${libelleRepas(ajouterJours(x.date, -1), 'soir')}.` });
    }
    for (const l of p.r.ingredients) if (FRAGILE.test(sa(l))) jourMeme.add(`${l.replace(/^./, c => c.toUpperCase())} (${p.r.titre})`);
  }
  conseils.sort((a, b) => ordre(a.repas.date, a.repas.moment).localeCompare(ordre(b.repas.date, b.repas.moment)));
  return { conseils, jourMeme: [...jourMeme] };
}

export const texteDuree = (min: number) => duree(min) || '0 min';
