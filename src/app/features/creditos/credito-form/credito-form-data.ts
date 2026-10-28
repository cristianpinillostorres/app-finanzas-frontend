import type { Credito, GrupoCredito } from '../../../core/models';

/** Crédito a editar. Si no viene, el formulario crea un crédito nuevo. */
export interface CreditoFormData {
  credito?: Credito;
  /** Grupo con el que arranca un crédito nuevo (la bienvenida lo elige antes). */
  grupo?: GrupoCredito;
}
