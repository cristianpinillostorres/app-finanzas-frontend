import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Selector de mes con flechas (clase `.month` del prototipo): usado en
 * Pagos fijos (fase 6) y, más adelante, en Movimientos (fase 7). La
 * navegación entre meses vive en la página que lo usa (sabe construir el
 * `AnioMes` siguiente/anterior); este componente solo muestra la etiqueta y
 * emite los clics.
 */
@Component({
  selector: 'app-month-selector',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './month-selector.html',
  styleUrl: './month-selector.scss',
})
export class MonthSelector {
  etiqueta = input.required<string>();
  anterior = output<void>();
  siguiente = output<void>();
}
