// SALTLINE — make.fun "best three.js tactical FPS" (threejs-fps-02).
// Entry program: copies the static game and its screenshots into the output
// directory and writes dossier.json with the vendored make.fun library.
// Runs on plain Node 22.18+ with type stripping; only Node built-ins plus
// ./vendor/makefun-threejs.ts. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//   MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Skip dotfiles (for example .DS_Store) when copying: the gate counts
// every file in game/, and a stray dotfile would break the dossier.
const notDotfile = (src: string): boolean => !basename(src).startsWith('.');

// Copy one tree, skipping dotfiles. Used for game/ and screenshots/.
function copyTree(from: string, to: string): void {
  cpSync(from, to, { recursive: true, filter: notDotfile });
}

mkdirSync(out, { recursive: true });
copyTree(join(here, 'game'), join(out, 'game'));
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  copyTree(join(here, 'screenshots'), join(out, 'screenshots'));
}

// The caps are the gate's own (reference/gate.json): at most 4 screenshots
// of 256 KiB, at most 993 game files / 48 MiB, source text capped at
// 160 KiB (163840 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 }),
);
