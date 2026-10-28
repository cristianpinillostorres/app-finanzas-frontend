/** Compra a cuotas con una tarjeta de crédito o plataforma (Addi, Sistecrédito). */
export interface CompraCuotas {
  id: string;
  creditoId: string;
  /** Movimiento de tipo GASTO que originó la compra. */
  movimientoId: string;
  descripcion: string;
  monto: number;
  numCuotas: number;
  /** Solo en plataformas: valor de cada cuota tal como lo da la plataforma. */
  valorCuota?: number;
  fecha: string;
}
