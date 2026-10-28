import type { Cuenta } from '../../../core/models';

/** Cuenta a editar. Si no viene, el formulario crea una cuenta nueva. */
export interface CuentaFormData {
  cuenta?: Cuenta;
}
