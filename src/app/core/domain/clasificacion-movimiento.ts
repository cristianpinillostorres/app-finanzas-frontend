import type { Cuenta } from '../models';

/**
 * Una transferencia es un movimiento interno cuando origen y destino son
 * piezas (saldo libre o bolsillo) de la misma cuenta raíz.
 */
export function esInterno(origen: Cuenta, destino: Cuenta): boolean {
  const raizOrigen = origen.cuentaPadreId ?? origen.id;
  const raizDestino = destino.cuentaPadreId ?? destino.id;
  return raizOrigen === raizDestino && origen.id !== destino.id;
}

/**
 * Texto automático de una transferencia cuando no se escribe descripción:
 * "Pago de <crédito>" si el destino es un crédito, "Retiro" si el destino
 * es efectivo, o "Transferencia" en cualquier otro caso.
 */
export function descripcionAutomaticaTransferencia(datos: {
  nombreCreditoDestino?: string;
  destinoEsEfectivo: boolean;
}): string {
  if (datos.nombreCreditoDestino) return `Pago de ${datos.nombreCreditoDestino}`;
  if (datos.destinoEsEfectivo) return 'Retiro';
  return 'Transferencia';
}
