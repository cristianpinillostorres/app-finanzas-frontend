import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Lo que muestra una pantalla cuando todavía no hay nada en ella: en vez
 * de tarjetas en $0 y gráficas vacías — que se leen como "esto no
 * funciona" —, una sola tarjeta que dice para qué sirve la pantalla, qué
 * se podrá ver en ella y cómo empezar (la acción va proyectada).
 *
 * Distinto de `app-empty-state`, que es el vacío de un panel o una lista
 * ("Sin movimientos en octubre") dentro de una pantalla que sí tiene datos.
 */
@Component({
  selector: 'app-pantalla-vacia',
  imports: [MatIconModule],
  templateUrl: './pantalla-vacia.html',
  styleUrl: './pantalla-vacia.scss',
})
export class PantallaVacia {
  icono = input.required<string>();
  titulo = input.required<string>();
  descripcion = input.required<string>();
  /** Lo que la pantalla mostrará cuando tenga datos, en frases cortas. */
  puntos = input<string[]>([]);
}
