const FORMATEADOR_PORCENTAJE = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea una fracción (0.2295) como porcentaje es-CO: "22,95%". */
export function formatearPorcentaje(valor: number): string {
  return FORMATEADOR_PORCENTAJE.format(valor);
}
