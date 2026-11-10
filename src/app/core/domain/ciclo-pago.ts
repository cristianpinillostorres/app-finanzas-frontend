import { diasEntre, inicioDelDia, ultimoDiaDelMes } from './fechas';
import type { ItemPagoFijoMes } from './pagos-fijos-agrupados';

/** El día de pago dentro de un mes: un 31 en un mes más corto cae en su último día. */
function fechaDePagoEnMes(anio: number, mesIndice: number, diaDePago: number): Date {
  const mes = new Date(anio, mesIndice, 1); // normaliza mesIndice 12 → enero del año siguiente
  const dia = Math.min(diaDePago, ultimoDiaDelMes(mes.getFullYear(), mes.getMonth() + 1));
  return new Date(mes.getFullYear(), mes.getMonth(), dia);
}

/**
 * El próximo día de pago a partir de `hoy`. Si hoy es el día de pago, el
 * dinero ya cuenta como recibido: el ciclo empieza hoy y el próximo pago es
 * el del mes siguiente.
 */
export function proximoPago(hoy: Date, diaDePago: number): Date {
  const dia = inicioDelDia(hoy);
  const esteMes = fechaDePagoEnMes(dia.getFullYear(), dia.getMonth(), diaDePago);
  return esteMes > dia ? esteMes : fechaDePagoEnMes(dia.getFullYear(), dia.getMonth() + 1, diaDePago);
}

/**
 * Cuándo empezó el ciclo de pago en curso: el último día de pago que ya
 * llegó (hoy, si hoy es el día). Sin día de pago el ciclo es el mes
 * calendario.
 */
export function inicioDelCiclo(hoy: Date, diaDePago: number | null): Date {
  const dia = inicioDelDia(hoy);
  if (diaDePago === null) return new Date(dia.getFullYear(), dia.getMonth(), 1);
  const esteMes = fechaDePagoEnMes(dia.getFullYear(), dia.getMonth(), diaDePago);
  return esteMes <= dia ? esteMes : fechaDePagoEnMes(dia.getFullYear(), dia.getMonth() - 1, diaDePago);
}

/** Lo que queda libre hasta el próximo pago y lo que vence después. Ver `libreHastaProximoPago`. */
export interface LibreHastaPago {
  proximoPago: Date;
  /** Días que faltan para ese pago. */
  diasHastaPago: number;
  /** Lo que vence antes del próximo pago, vencidos incluidos. */
  antes: ItemPagoFijoMes[];
  /** Lo que vence el día del pago o después, dentro del mes en curso. */
  despues: ItemPagoFijoMes[];
  totalAntes: number;
  totalDespues: number;
  /** Disponible menos lo que vence antes del próximo pago. */
  libre: number;
}

/**
 * "Te queda libre hasta tu pago": el disponible menos lo que vence antes de
 * que llegue el próximo pago, no antes de fin de mes. Lo que vence el día del
 * pago o después se paga con ese dinero, así que no se resta; se informa
 * aparte para que se sepa cuánto reservar.
 *
 * Recibe lo que falta por pagar del mes en curso y del siguiente: cuando el
 * próximo pago cae en el mes que viene, lo que vence en los primeros días de
 * ese mes también va antes del pago.
 */
export function libreHastaProximoPago(
  disponible: number,
  porPagarMesActual: ItemPagoFijoMes[],
  porPagarMesSiguiente: ItemPagoFijoMes[],
  hoy: Date,
  diaDePago: number,
): LibreHastaPago {
  const pago = proximoPago(hoy, diaDePago);
  const venceAntes = (item: ItemPagoFijoMes) => inicioDelDia(item.fechaLimite) < pago;

  const antes = [...porPagarMesActual, ...porPagarMesSiguiente]
    .filter(venceAntes)
    .sort((a, b) => a.fechaLimite.getTime() - b.fechaLimite.getTime());
  const despues = porPagarMesActual
    .filter((item) => !venceAntes(item))
    .sort((a, b) => a.fechaLimite.getTime() - b.fechaLimite.getTime());

  const totalAntes = antes.reduce((acc, item) => acc + item.monto, 0);
  const totalDespues = despues.reduce((acc, item) => acc + item.monto, 0);

  return {
    proximoPago: pago,
    diasHastaPago: diasEntre(hoy, pago),
    antes,
    despues,
    totalAntes,
    totalDespues,
    libre: disponible - totalAntes,
  };
}
