// main.ts — Stormspire Duel: the program that hands the game in.
// It copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. Standard library only; deterministic: two runs
// write the same bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
} as const;

/** Copy a directory tree, files sorted, so the run is deterministic. */
function copyTreeSorted(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  const entries = readdirSync(source, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) copyTreeSorted(from, to);
    else if (entry.isFile()) cpSync(from, to);
    else throw new Error(`main.ts: ${from} is not a plain file or directory`);
  }
}

/** Ensure the output directory exists — never remove it or its contents: the
 *  grader mounts /output on a read-only root, so its parent is not writable
 *  and removing the directory itself fails with EACCES, and deleting contents
 *  can fail the same way when they are not ours to remove. The grader hands
 *  us an empty /output; copyTreeSorted overwrites into it deterministically. */
function prepareOutput(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const st = statSync(dir);
  if (!st.isDirectory()) throw new Error(`main.ts: output ${dir} is not a directory`);
}

/** Re-read the dossier we just wrote and prove it is the one buildDossier made. */
function verifyOutput(dir: string, expectedGameFiles: string[]): void {
  const dossierPath = join(dir, 'dossier.json');
  const parsed = JSON.parse(readFileSync(dossierPath, 'utf8')) as { schema?: unknown; text?: unknown };
  if (parsed.schema !== 'makefun/dossier/v1') {
    throw new Error(`main.ts: dossier.json has schema ${String(parsed.schema)} — not the dossier this program writes`);
  }
  if (typeof parsed.text !== 'string') throw new Error('main.ts: dossier.json holds no text block');
  for (const file of expectedGameFiles) {
    if (!parsed.text.includes(`### game/${file}`)) {
      throw new Error(`main.ts: dossier text is missing game/${file} — refusing a partial hand-in`);
    }
  }
}

function main(): void {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('main.ts: game/index.html is missing — the game is not built');
  }
  if (!existsSync(shotsDir)) {
    throw new Error('main.ts: screenshots/ is missing — take the screenshots first');
  }
  prepareOutput(outDir);
  copyTreeSorted(gameDir, join(outDir, 'game'));
  copyTreeSorted(shotsDir, join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  const shotCount = readdirSync(join(outDir, 'screenshots')).filter((n) => !n.startsWith('.')).length;
  console.log(`main.ts: wrote ${outDir} — game/, ${shotCount} screenshots, dossier.json (${dossier.length} bytes)`);
  const gameFiles = readdirSync(join(outDir, 'game'), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(join(outDir, 'game').length + 1))
    .sort();
  verifyOutput(outDir, gameFiles);
  console.log(`main.ts: verified dossier.json — schema ok, ${gameFiles.length} game files named in its text`);
}

main();
