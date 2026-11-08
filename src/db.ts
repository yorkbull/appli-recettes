// Stockage sur le téléphone (IndexedDB). Tout est lu au démarrage puis écrit à chaque changement.
import type { Planning, Recette, Reglages } from './types';

const NOM = 'appli-recettes';
const VERSION = 1;

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(NOM, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('recettes')) db.createObjectStore('recettes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

let dbp: Promise<IDBDatabase> | null = null;
const db = () => (dbp ??= ouvrir());

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(d => new Promise((ok, ko) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => ok(req ? req.result : undefined);
    t.onerror = () => ko(t.error);
    t.onabort = () => ko(t.error);
  }));
}

export const lireRecettes = async () => (await tx<Recette[]>('recettes', 'readonly', s => s.getAll())) ?? [];
export const ecrireRecette = (r: Recette) => tx('recettes', 'readwrite', s => { s.put(r); });
export const supprimerRecette = (id: string) => tx('recettes', 'readwrite', s => { s.delete(id); });

export const lire = <T>(cle: string) => tx<T>('kv', 'readonly', s => s.get(cle) as IDBRequest<T>);
export const ecrire = (cle: string, v: unknown) => tx('kv', 'readwrite', s => { s.put(v, cle); });

export interface Sauvegarde { version: 1; date: string; recettes: Recette[]; planning: Planning; reglages: Reglages }

export async function remplacerTout(s: Sauvegarde) {
  const d = await db();
  await new Promise<void>((ok, ko) => {
    const t = d.transaction(['recettes', 'kv'], 'readwrite');
    const rs = t.objectStore('recettes');
    rs.clear();
    for (const r of s.recettes) rs.put(r);
    t.objectStore('kv').put(s.planning, 'planning');
    t.objectStore('kv').put(s.reglages, 'reglages');
    t.oncomplete = () => ok();
    t.onerror = () => ko(t.error);
  });
}

// Demande à Android de ne pas effacer les données (accordé surtout quand l'appli est installée)
export async function demanderPersistance(): Promise<'accorde' | 'refuse' | 'indisponible'> {
  if (!navigator.storage?.persist) return 'indisponible';
  if (await navigator.storage.persisted()) return 'accorde';
  return (await navigator.storage.persist()) ? 'accorde' : 'refuse';
}
