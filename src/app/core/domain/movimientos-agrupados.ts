import type { Categoria, Cuenta, Movimiento, TipoMovimiento } from '../models';
import { diasEntre, fechaLocalDesdeIso } from './fechas';

/** Tipos que caen bajo el chip "Transferencias" — ver `FiltroTipoMovimiento`. */
const TIPOS_NO_INGRESO_GASTO: TipoMovimiento[] = ['TRANSFERENCIA', 'INTERNO', 'AJUSTE'];

/** Ingresos, gastos y balance de un conjunto de movimientos (normalmente los
 * de un mes). Transferencias, movimientos internos y ajustes no cuentan —
 * ver "Tab Movimientos" en notas-app-finanzas.md. */
export interface ResumenMovimientos {
  ingresos: number;
  gastos: number;
  balance: number;
}

export function resumenMovimientos(movimientos: Movimiento[]): ResumenMovimientos {
  const ingresos = movimientos
    .filter((m) => m.tipo === 'INGRESO')
    .reduce((acc, m) => acc + m.monto, 0);
  const gastos = movimientos.filter((m) => m.tipo === 'GASTO').reduce((acc, m) => acc + m.monto, 0);
  return { ingresos, gastos, balance: ingresos - gastos };
}

/**
 * Filtro por tipo de la barra de chips. El prototipo solo tiene 4 chips
 * (Todos/Gastos/Ingresos/Transferencias): no hay uno aparte para ajustes ni
 * movimientos internos, así que 'transferencia' agrupa todo lo que no es un
 * ingreso ni un gasto (transferencias, internos y ajustes) — el interruptor
 * "Mostrar movimientos internos" sigue mandando por separado sobre los
 * internos, sin importar el chip elegido.
 */
export type FiltroTipoMovimiento = 'todos' | 'GASTO' | 'INGRESO' | 'transferencia';

/**
 * Filtro por fecha de la hoja de filtros (móvil). 'todo-mes' no acota nada
 * más allá del mes ya seleccionado arriba; 'rango' usa `desde`/`hasta`. En
 * escritorio no hay selector de modo — los dos campos de fecha siempre
 * visibles equivalen a operar siempre en modo 'rango' (ver `MovimientosPage`).
 */
export type FiltroFecha = 'todo-mes' | 'hoy' | '7-dias' | 'rango';

export interface FiltrosMovimientos {
  tipo: FiltroTipoMovimiento;
  fecha: FiltroFecha;
  /** "YYYY-MM-DD", solo relevantes con `fecha: 'rango'`. */
  desde: string | null;
  hasta: string | null;
  /** Cuenta raíz o crédito, o `null` para "Todas". Una cuenta raíz incluye sus bolsillos. */
  cuentaOCreditoId: string | null;
  categoriaId: string | null;
  texto: string;
  /** Movimientos INTERNO (saldo libre ↔ bolsillos), ocultos por defecto. */
  mostrarInternos: boolean;
}

/** Valores por defecto de cada grupo de la hoja de filtros — usado para el
 * estado inicial y para "Limpiar" (que no toca `texto`: la búsqueda no es
 * parte de la hoja, ver `contarFiltrosActivos`). */
export const FILTROS_MOVIMIENTOS_DEFECTO: Omit<FiltrosMovimientos, 'texto'> = {
  tipo: 'todos',
  fecha: 'todo-mes',
  desde: null,
  hasta: null,
  cuentaOCreditoId: null,
  categoriaId: null,
  mostrarInternos: false,
};

/** Cuántos grupos de filtro están fuera de su valor por defecto — para el
 * badge del chip "Filtros" en móvil. El buscador no cuenta: es búsqueda, no
 * filtro (ver notas del handoff de diseño). */
export function contarFiltrosActivos(filtros: FiltrosMovimientos): number {
  let contador = 0;
  if (filtros.tipo !== 'todos') contador++;
  if (filtros.fecha !== 'todo-mes') contador++;
  if (filtros.cuentaOCreditoId !== null) contador++;
  if (filtros.categoriaId !== null) contador++;
  if (filtros.mostrarInternos) contador++;
  return contador;
}

/** Categorías que tienen al menos un movimiento en la lista dada (normalmente
 * los del mes seleccionado, antes de aplicar el resto de los filtros) — así
 * el filtro "Categoría" no ofrece categorías vacías ese mes. */
export function categoriasConMovimientos(
  categorias: Categoria[],
  movimientos: Movimiento[],
): Categoria[] {
  const idsUsados = new Set(
    movimientos.map((m) => m.categoriaId).filter((id): id is string => id !== undefined),
  );
  return categorias.filter((c) => idsUsados.has(c.id));
}

function coincideCuentaOCredito(movimiento: Movimiento, id: string, cuentas: Cuenta[]): boolean {
  const piezas = [movimiento.cuentaOrigenId, movimiento.cuentaDestinoId].filter(
    (x): x is string => x !== undefined,
  );
  const cuentaCoincide = piezas.some((piezaId) => {
    if (piezaId === id) return true;
    return cuentas.find((c) => c.id === piezaId)?.cuentaPadreId === id;
  });
  const creditoCoincide = movimiento.creditoOrigenId === id || movimiento.creditoDestinoId === id;
  return cuentaCoincide || creditoCoincide;
}

function coincideTexto(
  movimiento: Movimiento,
  texto: string,
  nombreCategoria: string | undefined,
): boolean {
  const normalizado = texto.trim().toLowerCase();
  if (!normalizado) return true;
  return (
    movimiento.descripcion.toLowerCase().includes(normalizado) ||
    (nombreCategoria?.toLowerCase().includes(normalizado) ?? false)
  );
}

/** 'hoy' y '7-dias' se calculan contra `hoy` (recibido, no `new Date()` interno
 * — mismo criterio que `estadoPagoCredito`, para que esto siga siendo puro y
 * testeable). 'rango' compara directo los "YYYY-MM-DD" (orden lexicográfico
 * == orden cronológico), sin acotar nada si falta `desde`/`hasta`. */
function coincideFecha(movimiento: Movimiento, filtros: FiltrosMovimientos, hoy: Date): boolean {
  if (filtros.fecha === 'todo-mes') return true;
  if (filtros.fecha === 'hoy') return diasEntre(fechaLocalDesdeIso(movimiento.fecha), hoy) === 0;
  if (filtros.fecha === '7-dias') {
    const dias = diasEntre(fechaLocalDesdeIso(movimiento.fecha), hoy);
    return dias >= 0 && dias <= 6;
  }
  if (filtros.desde && movimiento.fecha < filtros.desde) return false;
  if (filtros.hasta && movimiento.fecha > filtros.hasta) return false;
  return true;
}

/** Aplica los filtros de la vista (chips, fecha, cuenta/crédito, categoría,
 * buscador e "internos") sobre un conjunto de movimientos (normalmente los
 * del mes seleccionado). `hoy` solo lo usan los modos 'hoy'/'7-dias'. */
export function filtrarMovimientos(
  movimientos: Movimiento[],
  filtros: FiltrosMovimientos,
  cuentas: Cuenta[],
  categorias: Categoria[],
  hoy: Date,
): Movimiento[] {
  return movimientos.filter((m) => {
    if (m.tipo === 'INTERNO' && !filtros.mostrarInternos) return false;
    if (filtros.tipo === 'GASTO' && m.tipo !== 'GASTO') return false;
    if (filtros.tipo === 'INGRESO' && m.tipo !== 'INGRESO') return false;
    if (filtros.tipo === 'transferencia' && !TIPOS_NO_INGRESO_GASTO.includes(m.tipo)) return false;
    if (!coincideFecha(m, filtros, hoy)) return false;
    if (filtros.cuentaOCreditoId && !coincideCuentaOCredito(m, filtros.cuentaOCreditoId, cuentas))
      return false;
    if (filtros.categoriaId && m.categoriaId !== filtros.categoriaId) return false;
    const nombreCategoria = categorias.find((c) => c.id === m.categoriaId)?.nombre;
    if (!coincideTexto(m, filtros.texto, nombreCategoria)) return false;
    return true;
  });
}

/** Movimientos de un mismo día calendario ("YYYY-MM-DD"), más recientes primero. */
export interface GrupoDiaMovimientos {
  fecha: string;
  movimientos: Movimiento[];
}

/** Agrupa movimientos por día, del más reciente al más antiguo. El texto de
 * cada grupo ("Hoy", "Ayer"...) se arma en la capa de presentación, ver
 * `shared/format/fecha.ts` → `etiquetaDia`. */
export function agruparMovimientosPorDia(movimientos: Movimiento[]): GrupoDiaMovimientos[] {
  const ordenados = [...movimientos].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn),
  );
  const porFecha = new Map<string, Movimiento[]>();
  for (const movimiento of ordenados) {
    const lista = porFecha.get(movimiento.fecha) ?? [];
    lista.push(movimiento);
    porFecha.set(movimiento.fecha, lista);
  }
  return [...porFecha.entries()].map(([fecha, movs]) => ({ fecha, movimientos: movs }));
}
