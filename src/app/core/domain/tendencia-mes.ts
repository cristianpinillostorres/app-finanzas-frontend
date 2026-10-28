import type { Movimiento } from '../models';
import type { AnioMes } from './fechas';
import { fechaLocalDesdeIso, perteneceAlMes, ultimoDiaDelMes } from './fechas';

/** Un día del mes con los acumulados de ingresos y gastos hasta ese día. */
export interface PuntoTendencia {
  /** Día del mes, 1-31. */
  dia: number;
  /** Ingresos acumulados desde el día 1 hasta este día, inclusive. */
  ingresos: number;
  /** Gastos acumulados desde el día 1 hasta este día, inclusive. */
  gastos: number;
}

/**
 * Serie diaria acumulada de ingresos vs gastos de un mes, para la mini
 * tendencia de General.
 *
 * Acumulada y no día a día a propósito: la pregunta que responde el panel es
 * "a esta altura del mes, ¿cuánto llevo ganado contra cuánto llevo gastado?",
 * y con barras diarias esa comparación hay que hacerla mentalmente. Como
 * acumulado, la distancia vertical entre las dos líneas *es* el balance.
 *
 * Solo cuentan INGRESO y GASTO, la misma regla de `resumenMovimientos`: una
 * transferencia no cambia el patrimonio, un movimiento interno mueve plata
 * entre bolsillos de la misma cuenta y un ajuste es una corrección. Si esto
 * contara distinto que los KPIs de arriba, el panel se contradiría solo.
 *
 * La serie se corta en `hoy` cuando `mes` es el mes en curso: dibujarla
 * hasta el día 30 estando en el 12 pinta 18 días planos, que se leen como
 * "dejé de gastar" en vez de "todavía no pasó". Para un mes ya terminado va
 * completa, y para un mes futuro devuelve una serie vacía.
 *
 * `hoy` es un parámetro y no `new Date()` adentro para que la función siga
 * siendo pura y testeable.
 */
export function tendenciaDelMes(
  movimientos: Movimiento[],
  mes: AnioMes,
  hoy: Date = new Date(),
): PuntoTendencia[] {
  const ultimoDia = diasAMostrar(mes, hoy);
  if (ultimoDia === 0) return [];

  // Totales por día (índice 1..ultimoDia), antes de acumular.
  const ingresosPorDia = new Array<number>(ultimoDia + 1).fill(0);
  const gastosPorDia = new Array<number>(ultimoDia + 1).fill(0);

  for (const movimiento of movimientos) {
    if (movimiento.tipo !== 'INGRESO' && movimiento.tipo !== 'GASTO') continue;
    if (!perteneceAlMes(movimiento.fecha, mes)) continue;

    const dia = fechaLocalDesdeIso(movimiento.fecha).getDate();
    // Un movimiento con fecha futura dentro del mes en curso (se puede
    // registrar) no entra: la serie llega hasta hoy.
    if (dia > ultimoDia) continue;

    if (movimiento.tipo === 'INGRESO') ingresosPorDia[dia] += movimiento.monto;
    else gastosPorDia[dia] += movimiento.monto;
  }

  const puntos: PuntoTendencia[] = [];
  let ingresos = 0;
  let gastos = 0;
  for (let dia = 1; dia <= ultimoDia; dia++) {
    ingresos += ingresosPorDia[dia];
    gastos += gastosPorDia[dia];
    puntos.push({ dia, ingresos, gastos });
  }
  return puntos;
}

/** Hasta qué día dibujar: hoy si es el mes en curso, el mes entero si ya pasó, 0 si es futuro. */
function diasAMostrar(mes: AnioMes, hoy: Date): number {
  const anioHoy = hoy.getFullYear();
  const mesHoy = hoy.getMonth() + 1;

  if (mes.anio > anioHoy || (mes.anio === anioHoy && mes.mes > mesHoy)) return 0;
  if (mes.anio === anioHoy && mes.mes === mesHoy) return hoy.getDate();
  return ultimoDiaDelMes(mes.anio, mes.mes);
}
