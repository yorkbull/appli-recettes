// Dates en heure locale, au format AAAA-MM-JJ
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const depuisIso = (s: string) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
export const ajouterJours = (s: string, n: number) => { const d = depuisIso(s); d.setDate(d.getDate() + n); return iso(d); };
export const aujourdhui = () => iso(new Date());

// Lundi de la semaine qui contient la date
export const lundi = (s: string) => { const d = depuisIso(s); const j = (d.getDay() + 6) % 7; d.setDate(d.getDate() - j); return iso(d); };
export const joursSemaine = (lundiIso: string) => Array.from({ length: 7 }, (_, i) => ajouterJours(lundiIso, i));

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const nomJour = (s: string) => JOURS[depuisIso(s).getDay()];
export const nomMois = (m: number) => MOIS[m];
export const jourCourt = (s: string) => { const d = depuisIso(s); return `${d.getDate()} ${MOIS[d.getMonth()].slice(0, 4).replace(/\.$/, '')}${MOIS[d.getMonth()].length > 4 ? '.' : ''}`; };
export const titreSemaine = (lundiIso: string) => {
  const a = depuisIso(lundiIso), b = depuisIso(ajouterJours(lundiIso, 6));
  return a.getMonth() === b.getMonth() ? `du ${a.getDate()} au ${b.getDate()} ${MOIS[b.getMonth()]}` : `du ${a.getDate()} ${MOIS[a.getMonth()]} au ${b.getDate()} ${MOIS[b.getMonth()]}`;
};
export const dateLongue = (s: string) => { const d = depuisIso(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
