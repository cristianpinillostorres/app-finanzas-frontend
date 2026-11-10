import type { CompraCuotas, Credito, Cuenta, Movimiento } from '../models';
import { cuotasFaltantesCompra, valorCuotaCompra } from './creditos';
import { nombreDeCuenta } from './reporte-movimientos';

/** Una compra a cuotas, con en qué cuota va y cuánto queda por pagar de ella. */
export interface FilaCompraCredito {
  /** Cuándo se hizo la compra ("YYYY-MM-DD"). */
  fecha: string;
  descripcion: string;
  monto: number;
  /** En qué cuota va; con la compra terminada, la última. */
  cuotaActual: number;
  numCuotas: number;
  valorCuota: number;
  saldoPendiente: number;
  terminada: boolean;
}

export interface FilaPagoCredito {
  fecha: string;
  /** De qué cuenta salió el dinero. */
  cuenta: string;
  monto: number;
}

export interface ReporteCredito {
  nombre: string;
  compras: FilaCompraCredito[];
  pagos: FilaPagoCredito[];
  /** Lo que queda por pagar de todas las compras. */
  deuda: number;
  /** La suma de las cuotas de las compras que todavía no terminan. */
  cuotaDelMes: number;
  totalPagado: number;
  /** El cupo menos la deuda; `null` si el crédito no tiene cupo. */
  cupoDisponible: number | null;
}

/**
 * Las compras a cuotas y los pagos de una tarjeta o plataforma, para
 * compararlos con su extracto línea por línea. Las cuentas de los pagos van
 * por su nombre. Cuenta las cuotas igual que el resto de la app
 * (`cuotasFaltantesCompra`).
 */
export function armarReporteCredito(
  credito: Credito,
  compras: CompraCuotas[],
  movimientos: Movimiento[],
  cuentas: Cuenta[],
  hoy: Date = new Date(),
): ReporteCredito {
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const movimientoDe = new Map(movimientos.map((m) => [m.id, m]));

  const filasCompras = compras
    .filter((c) => c.creditoId === credito.id)
    .map((c): FilaCompraCredito => {
      const faltan = cuotasFaltantesCompra(c, hoy);
      const valorCuota = valorCuotaCompra(c);
      return {
        // La fecha de la compra es la del movimiento; la de la compra es desde la que se cuentan las cuotas.
        fecha: movimientoDe.get(c.movimientoId)?.fecha ?? c.fecha,
        descripcion: c.descripcion,
        monto: c.monto,
        cuotaActual: faltan === 0 ? c.numCuotas : c.numCuotas - faltan + 1,
        numCuotas: c.numCuotas,
        valorCuota,
        saldoPendiente: faltan * valorCuota,
        terminada: faltan === 0,
      };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const pagos = movimientos
    .filter((m) => m.creditoDestinoId === credito.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn))
    .map(
      (m): FilaPagoCredito => ({
        fecha: m.fecha,
        cuenta: nombreDeCuenta(porId, m.cuentaOrigenId) ?? '',
        monto: m.monto,
      }),
    );

  const deuda = filasCompras.reduce((acc, f) => acc + f.saldoPendiente, 0);
  const cuotaDelMes = filasCompras
    .filter((f) => !f.terminada)
    .reduce((acc, f) => acc + f.valorCuota, 0);
  const cupo = 'cupo' in credito ? credito.cupo : null;

  return {
    nombre: credito.nombre,
    compras: filasCompras,
    pagos,
    deuda,
    cuotaDelMes,
    totalPagado: pagos.reduce((acc, p) => acc + p.monto, 0),
    cupoDisponible: cupo === null ? null : cupo - deuda,
  };
}
