const FORMATEADOR_COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Formatea un monto en pesos colombianos sin decimales: `$1.250.000`. */
export function formatearCop(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '';
  // Intl mete un espacio (a veces de non-breaking) entre "$" y el número; se quita para "$1.250.000".
  return FORMATEADOR_COP.format(valor).replace(/\s/g, '');
}
