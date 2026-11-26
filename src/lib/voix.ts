// Commande vocale gratuite : reconnaissance de la parole intégrée à Chrome (Android) et lecture à voix haute.
import { useEffect, useRef, useState } from 'react';

type Reco = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start: () => void; stop: () => void;
};
const Classe = (): (new () => Reco) | undefined => {
  const w = window as unknown as { SpeechRecognition?: new () => Reco; webkitSpeechRecognition?: new () => Reco };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
export const voixDisponible = () => !!Classe();

export function parler(texte: string) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR'; u.rate = 1;
    speechSynthesis.speak(u);
  } catch { /* pas de voix sur ce téléphone */ }
}

// Écoute en continu tant que « actif » ; chaque phrase reconnue est passée à onPhrase (en minuscules, sans accents)
export function useEcoute(onPhrase: (phrase: string) => void) {
  const [actif, setActif] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const rappel = useRef(onPhrase);
  rappel.current = onPhrase;
  useEffect(() => {
    const C = Classe();
    if (!actif || !C) return;
    let fini = false;
    const r = new C();
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = false;
    r.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) {
        rappel.current(e.results[i][0].transcript.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
      }
    };
    r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setErreur('Micro refusé : autorisez-le dans Chrome pour cette appli.'); fini = true; setActif(false); } };
    r.onend = () => { if (!fini) try { r.start(); } catch { /* déjà relancée */ } };
    try { r.start(); setErreur(null); } catch { /* déjà lancée */ }
    // écran allumé pendant l'écoute
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    return () => { fini = true; try { r.stop(); } catch { /* déjà arrêtée */ } lock?.release().catch(() => {}); };
  }, [actif]);
  return { actif, setActif, erreur };
}

// Sonnerie de fin de minuteur
export function alerte() {
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach(t => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = 880; g.gain.value = 0.2; o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2); });
  } catch { /* pas de son disponible */ }
}
