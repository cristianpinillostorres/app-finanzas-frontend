import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, input } from '@angular/core';

import { AccionesEscritorioService } from '../../layout/acciones-escritorio.service';

/**
 * Cabecera de pantalla: título, un detalle corto debajo (normalmente un
 * conteo: "4 cuentas activas · 2 bolsillos") y las acciones de la pantalla
 * a la derecha, proyectadas como contenido.
 *
 * Una sola fila para las tres cosas. Antes el título solo existía en el
 * header móvil y las acciones vivían en una fila `.hd` aparte, marcada
 * `solo-escritorio` porque en móvil se duplicaban con el botón del header:
 * dos sitios distintos para la misma acción según el tamaño de pantalla.
 * Acá la acción está siempre en el mismo lugar.
 *
 * En escritorio, a la derecha van además los botones
 * globales del `Shell` (ocultar montos y la cuenta), dentro de la misma
 * tarjeta: título y botones comparten una sola fila, y el contenido empieza
 * más arriba.
 */
@Component({
  selector: 'app-page-head',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './page-head.html',
  styleUrl: './page-head.scss',
})
export class PageHead {
  titulo = input.required<string>();
  /** Línea secundaria bajo el título; vacía si no aplica. */
  detalle = input<string>('');

  protected readonly accionesGlobales = inject(AccionesEscritorioService).plantilla;
}
