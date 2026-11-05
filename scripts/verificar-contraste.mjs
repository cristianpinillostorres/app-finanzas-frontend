// Verifica WCAG AA sobre la paleta real del sistema de diseño.
//
//   node scripts/verificar-contraste.mjs
//
// Lee los hex de `_primitivas.scss` y las asignaciones de cada tema en
// `_semanticos.scss`, resuelve las cadenas `var(--x)` y calcula el
// contraste de cada par texto/fondo que existe de verdad en la interfaz.
// Al leer los archivos en vez de repetir los valores, no puede quedar
// desactualizado: si alguien cambia un token y rompe el contraste, esto
// falla (sale con código 1).
//
// Umbrales: AA pide 4.5:1 para texto normal y 3:1 para texto grande y para
// componentes de interfaz cuyo borde es su única señal (los inputs).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');

// ── lectura de los tokens ──

/** `--p-nombre: #hex;` → { '--p-nombre': '#hex' } */
function leerPrimitivas(css) {
  const mapa = {};
  for (const [, nombre, hex] of css.matchAll(/(--p-[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    mapa[nombre] = hex;
  }
  return mapa;
}

/** Cuerpo de `@mixin nombre { ... }` (un nivel de llaves, que es lo que hay). */
function cuerpoDelMixin(css, nombre) {
  const inicio = css.indexOf(`@mixin ${nombre}`);
  if (inicio === -1) throw new Error(`No se encontró el mixin ${nombre}`);
  const abre = css.indexOf('{', inicio);
  let nivel = 0;
  for (let i = abre; i < css.length; i++) {
    if (css[i] === '{') nivel++;
    else if (css[i] === '}' && --nivel === 0) return css.slice(abre + 1, i);
  }
  throw new Error(`Mixin ${nombre} sin cerrar`);
}

/** `--x: var(--y);` o `--x: #hex;` → { '--x': 'var(--y)' | '#hex' } */
function leerAsignaciones(css) {
  const mapa = {};
  for (const [, nombre, valor] of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    mapa[nombre] = valor.trim();
  }
  return mapa;
}

/** Sigue la cadena `var(--a)` → `var(--b)` → `#hex`. */
function resolver(nombre, capas) {
  let valor = nombre;
  for (let salto = 0; salto < 10; salto++) {
    for (const capa of capas) {
      if (valor in capa) {
        valor = capa[valor];
        break;
      }
    }
    const ref = valor.match(/^var\((--[\w-]+)\)$/);
    if (ref) {
      valor = ref[1];
      continue;
    }
    if (valor.startsWith('#')) return valor;
  }
  throw new Error(`No se pudo resolver ${nombre} a un hex (quedó en "${valor}")`);
}

// ── contraste ──

const canal = (c) => {
  const n = c / 255;
  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
};

function luminancia(hex) {
  const limpio = hex.replace('#', '');
  const largo =
    limpio.length === 3
      ? limpio
          .split('')
          .map((x) => x + x)
          .join('')
      : limpio;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(largo.slice(i, i + 2), 16));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

// ── pares que existen en la interfaz ──
// [primerPlano, fondo, mínimo, dónde se ve]
const PARES = [
  ['--text-primary', '--bg-page', 4.5, 'texto sobre la página'],
  ['--text-primary', '--bg-surface', 4.5, 'texto en tarjeta/panel'],
  ['--text-primary', '--bg-subtle', 4.5, 'texto en stat-card / inset'],
  ['--text-secondary', '--bg-surface', 4.5, 'subtítulo de fila, .kv'],
  ['--text-secondary', '--bg-subtle', 4.5, 'secundario en inset'],
  ['--text-muted', '--bg-surface', 4.5, '.t-meta en panel'],
  ['--text-muted', '--bg-page', 4.5, '.t-meta suelto'],
  ['--text-muted', '--bg-subtle', 4.5, '.t-meta en inset'],
  ['--text-muted', '--bg-raised', 4.5, 'ayuda en diálogo, hoja y menú'],
  ['--text-muted', '--bg-sunken', 4.5, 'placeholder de .input, pie de crédito'],
  ['--color-gasto', '--bg-sunken', 4.5, '"Venció el" en el pie de crédito'],
  ['--accent', '--bg-raised', 4.5, 'título de diálogo y enlaces en hoja'],
  ['--accent', '--bg-surface', 4.5, 'enlaces y .btn-text'],
  ['--accent', '--bg-page', 4.5, 'enlaces sobre la página'],
  ['--accent', '--accent-bg', 4.5, 'chip activo'],
  ['--text-on-accent', '--accent-solid', 4.5, '.btn-primary y FAB'],
  ['--color-ingreso', '--bg-surface', 4.5, 'monto de ingreso'],
  ['--color-ingreso', '--bg-subtle', 4.5, 'ingreso en stat-card'],
  ['--color-ingreso', '--color-ingreso-bg', 4.5, 'badge verde'],
  ['--color-gasto', '--bg-surface', 4.5, 'monto de gasto'],
  ['--color-gasto', '--bg-subtle', 4.5, 'gasto en stat-card'],
  ['--color-gasto', '--color-gasto-bg', 4.5, 'badge rojo'],
  ['--color-deuda', '--bg-surface', 4.5, 'monto de deuda'],
  ['--color-deuda', '--bg-subtle', 4.5, 'deuda en stat-card'],
  ['--color-deuda', '--color-deuda-bg', 4.5, 'badge ámbar'],
  ['--text-on-inverse', '--bg-inverse', 4.5, 'texto del aviso (snack bar)'],
  ['--accent-on-inverse', '--bg-inverse', 4.5, 'acción del aviso (snack bar)'],
  // El borde del input es su única señal de "esto es un campo": 3:1 (1.4.11).
  ['--border-control', '--bg-surface', 3, 'borde de .input'],
  ['--border-control', '--bg-page', 3, 'borde de .input sobre la página'],
  ['--focus-color', '--bg-surface', 3, 'anillo de foco'],
  ['--text-on-marca', '--bg-marca', 4.5, 'lema del panel de marca (login)'],
  ['--text-on-marca-secundario', '--bg-marca', 4.5, 'lista del panel de marca (login)'],
  ['--marca-textura', '--bg-marca', 3, 'ícono del panel de marca (login)'],
];

// ── ejecución ──

const primitivas = leerPrimitivas(leer('src/styles/tokens/_primitivas.scss'));
const semanticos = leer('src/styles/tokens/_semanticos.scss');
// El bloque `:root` trae los alias comunes a los dos temas (semáforo,
// `--focus-color`...); cada mixin trae lo que cambia entre temas.
const comunes = leerAsignaciones(semanticos.slice(semanticos.indexOf(':root {')));
/**
 * Asignaciones de un mixin ya con las de los mixins que incluye (`@include`):
 * primero las heredadas y encima las propias, como lo hace Sass.
 */
function asignacionesDelMixin(nombre) {
  const cuerpo = cuerpoDelMixin(semanticos, nombre);
  const heredadas = {};
  for (const [, otro] of cuerpo.matchAll(/@include\s+([\w-]+)\s*;/g)) {
    Object.assign(heredadas, asignacionesDelMixin(otro));
  }
  return { ...heredadas, ...leerAsignaciones(cuerpo) };
}

const temas = {
  'teal claro': asignacionesDelMixin('tokens-claro'),
  'teal oscuro': asignacionesDelMixin('tokens-oscuro'),
  'neutro claro': asignacionesDelMixin('tokens-neutro-claro'),
  'neutro oscuro': asignacionesDelMixin('tokens-neutro-oscuro'),
  'medianoche claro': asignacionesDelMixin('tokens-medianoche-claro'),
  'medianoche oscuro': asignacionesDelMixin('tokens-medianoche-oscuro'),
  'brasa claro': asignacionesDelMixin('tokens-brasa-claro'),
  'brasa oscuro': asignacionesDelMixin('tokens-brasa-oscuro'),
  'marino claro': asignacionesDelMixin('tokens-marino-claro'),
  'marino oscuro': asignacionesDelMixin('tokens-marino-oscuro'),
};

let fallos = 0;
for (const [nombreTema, propios] of Object.entries(temas)) {
  const capas = [propios, comunes, primitivas];
  console.log(`\n=== TEMA ${nombreTema.toUpperCase()} ===`);
  for (const [frente, fondo, minimo, donde] of PARES) {
    const razon = contraste(resolver(frente, capas), resolver(fondo, capas));
    const pasa = razon >= minimo;
    if (!pasa) fallos++;
    const marca = pasa ? 'OK   ' : 'FALLA';
    console.log(
      `${marca} ${razon.toFixed(2).padStart(5)}:1 (min ${minimo})  ` +
        `${frente} sobre ${fondo} — ${donde}`,
    );
  }
}

if (fallos > 0) {
  console.error(`\n${fallos} par(es) no llegan a WCAG AA.`);
  process.exit(1);
}
console.log('\nTodos los pares cumplen WCAG AA en los diez temas.');
