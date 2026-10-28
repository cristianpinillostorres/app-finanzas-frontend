import type { Cuenta } from '../../../core/models';

/** Cuenta madre en la que se va a crear el bolsillo. */
export interface BolsilloFormData {
  cuentaPadre: Cuenta;
}
