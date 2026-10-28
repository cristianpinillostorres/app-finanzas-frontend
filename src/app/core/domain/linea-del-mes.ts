import type { AnioMes } from './fechas';
import { diasEntre, inicioDelDia, ultimoDiaDelMes } from './fechas';
import type { ItemPagoFijoMes, ResumenPagosFijosMes } from './pagos-fijos-agrupados';

/**
 * Dónde cae un pago respecto a hoy. Es la pregunta "¿qué tengo que pagar y
 * cuándo?" reducida a cuatro respuestas: lo que se pasó, lo que viene en
 * la semana, lo que viene después y lo que ya está pagado.
 */
export type TramoPago = 'vencido' | 'semana' | 'despues' | 'pagado';

/** Los pagos que vencen el mismo día. */
export interface DiaLineaDelMes {
  fecha: Date;
  /** Pendientes primero, después los pagados; dentro de cada uno, por nombre. */
  items: ItemPagoFijoMes[];
  /** El tramo más urgente del día: si hay un vencido, el día entero se lee así. */
  tramo: TramoPago;
}

export interface LineaDelMes {
  mes: AnioMes;
  diasDelMes: number;
  /** Solo los días que tienen algún pago, por fecha. */
  dias: DiaLineaDelMes[];
  /**
   * Hoy, si el mes es el actual (`null` en meses pasados o futuros: ahí no
   * hay un "hoy" que marcar).
   */
  hoy: Date | null;
  /**
   * Posición de la marca de hoy en `dias`: va justo antes del primer día que
   * no ha pasado, así lo que vence hoy queda debajo de la marca. Igual a
   * `dias.length` si todo el mes ya pasó; `null` sin `hoy`.
   */
  indiceHoy: number | null;
  /** Cuántos pagos caen en cada tramo, para el resumen en texto. */
  conteo: Record<TramoPago, number>;
}

const URGENCIA: Record<TramoPago, number> = { vencido: 0, semana: 1, despues: 2, pagado: 3 };

/** Un pago a 7 días o menos cuenta como "esta semana" (hoy incluido). */
const DIAS_SEMANA = 7;

export function tramoDePago(item: ItemPagoFijoMes, hoy: Date): TramoPago {
  if (item.pagado) return 'pagado';
  const dias = diasEntre(hoy, item.fechaLimite);
  if (dias < 0) return 'vencido';
  if (dias < DIAS_SEMANA) return 'semana';
  return 'despues';
}

/**
 * El mes de Pagos fijos como una línea de tiempo: los pagos agrupados por
 * día de vencimiento, con la posición de hoy. En un mes que no es el
 * actual no hay marca de hoy, pero el tramo sale igual de la distancia a
 * hoy: lo pendiente de un mes pasado está vencido.
 */
export function lineaDelMes(resumen: ResumenPagosFijosMes, ahora: Date = new Date()): LineaDelMes {
  const { mes } = resumen;
  const hoyDia = inicioDelDia(ahora);
  const esMesActual = hoyDia.getFullYear() === mes.anio && hoyDia.getMonth() === mes.mes - 1;

  const porDia = new Map<number, ItemPagoFijoMes[]>();
  for (const item of [...resumen.porPagar, ...resumen.pagados]) {
    const clave = inicioDelDia(item.fechaLimite).getTime();
    porDia.set(clave, [...(porDia.get(clave) ?? []), item]);
  }

  const conteo: Record<TramoPago, number> = { vencido: 0, semana: 0, despues: 0, pagado: 0 };
  const dias: DiaLineaDelMes[] = [...porDia.entries()]
    .sort(([a], [b]) => a - b)
    .map(([clave, items]) => {
      const tramos = items.map((i) => tramoDePago(i, hoyDia));
      tramos.forEach((t) => conteo[t]++);
      return {
        fecha: new Date(clave),
        items: [...items].sort(
          (a, b) => Number(a.pagado) - Number(b.pagado) || a.nombre.localeCompare(b.nombre, 'es'),
        ),
        tramo: tramos.reduce((peor, t) => (URGENCIA[t] < URGENCIA[peor] ? t : peor), 'pagado'),
      };
    });

  let indiceHoy: number | null = null;
  if (esMesActual) {
    const primeroNoPasado = dias.findIndex((d) => d.fecha.getTime() >= hoyDia.getTime());
    indiceHoy = primeroNoPasado === -1 ? dias.length : primeroNoPasado;
  }

  return {
    mes,
    diasDelMes: ultimoDiaDelMes(mes.anio, mes.mes),
    dias,
    hoy: esMesActual ? hoyDia : null,
    indiceHoy,
    conteo,
  };
}
