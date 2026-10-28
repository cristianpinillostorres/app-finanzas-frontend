export type FrecuenciaPagoFijo = 'MENSUAL' | 'BIMESTRAL' | 'ANUAL';

/**
 * Pago fijo propio (arriendo, servicios, suscripciones...). Las cuotas de
 * créditos NO se guardan aquí: salen automáticamente de `core/domain`
 * (`deudaCredito`, `cuotasFaltantes`) a partir de la tab Créditos.
 */
export interface PagoFijo {
  id: string;
  nombre: string;
  categoriaId: string;
  /** Día del mes límite de pago (1-31). Si no existe en el mes, se usa el último día. */
  diaLimite: number;
  /** Monto fijo, o valor estimado si `esVariable` es true (ej. luz, agua, gas). */
  monto: number;
  esVariable: boolean;
  frecuencia: FrecuenciaPagoFijo;
  /** Mes (1-12) en que aplica un pago anual, o desde el que empieza a contar uno bimestral. */
  mesInicio: number;
  /** Cuenta preseleccionada al pagar. */
  cuentaDefaultId: string;
  activo: boolean;
  /**
   * Periodos "YYYY-MM" que se marcaron como pagados sin registrar un
   * movimiento: "Ya lo pagué". Es para quien empieza a usar la app a mitad
   * de mes con pagos que ya hizo — su saldo inicial ya los descuenta, así
   * que registrarlos como gasto los contaría dos veces.
   */
  periodosPagadosSinMovimiento?: string[];
}
