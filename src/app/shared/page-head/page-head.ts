import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

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
 */
@Component({
  selector: 'app-page-head',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './page-head.html',
  styleUrl: './page-head.scss',
})
export class PageHead {
  titulo = input.required<string>();
  /** Línea secundaria bajo el título; vacía si no aplica. */
  detalle = input<string>('');
  /**
   * Ícono del sello a la izquierda del título: el de la sección en la
   * barra lateral (`NAV_ITEMS`). Sin ícono no se dibuja el sello.
   */
  icono = input<string>('');
}
