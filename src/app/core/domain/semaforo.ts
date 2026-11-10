import { diasEntre, fechaLocalDesdeIso } from './fechas';

export type EstadoSemaforo = 'verde' | 'amarillo' | 'rojo' | 'pagado';

/**
 * Con cuántos días de anticipación cambia el color de un pago: `amarillo` y
 * `rojo` son los días que faltan "o menos" a partir de los cuales se pone de
 * ese color. `rojo` es siempre menor que `amarillo`. Se eligen en
 * Configuración (ver `Preferencias.avisos`).
 */
export interface UmbralesAviso {
  amarillo: number;
  rojo: number;
}

/** Lo que vale mientras la persona no cambie nada: amarillo con 4 días o menos y rojo con 1 o menos. */
export const UMBRALES_INICIALES: UmbralesAviso = { amarillo: 4, rojo: 1 };

/** Lo que se puede elegir: el amarillo entre 1 y 14 días, y el rojo entre 0 y uno menos que el amarillo. */
export const LIMITES_AVISO = { amarilloMin: 1, amarilloMax: 14, rojoMin: 0 } as const;

/**
 * Estado de una fecha límite de pago, según los umbrales (por defecto 4 y 1):
 * - `pagado` (gris) si ya se pagó, sin importar la fecha.
 * - `rojo` si faltan `rojo` días o menos: con 1, vence mañana, hoy o ya venció.
 * - `amarillo` si faltan `amarillo` días o menos.
 * - `verde` en cualquier otro caso.
 */
export function semaforo(
  fechaLimite: string | Date,
  hoy: Date = new Date(),
  pagado = false,
  umbrales: UmbralesAviso = UMBRALES_INICIALES,
): EstadoSemaforo {
  if (pagado) return 'pagado';

  const limite = typeof fechaLimite === 'string' ? fechaLocalDesdeIso(fechaLimite) : fechaLimite;
  const dias = diasEntre(hoy, limite);

  if (dias <= umbrales.rojo) return 'rojo';
  if (dias <= umbrales.amarillo) return 'amarillo';
  return 'verde';
}
