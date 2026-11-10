import type { MetaAhorro } from '../../../core/models';

/** Sin `meta` el formulario crea una; con ella, edita la que viene. */
export interface MetaFormData {
  meta?: MetaAhorro;
}
