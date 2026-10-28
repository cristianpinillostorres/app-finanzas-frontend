import { Component, input, output } from '@angular/core';

/**
 * Barra de arriba de las hojas y diálogos de formulario, la de iOS:
 * "Cancelar" a la izquierda y el título centrado sobre el ancho de la hoja.
 * En los formularios la acción principal va abajo, al alcance del pulgar;
 * las hojas sin formulario (los filtros) la llevan a la derecha con
 * `textoAccion`, como el "Aplicar" de iOS.
 *
 * El título queda centrado mientras quepa; si es largo se corre hacia la
 * derecha para no pisar "Cancelar" y, si aun así no cabe, se corta con "…".
 * Al hacer scroll la barra se queda arriba y aparece la raya de abajo.
 */
@Component({
  selector: 'app-hoja-cabecera',
  standalone: true,
  templateUrl: './hoja-cabecera.html',
  styleUrl: './hoja-cabecera.scss',
})
export class HojaCabecera {
  titulo = input.required<string>();
  textoCerrar = input('Cancelar');
  /** Mientras se guarda, cerrar dejaría el guardado a medias. */
  cerrarDeshabilitado = input(false);
  cerrar = output<void>();
  textoAccion = input<string | null>(null);
  accion = output<void>();
}
