import { diasEntre } from '../../core/domain';

/**
 * Texto del badge de una fecha límite de pago: "Pagado" si ya se pagó, o
 * "Venció hace N días" / "Vence hoy" / "Vence mañana" / "Vence en N días"
 * según los días que faltan (Créditos, Pagos fijos, General). Un vencido
 * dice hace cuánto: "Ya venció" igualaba un olvido de ayer con uno de hace
 * tres semanas.
 */
export function textoVencimiento(
  fechaLimite: Date,
  pagado: boolean,
  hoy: Date = new Date(),
): string {
  if (pagado) return 'Pagado';
  const dias = diasEntre(hoy, fechaLimite);
  if (dias === -1) return 'Venció ayer';
  if (dias < 0) return `Venció hace ${-dias} días`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
}
