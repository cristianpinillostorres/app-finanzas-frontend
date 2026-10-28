import type { Cuenta } from '../../../core/models';

/** Cuenta raíz sobre la que se va a ajustar el saldo, de ella o de un bolsillo suyo. */
export interface AjustarSaldoFormData {
  cuentaRaiz: Cuenta;
  bolsillos: Cuenta[];
}
