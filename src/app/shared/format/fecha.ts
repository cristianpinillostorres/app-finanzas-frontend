import { diasEntre, fechaLocalDesdeIso } from '../../core/domain/fechas';

const FORMATEADOR_MES_ANIO = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
const FORMATEADOR_MES = new Intl.DateTimeFormat('es-CO', { month: 'long' });
const FORMATEADOR_DIA_MES = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' });
const FORMATEADOR_DIA_SEMANA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
});
const FORMATEADOR_FECHA_COMPLETA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Formatea una fecha como "agosto de 2027", igual al prototipo. */
export function formatearMesAnio(fecha: Date): string {
  // Intl.DateTimeFormat con es-CO da "agosto de 2027" directamente.
  return FORMATEADOR_MES_ANIO.format(fecha);
}

/** Como `formatearMesAnio`, con mayúscula inicial: "Septiembre de 2026", para el selector de mes. */
export function formatearMesAnioCapitalizado(fecha: Date): string {
  const texto = formatearMesAnio(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Solo el nombre del mes, en minúscula: "septiembre" (desglose de "Te queda libre" en General). */
export function formatearNombreMes(fecha: Date): string {
  return FORMATEADOR_MES.format(fecha);
}

/** Formatea una fecha como "20 de agosto", sin año (igual a Movimientos en el prototipo). */
export function formatearDiaMes(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return FORMATEADOR_DIA_MES.format(new Date(anio, mes - 1, dia));
}

/** "Martes 22": día de la semana y número, para el subtítulo de General. */
export function formatearDiaSemana(fecha: Date): string {
  const texto = FORMATEADOR_DIA_SEMANA.format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Formatea una fecha completa, con año: "11 de septiembre de 2026" (detalle de un movimiento). */
export function formatearFechaCompleta(fechaIso: string): string {
  return FORMATEADOR_FECHA_COMPLETA.format(fechaLocalDesdeIso(fechaIso));
}

/** Encabezado de grupo de día en Movimientos: "Hoy, 11 de septiembre",
 * "Ayer, 10 de septiembre" o, para el resto, solo la fecha ("9 de septiembre"). */
export function etiquetaDia(fechaIso: string, hoy: Date = new Date()): string {
  const dias = diasEntre(fechaLocalDesdeIso(fechaIso), hoy);
  const texto = formatearDiaMes(fechaIso);
  if (dias === 0) return `Hoy, ${texto}`;
  if (dias === 1) return `Ayer, ${texto}`;
  return texto;
}
