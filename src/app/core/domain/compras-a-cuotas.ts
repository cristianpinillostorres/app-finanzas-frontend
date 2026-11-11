import type { CompraCuotas, Movimiento } from '../models';

/**
 * Los gastos del mes separados en "día a día" y "compras a cuotas".
 *
 * Una compra a cuotas (el celular en 25 cuotas) entra de golpe como un gasto
 * enorme, aunque lo que de verdad pesa cada mes es su cuota. Mezclada con el
 * resto, aplasta las barras de las categorías y hace ver el café como nada.
 * Se reconoce porque quien la registró eligió más de una cuota: no hay nada
 * que marcar aparte.
 */
export interface GastosSeparados {
  /** Todo lo demás: lo que se mide contra los topes y se ve por categoría. */
  diaADia: Movimiento[];
  /** Los gastos hechos en 2 o más cuotas. */
  aCuotas: Movimiento[];
}

export function separarComprasACuotas(
  movimientos: readonly Movimiento[],
  compras: readonly CompraCuotas[],
): GastosSeparados {
  const aPlazos = new Set(compras.filter((c) => c.numCuotas > 1).map((c) => c.movimientoId));
  const diaADia: Movimiento[] = [];
  const aCuotas: Movimiento[] = [];
  for (const m of movimientos) {
    if (m.tipo === 'GASTO' && aPlazos.has(m.id)) aCuotas.push(m);
    else diaADia.push(m);
  }
  return { diaADia, aCuotas };
}
