import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as db from './db';
import { REGLAGES_DEFAUT, type Case, type Moment, type Planning, type Recette, type Reglages } from './types';
import { ajouterJours, aujourdhui } from './lib/dates';

export const nouvelId = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

interface Etat {
  pret: boolean;
  recettes: Recette[];
  parId: Record<string, Recette>;
  planning: Planning;
  reglages: Reglages;
  enregistrerRecette: (r: Recette) => Promise<void>;
  supprimerRecette: (id: string) => Promise<void>;
  mettreCase: (date: string, moment: Moment, c: Case | null) => void;
  modifierPlanning: (fn: (p: Planning) => Planning) => void;
  modifierReglages: (r: Partial<Reglages>) => void;
  derniereFois: (recetteId: string) => string | null;
  importer: (s: db.Sauvegarde) => Promise<void>;
}

const Ctx = createContext<Etat | null>(null);
export const useStore = () => { const c = useContext(Ctx); if (!c) throw new Error('store'); return c; };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [pret, setPret] = useState(false);
  const [recettes, setRecettes] = useState<Recette[]>([]);
  const [planning, setPlanning] = useState<Planning>({});
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_DEFAUT);

  useEffect(() => {
    (async () => {
      const [r, p, g] = await Promise.all([db.lireRecettes(), db.lire<Planning>('planning'), db.lire<Reglages>('reglages')]);
      setRecettes(r); setPlanning(p ?? {}); setReglages({ ...REGLAGES_DEFAUT, ...(g ?? {}) });
      setPret(true);
    })().catch(e => { console.error(e); setPret(true); });
  }, []);

  const parId = useMemo(() => Object.fromEntries(recettes.map(r => [r.id, r])), [recettes]);

  const enregistrerRecette = useCallback(async (r: Recette) => {
    const x = { ...r, modifieLe: new Date().toISOString() };
    await db.ecrireRecette(x);
    setRecettes(rs => { const i = rs.findIndex(y => y.id === x.id); if (i < 0) return [...rs, x]; const c = rs.slice(); c[i] = x; return c; });
  }, []);

  const modifierPlanning = useCallback((fn: (p: Planning) => Planning) => {
    setPlanning(p => { const n = fn(p); db.ecrire('planning', n); return n; });
  }, []);

  const supprimerRecette = useCallback(async (id: string) => {
    await db.supprimerRecette(id);
    setRecettes(rs => rs.filter(r => r.id !== id));
    // retirer la recette du planning
    modifierPlanning(p => {
      const n: Planning = {};
      for (const [d, j] of Object.entries(p)) {
        const jj: Partial<Record<Moment, Case>> = {};
        for (const [m, c] of Object.entries(j) as [Moment, Case][]) if (!('recetteId' in c) || c.recetteId !== id) jj[m] = c;
        if (Object.keys(jj).length) n[d] = jj;
      }
      return n;
    });
  }, [modifierPlanning]);

  const mettreCase = useCallback((date: string, moment: Moment, c: Case | null) => {
    modifierPlanning(p => {
      const jour = { ...(p[date] ?? {}) };
      if (c) jour[moment] = c; else delete jour[moment];
      const n = { ...p };
      if (Object.keys(jour).length) n[date] = jour; else delete n[date];
      return n;
    });
  }, [modifierPlanning]);

  const modifierReglages = useCallback((r: Partial<Reglages>) => {
    setReglages(g => { const n = { ...g, ...r }; db.ecrire('reglages', n); return n; });
  }, []);

  // Date du dernier repas passé avec cette recette (pour suggérer celles pas faites depuis longtemps)
  const derniereFois = useCallback((recetteId: string) => {
    const auj = aujourdhui(); let best: string | null = null;
    for (const [d, j] of Object.entries(planning)) {
      if (d > auj) continue;
      for (const c of Object.values(j)) if (c && 'recetteId' in c && c.recetteId === recetteId && (!best || d > best)) best = d;
    }
    return best;
  }, [planning]);

  const importer = useCallback(async (s: db.Sauvegarde) => {
    await db.remplacerTout(s);
    setRecettes(s.recettes); setPlanning(s.planning); setReglages({ ...REGLAGES_DEFAUT, ...s.reglages });
  }, []);

  const v: Etat = { pret, recettes, parId, planning, reglages, enregistrerRecette, supprimerRecette, mettreCase, modifierPlanning, modifierReglages, derniereFois, importer };
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export const ilYa = (d: string | null) => {
  if (!d) return 'jamais au menu';
  const n = Math.round((Date.parse(aujourdhui()) - Date.parse(d)) / 864e5);
  return n === 0 ? "au menu aujourd'hui" : n === 1 ? 'au menu hier' : n < 14 ? `il y a ${n} jours` : n < 60 ? `il y a ${Math.round(n / 7)} semaines` : `il y a ${Math.round(n / 30)} mois`;
};
export const lendemain = (d: string) => ajouterJours(d, 1);
