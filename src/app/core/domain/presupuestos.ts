import type { Categoria, Movimiento } from '../models';
import type { AnioMes } from './fechas';
import { perteneceAlMes } from './fechas';

/**
 * `bien`: por debajo del 80 % del tope. `cerca`: del 80 % al tope.
 * `pasado`: por encima. El aviso amarillo llega antes de pasarse, que es
 * cuando todavía sirve.
 */
export type EstadoPresupuesto = 'bien' | 'cerca' | 'pasado';

const UMBRAL_CERCA = 0.8;

export interface PresupuestoDelMes {
  categoria: Categoria;
  gastado: number;
  tope: number;
  /** gastado / tope, sin recortar: 1.25 es "te pasaste un 25 %". */
  proporcion: number;
  /** Lo que queda antes del tope; negativo si ya se pasó. */
  restante: number;
  estado: EstadoPresupuesto;
}

/**
 * Las categorías de gasto con tope (presupuesto) y cuánto se lleva gastado
 * en cada una este mes, de la más cerca del tope a la más lejos — lo que
 * pide atención primero. Las ocultas no entran: ya no se registra en ellas.
 */
export function presupuestosDelMes(
  categorias: readonly Categoria[],
  movimientos: readonly Movimiento[],
  mes: AnioMes,
): PresupuestoDelMes[] {
  const conTope = categorias.filter(
    (c) => c.tipo === 'GASTO' && !c.archivada && (c.topeMensual ?? 0) > 0,
  );
  if (conTope.length === 0) return [];

  const gastado = new Map<string, number>();
  for (const m of movimientos) {
    if (m.tipo !== 'GASTO' || !m.categoriaId || !perteneceAlMes(m.fecha, mes)) continue;
    gastado.set(m.categoriaId, (gastado.get(m.categoriaId) ?? 0) + m.monto);
  }

  return conTope
    .map((categoria) => {
      const tope = categoria.topeMensual!;
      const total = gastado.get(categoria.id) ?? 0;
      const proporcion = total / tope;
      return {
        categoria,
        gastado: total,
        tope,
        proporcion,
        restante: tope - total,
        estado: estadoDe(proporcion),
      };
    })
    .sort((a, b) => b.proporcion - a.proporcion);
}

function estadoDe(proporcion: number): EstadoPresupuesto {
  if (proporcion > 1) return 'pasado';
  if (proporcion >= UMBRAL_CERCA) return 'cerca';
  return 'bien';
}
