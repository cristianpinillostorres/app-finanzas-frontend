/**
 * Colores de las gráficas.
 *
 * Los colores de *serie* (identidad: qué categoría es cada porción de la
 * dona) no salen de los tokens de tema: son una paleta categórica
 * verificada aparte, porque un tema de interfaz optimiza contraste de texto
 * y una paleta categórica optimiza que ocho colores se distingan entre sí,
 * incluso con daltonismo. Son dos problemas distintos.
 *
 * Verificada con el validador de la guía de visualización de datos, con las
 * superficies reales de esta app (`--bg-surface`):
 *
 *   node scripts/validate_palette.js "<hexes>" --mode light  --surface "#ffffff"
 *   node scripts/validate_palette.js "<hexes>" --mode dark   --surface "#12151a"
 *
 * Resultado: pasa banda de luminosidad, piso de croma, separación bajo
 * protanopia/deuteranopia (peor par adyacente ΔE 9.1 claro / 8.4 oscuro) y
 * piso de visión normal (19.6 / 19.3).
 *
 * En modo claro, tres slots quedan por debajo de 3:1 contra el blanco. Eso
 * activa la "regla de alivio": es legal solo si el valor se puede leer de
 * otra forma. Por eso la dona **siempre** va acompañada de su leyenda con
 * nombre y monto en texto — no es decoración opcional, es el requisito de
 * accesibilidad que hace válida a la paleta. Ver `DonutCategorias`.
 *
 * El orden es fijo y las categorías se asignan en secuencia, nunca cíclica:
 * un color de más no se "genera", la cola se agrupa en "Otras".
 */

/** Slots 1-7 de la paleta categórica, escalonados para superficie clara. */
export const SERIES_CLARO: readonly string[] = [
  '#2a78d6', // azul
  '#eb6834', // naranja
  '#1baf7a', // aqua
  '#eda100', // amarillo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
];

/** Los mismos siete tonos, escalonados para superficie oscura. */
export const SERIES_OSCURO: readonly string[] = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
];

/**
 * Cuántas categorías reciben color propio antes de agrupar el resto. Siete
 * es el techo de la paleta; con seis queda el séptimo slot para "Otras",
 * que así también tiene un color estable y no se confunde con una categoría
 * real.
 */
export const MAX_CATEGORIAS_CON_COLOR = 6;

export function coloresDeSerie(oscuro: boolean): readonly string[] {
  return oscuro ? SERIES_OSCURO : SERIES_CLARO;
}

/**
 * Lee un token semántico del tema activo, ya resuelto a un color concreto.
 *
 * ApexCharts pinta con valores, no con CSS: no se le puede pasar
 * `var(--text-muted)`. En vez de duplicar los hex del tema en TypeScript
 * (que se desincronizaría en el primer cambio de paleta), se leen del
 * `:root` en tiempo de ejecución. `getComputedStyle` devuelve la propiedad
 * personalizada ya sustituida, así que resuelve toda la cadena
 * `--text-muted` → `--p-slate-400` → `#8b95a5`.
 */
export function leerColorToken(nombre: string, respaldo = '#808080'): string {
  if (typeof getComputedStyle !== 'function') return respaldo;
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return valor || respaldo;
}

/** Colores de los elementos no-dato de una gráfica (ejes, grilla, texto). */
export interface CromaticaBase {
  texto: string;
  textoTenue: string;
  grilla: string;
  superficie: string;
}

export function cromaticaBase(): CromaticaBase {
  return {
    texto: leerColorToken('--text-secondary'),
    textoTenue: leerColorToken('--text-muted'),
    grilla: leerColorToken('--border'),
    superficie: leerColorToken('--bg-surface'),
  };
}
