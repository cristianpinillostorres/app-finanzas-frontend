export interface ConfirmDialogData {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Acción destructiva (eliminar): el botón de confirmar va en rojo, no en azul. */
  peligro?: boolean;
}
