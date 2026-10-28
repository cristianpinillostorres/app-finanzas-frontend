/**
 * Utilidades de fechas puras que usa el resto de `core/domain`. Trabajan a
 * nivel de día calendario (sin horas) para no depender de la zona horaria
 * del navegador.
 */

/**
 * Convierte una fecha en formato "YYYY-MM-DD" a `Date` local, sin pasar por
 * el parseo UTC de `new Date(string)` (que puede correr la fecha un día en
 * zonas horarias negativas).
 */
export function fechaLocalDesdeIso(fechaIso: string): Date {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

/** Inversa de `fechaLocalDesdeIso`: una `Date` local a "YYYY-MM-DD". */
export function fechaIsoDesdeLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Último día del mes (1-12) del año dado, ej. `ultimoDiaDelMes(2026, 2)` → 28. */
export function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

/** Normaliza a medianoche para comparar solo la parte de fecha. */
export function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** Diferencia en días completos entre `desde` y `hasta` (puede ser negativa). */
export function diasEntre(desde: Date, hasta: Date): number {
  const msPorDia = 24 * 60 * 60 * 1000;
  const a = inicioDelDia(desde).getTime();
  const b = inicioDelDia(hasta).getTime();
  return Math.round((b - a) / msPorDia);
}

/** Diferencia en meses completos entre `desde` y `hasta` (puede ser negativa). */
export function mesesEntre(desde: Date, hasta: Date): number {
  return (hasta.getFullYear() - desde.getFullYear()) * 12 + (hasta.getMonth() - desde.getMonth());
}

/** Año y mes (1-12) que se está viendo, ej. en el selector de mes de Pagos fijos y Movimientos. */
export interface AnioMes {
  anio: number;
  mes: number;
}

/** El `AnioMes` al que pertenece una fecha. */
export function anioMesDe(fecha: Date): AnioMes {
  return { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1 };
}

/** Suma (o resta, con `delta` negativo) meses a un `AnioMes`, ajustando el año. */
export function sumarMesesAnioMes(mes: AnioMes, delta: number): AnioMes {
  return anioMesDe(new Date(mes.anio, mes.mes - 1 + delta, 1));
}

/** Primer día de un `AnioMes`, como `Date`. */
export function primerDiaDelMes(mes: AnioMes): Date {
  return new Date(mes.anio, mes.mes - 1, 1);
}

/** Periodo "YYYY-MM" de un `AnioMes`, tal como se guarda en `Movimiento.periodo`. */
export function periodoIso(mes: AnioMes): string {
  return `${mes.anio}-${String(mes.mes).padStart(2, '0')}`;
}

/** Si una fecha "YYYY-MM-DD" cae dentro de un `AnioMes` dado. */
export function perteneceAlMes(fechaIso: string, mes: AnioMes): boolean {
  const fecha = fechaLocalDesdeIso(fechaIso);
  return fecha.getFullYear() === mes.anio && fecha.getMonth() === mes.mes - 1;
}
