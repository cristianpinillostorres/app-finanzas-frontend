import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Bloque de estado vacío: ícono, título, descripción opcional y una acción
 * proyectada como contenido (ej. botón "Agregar cuenta").
 *
 * El ícono no es decoración: un estado vacío que solo dice "Sin
 * movimientos" se lee como un error del que no se sabe qué hacer, mientras
 * que ícono + texto + acción se lee como una invitación. Por eso `icono`
 * tiene un valor por defecto en vez de ser opcional — siempre hay uno.
 *
 * `compacto` para los paneles chicos de General, donde el alto normal
 * dejaría un hueco desproporcionado al lado de los paneles vecinos.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  titulo = input.required<string>();
  descripcion = input<string>('');
  /** Nombre del ícono de Material Symbols Outlined. */
  icono = input<string>('inbox');
  compacto = input<boolean>(false);
}
