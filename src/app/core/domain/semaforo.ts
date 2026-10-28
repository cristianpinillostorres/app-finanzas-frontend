import { diasEntre, fechaLocalDesdeIso } from './fechas';

export type EstadoSemaforo = 'verde' | 'amarillo' | 'rojo' | 'pagado';

/**
 * Estado de una fecha límite de pago:
 * - `pagado` (gris) si ya se pagó, sin importar la fecha.
 * - `verde` si faltan 5 días o más.
 * - `amarillo` si faltan entre 2 y 4 días.
 * - `rojo` si vence mañana, hoy o ya se venció.
 */
export function semaforo(
  fechaLimite: string | Date,
  hoy: Date = new Date(),
  pagado = false,
): EstadoSemaforo {
  if (pagado) return 'pagado';

  const limite = typeof fechaLimite === 'string' ? fechaLocalDesdeIso(fechaLimite) : fechaLimite;
  const dias = diasEntre(hoy, limite);

  if (dias >= 5) return 'verde';
  if (dias >= 2) return 'amarillo';
  return 'rojo';
}
