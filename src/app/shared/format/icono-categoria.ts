import type { Categoria, TipoMovimiento } from '../../core/models';

/** Ícono de respaldo según el tipo, para movimientos sin categoría. */
const ICONO_POR_TIPO: Record<TipoMovimiento, string> = {
  INGRESO: 'arrow_downward',
  GASTO: 'arrow_upward',
  TRANSFERENCIA: 'swap_horiz',
  INTERNO: 'sync_alt',
  AJUSTE: 'tune',
};

/**
 * Ícono de una fila de movimiento: el de su categoría si la tiene (cada
 * categoría trae el suyo, editable desde Categorías), y si no el de su
 * tipo. Una transferencia o un ajuste nunca llevan categoría, así que para
 * ellos el respaldo es siempre el camino normal, no un caso raro.
 */
export function iconoDeMovimiento(
  tipo: TipoMovimiento,
  categoriaId: string | null | undefined,
  categorias: readonly Categoria[],
): string {
  const categoria = categoriaId ? categorias.find((c) => c.id === categoriaId) : undefined;
  return categoria?.icono ?? ICONO_POR_TIPO[tipo];
}

/** Clase de color del ícono, alineada con la semántica de montos. */
export function claseIconoDeMovimiento(tipo: TipoMovimiento): string {
  if (tipo === 'INGRESO') return 'ico--ingreso';
  if (tipo === 'GASTO') return 'ico--gasto';
  if (tipo === 'AJUSTE') return 'ico--deuda';
  return '';
}
