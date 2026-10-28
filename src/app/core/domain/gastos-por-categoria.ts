import type { Categoria, Movimiento } from '../models';
import type { AnioMes } from './fechas';
import { perteneceAlMes } from './fechas';

/** Un gasto de una categoría en un mes, con su barra relativa a la categoría mayor. */
export interface CategoriaConGasto {
  categoriaId: string;
  nombre: string;
  monto: number;
  /** 0-100, relativo al monto de la categoría con más gasto (esa queda en 100). */
  porcentaje: number;
}

/**
 * Gastos del mes agrupados por categoría, de mayor a menor (panel "Gastos
 * por categoría" de General — ver `notas-app-finanzas.md`, "Tab General":
 * "esto hace de reportes básicos por ahora"). Los gastos sin categoría no
 * entran (no hay dónde agruparlos).
 */
export function gastosPorCategoriaDelMes(
  movimientos: Movimiento[],
  categorias: Categoria[],
  mes: AnioMes,
): CategoriaConGasto[] {
  const porCategoria = new Map<string, number>();
  for (const m of movimientos) {
    if (m.tipo !== 'GASTO' || !m.categoriaId || !perteneceAlMes(m.fecha, mes)) continue;
    porCategoria.set(m.categoriaId, (porCategoria.get(m.categoriaId) ?? 0) + m.monto);
  }

  const items = [...porCategoria.entries()]
    .map(([categoriaId, monto]) => ({
      categoriaId,
      nombre: categorias.find((c) => c.id === categoriaId)?.nombre ?? '',
      monto,
    }))
    .sort((a, b) => b.monto - a.monto);

  const max = items[0]?.monto ?? 0;
  return items.map((item) => ({
    ...item,
    porcentaje: max > 0 ? Math.round((item.monto / max) * 100) : 0,
  }));
}
