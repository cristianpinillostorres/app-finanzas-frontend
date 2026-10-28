import type { PagoFijo } from '../../../core/models';

/** Pago fijo a editar. Si no viene, el formulario crea uno nuevo. */
export interface PagoFijoFormData {
  pagoFijo?: PagoFijo;
}
