// Chequeo de la base compartida, pensado para correr SIN ver Marca/ ni Base-desarrollo/
// (el CI y OpenShift solo tienen este repo). Corre al commitear (husky) y antes de cada
// `npm run build` (prebuild), así que también frena el build de OCP.
//
// Comprueba:
//  1. Las copias de src/assets/base/ coinciden con las huellas de MANIFEST.json
//     (nadie las editó a mano). Saltos de línea normalizados a LF.
//  2. Todo var(--rv-*) usado en la base o en la app existe en ranvi-lab.tokens.css.
//
// No puede saber si Marca cambió después de la última sincronización: eso lo avisa el
// hook del arnés en la carpeta RANVI LAB (sincronizar_app.py --check).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const dirBase = join(raiz, 'src', 'assets', 'base');
const errores = [];

const huella = ruta =>
  createHash('sha256').update(readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const rutaManifiesto = join(dirBase, 'MANIFEST.json');
if (!existsSync(rutaManifiesto)) {
  console.error('Falta src/assets/base/MANIFEST.json. Sincroniza la base desde RANVI LAB/Base-desarrollo.');
  process.exit(1);
}
const manifiesto = JSON.parse(readFileSync(rutaManifiesto, 'utf8'));

// 1. Huellas
for (const [archivo, esperada] of Object.entries(manifiesto.archivos ?? {})) {
  const ruta = join(raiz, archivo);
  if (!existsSync(ruta)) {
    errores.push(`${archivo}: falta.`);
  } else if (huella(ruta) !== esperada) {
    errores.push(`${archivo}: fue editado a mano (no coincide con la sincronización). Edita Base-desarrollo/ y vuelve a sincronizar.`);
  }
}

// 2. Referencias a tokens de Marca
const tokensCss = join(dirBase, 'ranvi-lab.tokens.css');
const definidos = new Set();
if (existsSync(tokensCss)) {
  for (const m of readFileSync(tokensCss, 'utf8').matchAll(/(--rv-[a-z0-9-]+)\s*:/g)) definidos.add(m[1]);
}

function archivos(dir, salida = []) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre === 'node_modules') continue;
      archivos(ruta, salida);
    } else if (/\.(scss|css|html|ts)$/.test(nombre)) {
      salida.push(ruta);
    }
  }
  return salida;
}

for (const ruta of archivos(join(raiz, 'src'))) {
  if (ruta === tokensCss) continue; // las propias definiciones se referencian entre sí
  const texto = readFileSync(ruta, 'utf8');
  for (const m of texto.matchAll(/var\(\s*(--rv-[a-z0-9-]+)/g)) {
    if (!definidos.has(m[1])) {
      errores.push(`${relative(raiz, ruta).split(sep).join('/')}: usa ${m[1]}, que no existe en ranvi-lab.tokens.css.`);
    }
  }
}

if (errores.length) {
  console.error('Base compartida con problemas:');
  for (const e of [...new Set(errores)]) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`Base compartida coherente (${definidos.size} tokens de Marca, sincronizada ${manifiesto.sincronizado}).`);
