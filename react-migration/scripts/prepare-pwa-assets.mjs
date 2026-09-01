import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const reactRoot = path.resolve(here, '..');
const repoRoot = path.resolve(reactRoot, '..');
const sourceDir = path.join(repoRoot, 'assets');
const targetDir = path.join(reactRoot, 'public', 'assets');

const files = [
  'apple-touch-icon.png',
  'pwa-icon-192.png',
  'pwa-icon-512.png',
  'pwa-icon-maskable-512.png'
];

await mkdir(targetDir, { recursive: true });
await Promise.all(files.map((file) => copyFile(path.join(sourceDir, file), path.join(targetDir, file))));
