import { Component, computed, input } from '@angular/core';

/**
 * Esqueleto de una lista mientras cargan los datos: N filas con la misma
 * silueta que una `.row` real (ícono redondo + dos líneas + monto a la
 * derecha), para que el contenido no "salte" al llegar.
 *
 * Se prefiere sobre un spinner porque comunica la forma de lo que viene, y
 * sobre dejar el hueco vacío porque la primera carga tarda lo
 * suficiente como para que la pantalla se vea rota.
 *
 * Respeta `prefers-reduced-motion` vía el patrón `.skeleton` global: el
 * brillo se apaga y queda el bloque quieto.
 */
@Component({
  selector: 'app-skeleton-rows',
  standalone: true,
  templateUrl: './skeleton-rows.html',
  styleUrl: './skeleton-rows.scss',
})
export class SkeletonRows {
  filas = input<number>(3);
  /** Oculta el círculo de la izquierda, para listas sin ícono de fila. */
  conIcono = input<boolean>(true);

  protected readonly indices = computed(() => Array.from({ length: this.filas() }, (_, i) => i));
}
