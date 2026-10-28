/**
 * INGRESO y GASTO cuentan en los indicadores del mes.
 * TRANSFERENCIA es entre cuentas o hacia un crédito (pago/abono); no cuenta como gasto.
 * INTERNO es entre una cuenta y su propio bolsillo; no cuenta como ingreso ni gasto.
 * AJUSTE corrige un saldo por pieza; no cuenta como ingreso ni gasto.
 */
export type TipoMovimiento = 'INGRESO' | 'GASTO' | 'TRANSFERENCIA' | 'INTERNO' | 'AJUSTE';

export interface Movimiento {
  id: string;
  /** Fecha en formato "YYYY-MM-DD". */
  fecha: string;
  tipo: TipoMovimiento;
  monto: number;
  descripcion: string;
  categoriaId?: string;
  /** Cuenta o bolsillo de origen (gasto, transferencia, interno, ajuste a la baja). */
  cuentaOrigenId?: string;
  /** Cuenta o bolsillo de destino (ingreso, transferencia, interno, ajuste al alza). */
  cuentaDestinoId?: string;
  /** Compra con tarjeta o plataforma que originó el gasto. */
  creditoOrigenId?: string;
  /** Crédito al que se le paga o abona (baja su deuda). */
  creditoDestinoId?: string;
  /** Pago fijo o cuota de crédito que este movimiento marca como pagado. */
  pagoFijoId?: string;
  /** Periodo "YYYY-MM" del pago fijo/cuota que este movimiento cubre. */
  periodo?: string;
  creadoEn: string;
}
