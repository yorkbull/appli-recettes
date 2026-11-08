import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relative : l'appli marche aussi bien à la racine que sous /appli-recettes/ (GitHub Pages)
export default defineConfig({ base: './', plugins: [react()] });
