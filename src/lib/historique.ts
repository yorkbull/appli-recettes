// Sauvegarde automatique : des copies régulières des recettes, des menus du planning, des prix et des réglages,
// gardée sur le téléphone pendant 30 jours. Sert à revenir en arrière après une erreur (case vidée, recette effacée…).
// Les photos ne sont pas copiées (trop lourdes) : à la restauration, on reprend celles encore présentes.
import * as db from '../db';
import type { Recette } from '../types';
import { aujourdhui } from './dates';

export interface Instantane { jour: string; heure: string; s: db.Sauvegarde }
const CLE = 'historique';
const JOURS = 30;

export const lireHistorique = async () => (await db.lire<Instantane[]>(CLE)) ?? [];

// Aujourd'hui : une copie après chaque changement (les 30 dernières), pour annuler une erreur du jour.
// Les jours précédents : la dernière copie de chaque jour, pendant 30 jours.
const PAR_JOUR = 30;
const contenu = (s: db.Sauvegarde) => JSON.stringify([s.recettes, s.planning, s.prix ?? {}, s.reglages]);

export async function garderCopie(s: db.Sauvegarde) {
  const jour = aujourdhui();
  const sansPhotos = { ...s, recettes: s.recettes.map(r => ({ ...r, photo: undefined })) };
  const tout = (await lireHistorique()).sort((a, b) => b.heure.localeCompare(a.heure));
  if (tout[0] && contenu(tout[0].s) === contenu(sansPhotos)) return; // rien n'a changé depuis la dernière copie
  tout.unshift({ jour, heure: new Date().toISOString(), s: sansPhotos });
  let duJour = 0;
  const vus = new Set<string>();
  const garde = tout.filter(i => {
    if (i.jour === jour) return ++duJour <= PAR_JOUR;
    if (vus.has(i.jour)) return false;
    vus.add(i.jour); return vus.size <= JOURS;
  });
  await db.ecrire(CLE, garde);
}

// Remet une copie en reprenant les photos des recettes encore présentes sur le téléphone
export function avecPhotos(s: db.Sauvegarde, actuelles: Record<string, Recette>): db.Sauvegarde {
  return { ...s, recettes: s.recettes.map(r => ({ ...r, photo: r.photo ?? actuelles[r.id]?.photo })) };
}

export const nbRepas = (s: db.Sauvegarde) => Object.values(s.planning ?? {}).reduce((n, j) => n + Object.keys(j).length, 0);

// État juste avant un retour en arrière, pour pouvoir annuler ce retour
const CLE_AVANT = 'historique-avant-retour';
export const lireAvantRetour = async () => (await db.lire<Instantane>(CLE_AVANT)) ?? null;
export const garderAvantRetour = (s: db.Sauvegarde) => db.ecrire(CLE_AVANT, { jour: aujourdhui(), heure: new Date().toISOString(), s });
