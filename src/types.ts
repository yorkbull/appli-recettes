export type Moment = 'matin' | 'midi' | 'soir';
export const MOMENTS: Moment[] = ['matin', 'midi', 'soir'];
export const MOMENT_LABEL: Record<Moment, string> = { matin: 'Matin', midi: 'Midi', soir: 'Soir' };

export interface Annotation { id: string; date: string; texte: string }

export interface Recette {
  id: string;
  titre: string;
  photo?: string; // data URL JPEG compressée (environ 180 Ko)
  portions: number;
  preparationMin?: number;
  cuissonMin?: number;
  thematiques: string[];
  moments: Moment[];
  ingredients: string[];
  etapes: string[];
  annotations: Annotation[];
  favori: boolean;
  source?: { type: 'manuel' | 'lien' | 'photo'; url?: string };
  creeLe: string;
  modifieLe: string;
}

// Autre plat servi au même repas : pour quelqu'un qui ne mange pas le plat prévu (« un plat pour Marion »),
// ou deuxième plat au choix (personne vide)
export interface PlatPour { personne: string; recetteId: string; portions: number }
export const nomPlatPour = (p: { personne: string }) => p.personne ? `Pour ${p.personne}` : '2e plat';

// mange : repas coché comme déjà mangé (la coche suit le repas quand on le déplace)
// pour : plats de remplacement servis au même repas
export type Case = (
  | { type: 'recette'; recetteId: string; portions: number }
  | { type: 'restes'; recetteId: string; portions: number }
  | { type: 'dehors' }
  | { type: 'note'; texte: string }
) & { mange?: boolean; pour?: PlatPour[] };

// Copie d'un repas vers une autre case : la copie n'est pas encore mangée
export const sansCoche = (c: Case): Case => { const n = { ...c }; delete n.mange; return n; };

// planning : date ISO (AAAA-MM-JJ) -> moment -> case
export type Planning = Record<string, Partial<Record<Moment, Case>>>;

// Prix relevés en magasin : « produit|unité » -> euros le kg (g), le litre (ml) ou par pièce/unité comptée
export type Prix = Record<string, number>;

// Goût à respecter : « Marion n'aime pas le fromage, sauf la mozzarella », « allergie aux arachides »
export interface Gout { id: string; personne: string; mot: string; sauf: string; allergie: boolean }

export interface Reglages {
  nomAppli: string;
  thematiques: string[];
  portionsParDefaut: number;
  gouts: Gout[];
  frigo: string[]; // produits déjà à la maison (frigo, placard)
  induction: boolean; // plaques à induction : puissances conseillées dans les étapes
}

export const REGLAGES_DEFAUT: Reglages = {
  nomAppli: 'Mes recettes',
  thematiques: ['Sandwich', 'Sur le pouce', 'Viande', 'Poisson', 'Végétarien'],
  portionsParDefaut: 2,
  gouts: [
    { id: 'g1', personne: 'Marion', mot: 'fromage', sauf: 'mozzarella', allergie: false },
    { id: 'g2', personne: 'Marion', mot: 'champignons', sauf: '', allergie: false },
    { id: 'g3', personne: 'Charles', mot: 'fruits de mer', sauf: '', allergie: false },
  ],
  frigo: [],
  induction: true,
};
