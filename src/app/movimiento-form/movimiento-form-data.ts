import type { Movimiento } from '../core/models';

export type TipoFormularioMovimiento = 'gasto' | 'ingreso' | 'transferencia';

/**
 * Datos iniciales opcionales que recibe el formulario: se usan para
 * preseleccionar el tipo/origen desde el botón "+", el atajo "Agregar
 * compra" de un crédito, el botón "Pagar" de un pago fijo, o para editar un
 * movimiento existente (Movimientos, fase 7).
 */
export interface MovimientoFormData {
  tipo?: TipoFormularioMovimiento;
  /** Preselecciona "Pagar con" (gasto) o "Desde" (transferencia). */
  cuentaOrigenId?: string;
  /** Preselecciona "Cuenta o bolsillo destino" (ingreso) o "Hacia" (transferencia). */
  cuentaDestinoId?: string;
  /** Atajo "Agregar compra": preselecciona la tarjeta o plataforma en "Pagar con". */
  creditoId?: string;
  /** Monto precargado (ej. botón "Pagar" de un pago fijo). Vacío si es variable. */
  monto?: number;
  /** Descripción precargada (ej. el nombre del pago fijo). */
  descripcion?: string;
  /** Categoría precargada (ej. la del pago fijo). */
  categoriaId?: string;
  /** Pago fijo que este movimiento marca como pagado (botón "Pagar" de Pagos fijos). */
  pagoFijoId?: string;
  /**
   * Nombre del pago fijo, solo para el aviso de confirmación al guardar
   * ("Arriendo quedó pagado").
   *
   * Va aparte de `descripcion` porque esa sí es un campo editable: si el
   * usuario la cambia antes de guardar, el aviso seguiría nombrando el pago
   * que efectivamente marcó. Y en el caso de un crédito no hay descripción
   * precargada de la que sacarlo.
   */
  nombrePagoFijo?: string;
  /** Periodo "YYYY-MM" que cubre el pago: el mes que se estaba viendo en Pagos fijos al pulsar "Pagar". */
  periodo?: string;
  /** Movimiento a editar. Si viene, el formulario actualiza en vez de crear. */
  movimiento?: Movimiento;
}
