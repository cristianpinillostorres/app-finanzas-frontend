/**
 * "Te queda libre este mes": disponible menos lo que falta por pagar en el
 * mes (pagos fijos y cuotas pendientes). Es el dato principal de la tab
 * General.
 */
export function libreDelMes(disponible: number, faltaPorPagarMes: number): number {
  return disponible - faltaPorPagarMes;
}
