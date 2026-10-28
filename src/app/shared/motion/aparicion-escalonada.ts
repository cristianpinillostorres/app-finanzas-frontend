import { Directive, ElementRef, inject, input } from '@angular/core';
import { animate, stagger } from 'motion';

import { prefiereMenosMovimiento } from './preferencias-movimiento';

/**
 * Entrada escalonada de los hijos directos del elemento: cada uno aparece
 * con un desfase pequeño respecto del anterior.
 *
 * Solo anima `opacity` y `transform` (ambas van al compositor, sin
 * recalcular layout), y una sola vez: es un efecto de llegada a la
 * pantalla, no algo que deba repetirse cada vez que cambia un dato.
 *
 * Bajo `prefers-reduced-motion` no hace nada — ni siquiera pone el estado
 * inicial, así que el contenido se ve de una vez y en su sitio.
 */
@Directive({
  selector: '[appAparicionEscalonada]',
  standalone: true,
})
export class AparicionEscalonada {
  /** Desfase entre hijos, en segundos. */
  desfase = input(0.04);

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    // No se anima si no aporta o si no puede correr. Lo segundo importa más
    // de lo que parece: el estado inicial de esta animación es
    // `opacity: 0`, y el navegador no da cuadros a una pestaña en segundo
    // plano — arrancarla ahí dejaría la pantalla en blanco hasta que
    // alguien vuelva a la pestaña.
    if (prefiereMenosMovimiento() || document.visibilityState !== 'visible') return;

    const hijos = Array.from(host.children) as HTMLElement[];
    if (hijos.length === 0) return;

    animate(
      hijos,
      { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)'] },
      {
        duration: 0.25,
        // Mismo `ease-out` que los tokens de CSS: arranca rápido y frena.
        ease: [0.16, 1, 0.3, 1],
        delay: stagger(this.desfase()),
      },
    );
  }
}
