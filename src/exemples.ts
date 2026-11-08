import type { Recette } from './types';
import { nouvelId } from './store';

// 5 recettes pour essayer l'appli (supprimables)
export const EXEMPLES = (): Recette[] => {
  const t = new Date().toISOString();
  const r = (titre: string, portions: number, prep: number, cuisson: number, thematiques: string[], moments: Recette['moments'], ingredients: string[], etapes: string[]): Recette =>
    ({ id: nouvelId(), titre, portions, preparationMin: prep, cuissonMin: cuisson, thematiques, moments, ingredients, etapes, annotations: [], favori: false, source: { type: 'manuel' }, creeLe: t, modifieLe: t });
  return [
    r('Gratin dauphinois', 6, 20, 90, ['Végétarien'], ['soir'],
      ['1,5 kg de pommes de terre', '50 cl de crème liquide', '50 cl de lait', '1 gousse d’ail', '1 pincée de noix de muscade', 'sel, poivre'],
      ['Préchauffer le four à 160 °C. Frotter le plat avec la gousse d’ail coupée en deux.', 'Éplucher les pommes de terre et les couper en rondelles fines de 3 mm.', 'Porter le lait et la crème à frémissement avec le sel, le poivre et la muscade. Ajouter les pommes de terre et cuire 10 min en remuant.', 'Verser dans le plat et enfourner 1 h 30, jusqu’à ce que le dessus soit bien doré.']),
    r('Pâtes à la carbonara', 4, 10, 12, ['Sur le pouce', 'Viande'], ['midi', 'soir'],
      ['400 g de spaghetti', '150 g de lardons', '3 jaunes d’œuf', '60 g de parmesan râpé', 'poivre'],
      ['Cuire les pâtes 10 min dans une grande casserole d’eau salée.', 'Pendant ce temps, faire dorer les lardons à sec 5 min.', 'Battre les jaunes avec le parmesan et beaucoup de poivre.', 'Égoutter les pâtes en gardant un peu d’eau de cuisson. Hors du feu, mélanger pâtes, lardons et œufs, en ajoutant un peu d’eau pour rendre la sauce crémeuse.']),
    r('Saumon au four et riz citronné', 2, 10, 20, ['Poisson'], ['soir'],
      ['2 pavés de saumon', '150 g de riz basmati', '1 citron', '1 c. à soupe d’huile d’olive', 'aneth, sel, poivre'],
      ['Préchauffer le four à 200 °C.', 'Cuire le riz 11 min dans l’eau bouillante salée, égoutter et ajouter le zeste du citron.', 'Poser le saumon dans un plat, arroser d’huile et de jus de citron, saler, poivrer. Enfourner 15 min.', 'Servir avec l’aneth ciselé.']),
    r('Croque-monsieur', 2, 5, 10, ['Sandwich', 'Sur le pouce'], ['midi'],
      ['4 tranches de pain de mie', '2 tranches de jambon', '60 g d’emmental râpé', '20 g de beurre'],
      ['Beurrer les tranches de pain sur une face.', 'Garnir de jambon et d’emmental, refermer face beurrée à l’extérieur.', 'Cuire 10 min au four à 200 °C ou dans une poêle, 4 min de chaque côté.']),
    r('Porridge aux fruits', 1, 5, 5, ['Végétarien', 'Sur le pouce'], ['matin'],
      ['50 g de flocons d’avoine', '20 cl de lait', '½ banane', '1 c. à café de miel', 'quelques fruits rouges'],
      ['Chauffer le lait et les flocons à feu doux 5 min en remuant.', 'Verser dans un bol, ajouter la banane en rondelles, les fruits rouges et le miel.']),
  ];
};
