// Regenera public/icons/*.png a partir de scripts/icon-source.svg.
// `sharp` no es dependencia del proyecto (solo hace falta para este script):
//   npm install --no-save sharp && node scripts/generar-iconos.mjs && npm uninstall sharp
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, 'icon-source.svg');
const outDir = join(__dirname, '..', 'public', 'icons');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const outPath = join(outDir, `icon-${size}x${size}.png`);
  await sharp(svgPath, { density: (size / 512) * 96 * 4 })
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`OK ${outPath}`);
}
