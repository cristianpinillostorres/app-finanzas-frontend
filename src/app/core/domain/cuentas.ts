import type { Cuenta, Movimiento } from '../models';

/** Un bolsillo es una cuenta con `cuentaPadreId` distinto de `null`. */
export function esBolsillo(cuenta: Cuenta): boolean {
  return cuenta.cuentaPadreId !== null;
}

/**
 * Saldo de una pieza (cuenta raíz o bolsillo): saldo inicial + movimientos
 * que la tienen como destino (suma) u origen (resta). Nunca se edita a mano.
 */
export function saldoCuenta(cuenta: Cuenta, movimientos: Movimiento[]): number {
  let saldo = cuenta.saldoInicial;
  for (const movimiento of movimientos) {
    if (movimiento.cuentaDestinoId === cuenta.id) saldo += movimiento.monto;
    if (movimiento.cuentaOrigenId === cuenta.id) saldo -= movimiento.monto;
  }
  return saldo;
}

/** Total de una cuenta con bolsillos: saldo libre + suma de sus bolsillos. */
export function saldoTotalCuenta(
  cuentaRaiz: Cuenta,
  todasLasCuentas: Cuenta[],
  movimientos: Movimiento[],
): number {
  const saldoLibre = saldoCuenta(cuentaRaiz, movimientos);
  const sumaBolsillos = todasLasCuentas
    .filter((c) => c.cuentaPadreId === cuentaRaiz.id)
    .reduce((acc, bolsillo) => acc + saldoCuenta(bolsillo, movimientos), 0);
  return saldoLibre + sumaBolsillos;
}

/**
 * Disponible total: saldo libre de cuentas raíz que suman en el disponible,
 * más el saldo de los bolsillos que no están marcados como reservados.
 */
export function disponible(cuentas: Cuenta[], movimientos: Movimiento[]): number {
  return cuentas
    .filter((c) => !c.archivada)
    .filter((c) => (esBolsillo(c) ? !c.reservado : c.sumaEnDisponible))
    .reduce((acc, c) => acc + saldoCuenta(c, movimientos), 0);
}

/** Total reservado: suma de los bolsillos marcados como reservados. */
export function reservado(cuentas: Cuenta[], movimientos: Movimiento[]): number {
  return cuentas
    .filter((c) => !c.archivada && esBolsillo(c) && c.reservado)
    .reduce((acc, c) => acc + saldoCuenta(c, movimientos), 0);
}
