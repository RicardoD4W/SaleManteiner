// Copia assets no-TS (SQL de migraciones) a dist/ después de tsc.
// tsc no copia archivos que no sean .ts por defecto.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// server/scripts/copy-assets.mjs → server/
const serverRoot = resolve(__dirname, '..');

const pairs = [
  {
    src: join(serverRoot, 'src/db/migrations'),
    dst: join(serverRoot, 'dist/db/migrations'),
    label: 'migraciones SQL',
  },
];

for (const { src, dst, label } of pairs) {
  if (!existsSync(src)) {
    console.warn(`[copy-assets] Origen no existe, se salta: ${src}`);
    continue;
  }
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log(`[copy-assets] ${label} → ${dst}`);
}
