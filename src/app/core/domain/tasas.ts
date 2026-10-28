/** Una fila de la tabla de amortización de un crédito con banco (sistema francés). */
export interface FilaAmortizacion {
  numero: number;
  saldoInicial: number;
  interes: number;
  capital: number;
  seguro: number;
  /** Cuota total del periodo: capital + interés + seguro. */
  cuota: number;
  saldoFinal: number;
}

/**
 * Convierte una tasa efectiva anual a mensual: `(1 + EA)^(1/12) - 1`.
 * Nunca se usa EA / 12 para créditos con bancos.
 */
export function tasaMensual(ea: number): number {
  return Math.pow(1 + ea, 1 / 12) - 1;
}

/**
 * Cuota fija del sistema francés (capital + interés, sin seguros), redondeada
 * al peso.
 */
export function cuotaFrancesa(monto: number, tasaMensual: number, plazoMeses: number): number {
  if (plazoMeses <= 0) return 0;
  if (tasaMensual === 0) return Math.round(monto / plazoMeses);
  const factor = Math.pow(1 + tasaMensual, plazoMeses);
  const cuota = (monto * tasaMensual * factor) / (factor - 1);
  return Math.round(cuota);
}

/**
 * Tabla de amortización completa: separa interés y capital en cada cuota y
 * suma el seguro mensual (que no baja la deuda). La última cuota ajusta el
 * capital para que el saldo final quede exactamente en 0.
 */
export function tablaAmortizacion(
  monto: number,
  tasaMensualValor: number,
  plazoMeses: number,
  seguroMensual = 0,
): FilaAmortizacion[] {
  const cuotaBase = cuotaFrancesa(monto, tasaMensualValor, plazoMeses);
  const seguro = Math.round(seguroMensual);
  const filas: FilaAmortizacion[] = [];
  let saldo = Math.round(monto);

  for (let numero = 1; numero <= plazoMeses; numero++) {
    const saldoInicial = saldo;
    const interes = Math.round(saldoInicial * tasaMensualValor);
    const esUltima = numero === plazoMeses;
    let capital = cuotaBase - interes;
    if (esUltima || capital > saldoInicial) {
      capital = saldoInicial;
    }
    const saldoFinal = saldoInicial - capital;
    filas.push({
      numero,
      saldoInicial,
      interes,
      capital,
      seguro,
      cuota: capital + interes + seguro,
      saldoFinal,
    });
    saldo = saldoFinal;
  }

  return filas;
}
