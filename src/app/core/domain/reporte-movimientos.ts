import type { Categoria, Credito, Cuenta, Movimiento, TipoMovimiento } from '../models';
import { fechaIsoDesdeLocal } from './fechas';
import { resumenMovimientos } from './movimientos-agrupados';

/** Los periodos que se pueden pedir al descargar los movimientos. */
export type PeriodoReporte = 'este-mes' | 'mes-anterior' | 'todo';

/** Desde y hasta (incluidos) en "YYYY-MM-DD"; `null` en los dos si no se acota. */
export interface RangoReporte {
  desde: string | null;
  hasta: string | null;
}

/** Las fechas de cada periodo, a partir de `hoy`. */
export function rangoReporte(periodo: PeriodoReporte, hoy: Date = new Date()): RangoReporte {
  if (periodo === 'todo') return { desde: null, hasta: null };
  const mesesAtras = periodo === 'este-mes' ? 0 : 1;
  const primero = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras, 1);
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1, 0);
  return { desde: fechaIsoDesdeLocal(primero), hasta: fechaIsoDesdeLocal(ultimo) };
}

/** Los nombres que hacen falta para que el reporte hable de cuentas y categorías, no de códigos. */
export interface CatalogosReporte {
  cuentas: Cuenta[];
  creditos: Credito[];
  categorias: Categoria[];
}

export interface FilaReporteMovimiento {
  /** "YYYY-MM-DD". */
  fecha: string;
  tipo: TipoMovimiento;
  descripcion: string;
  categoria: string;
  /** De dónde salió, a dónde llegó o ambos ("Nequi > Cuenta ahorros"). */
  cuenta: string;
  monto: number;
}

export interface ReporteMovimientos {
  rango: RangoReporte;
  filas: FilaReporteMovimiento[];
  ingresos: number;
  gastos: number;
  balance: number;
}

const NOMBRE_TIPO: Record<TipoMovimiento, string> = {
  INGRESO: 'Ingreso',
  GASTO: 'Gasto',
  TRANSFERENCIA: 'Transferencia',
  INTERNO: 'Interno',
  AJUSTE: 'Ajuste',
};

/** El nombre de un tipo de movimiento como se lee en el reporte. */
export function nombreTipoMovimiento(tipo: TipoMovimiento): string {
  return NOMBRE_TIPO[tipo];
}

/** El nombre de una cuenta; un bolsillo lleva el de su cuenta ("Ahorros › Viaje"). `undefined` si no existe. */
export function nombreDeCuenta(
  cuentas: ReadonlyMap<string, Cuenta>,
  id: string | undefined,
): string | undefined {
  if (!id) return undefined;
  const cuenta = cuentas.get(id);
  if (!cuenta) return undefined;
  const madre = cuenta.cuentaPadreId ? cuentas.get(cuenta.cuentaPadreId) : undefined;
  return madre ? `${madre.nombre} › ${cuenta.nombre}` : cuenta.nombre;
}

/**
 * Los movimientos del rango, de más viejo a más nuevo, con cuentas y
 * categorías por su nombre y los totales de ingresos y gastos (los mismos
 * que muestra General: ver `resumenMovimientos`). Una cuenta archivada sigue
 * saliendo con su nombre.
 */
export function armarReporteMovimientos(
  movimientos: Movimiento[],
  catalogos: CatalogosReporte,
  rango: RangoReporte,
): ReporteMovimientos {
  const cuentas = new Map(catalogos.cuentas.map((c) => [c.id, c]));
  const creditos = new Map(catalogos.creditos.map((c) => [c.id, c.nombre]));
  const categorias = new Map(catalogos.categorias.map((c) => [c.id, c.nombre]));

  const nombreCuenta = (id: string | undefined) => nombreDeCuenta(cuentas, id);

  const dentro = movimientos
    .filter((m) => (rango.desde === null || m.fecha >= rango.desde) && (rango.hasta === null || m.fecha <= rango.hasta))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn));

  const filas = dentro.map((m): FilaReporteMovimiento => {
    const origen = nombreCuenta(m.cuentaOrigenId) ?? creditos.get(m.creditoOrigenId ?? '');
    const destino = nombreCuenta(m.cuentaDestinoId) ?? creditos.get(m.creditoDestinoId ?? '');
    const cuenta = origen && destino ? `${origen} > ${destino}` : (origen ?? destino ?? '');
    return {
      fecha: m.fecha,
      tipo: m.tipo,
      descripcion: m.descripcion,
      categoria: categorias.get(m.categoriaId ?? '') ?? '',
      cuenta,
      monto: m.monto,
    };
  });

  const { ingresos, gastos, balance } = resumenMovimientos(dentro);
  return { rango, filas, ingresos, gastos, balance };
}
