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

// mange : repas coché comme déjà mangé (la coche suit le repas quand on le déplace)
export type Case = (
  | { type: 'recette'; recetteId: string; portions: number }
  | { type: 'restes'; recetteId: string; portions: number }
  | { type: 'dehors' }
  | { type: 'note'; texte: string }
) & { mange?: boolean };

// Copie d'un repas vers une autre case : la copie n'est pas encore mangée
export const sansCoche = (c: Case): Case => { const n = { ...c }; delete n.mange; return n; };

// planning : date ISO (AAAA-MM-JJ) -> moment -> case
export type Planning = Record<string, Partial<Record<Moment, Case>>>;

// Prix relevés en magasin : « produit|unité » -> euros le kg (g), le litre (ml) ou par pièce/unité comptée
export type Prix = Record<string, number>;

export interface Reglages {
  nomAppli: string;
  thematiques: string[];
  portionsParDefaut: number;
}

export const REGLAGES_DEFAUT: Reglages = {
  nomAppli: 'Mes recettes',
  thematiques: ['Sandwich', 'Sur le pouce', 'Viande', 'Poisson', 'Végétarien'],
  portionsParDefaut: 2,
};
