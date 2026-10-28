import type { PagoFijo } from '../models';
import type { AnioMes } from './fechas';
import { ultimoDiaDelMes } from './fechas';

/**
 * Si un pago fijo aplica en el mes dado:
 * - Mensual: siempre.
 * - Bimestral: cada 2 meses desde `mesInicio` (se repite cada año, no acumula con el año calendario).
 * - Anual: solo en el mes `mesInicio`.
 */
export function aplicaEnMes(pagoFijo: PagoFijo, mes: AnioMes): boolean {
  if (!pagoFijo.activo) return false;

  switch (pagoFijo.frecuencia) {
    case 'MENSUAL':
      return true;
    case 'ANUAL':
      return mes.mes === pagoFijo.mesInicio;
    case 'BIMESTRAL': {
      const diferencia = (mes.mes - pagoFijo.mesInicio + 12) % 12;
      return diferencia % 2 === 0;
    }
  }
}

/**
 * Fecha límite de pago dentro de un mes concreto. Si el día límite no existe
 * en ese mes (ej. 31 en febrero), usa el último día del mes.
 */
export function fechaLimiteEnMes(pagoFijo: PagoFijo, mes: AnioMes): Date {
  const dia = Math.min(pagoFijo.diaLimite, ultimoDiaDelMes(mes.anio, mes.mes));
  return new Date(mes.anio, mes.mes - 1, dia);
}
