import { afterNextRender, Directive, ElementRef, inject, input } from '@angular/core';
import { animate, stagger } from 'motion';

import { prefiereMenosMovimiento } from './preferencias-movimiento';

/**
 * Entrada escalonada de las tarjetas de una pantalla: cada una aparece con
 * un desfase pequeño respecto de la anterior, en el orden en que se ven
 * (de arriba abajo y de izquierda a derecha, que en escritorio no es el del
 * DOM). Las cifras de `.kpis` entran cada una por su lado.
 *
 * El héroe (`.hero--pantalla`) no entra: es el mismo en todas las pantallas
 * y se queda quieto al cambiar de pestaña; solo cambia su número.
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
  /** Desfase entre tarjetas, en segundos. */
  desfase = input(0.055);

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    // Después del primer dibujo: al crearse la directiva sus hijos todavía
    // no existen, y antes de esto la animación nunca llegaba a correr.
    afterNextRender(() => {
      // No se anima si no aporta o si no puede correr. Lo segundo importa
      // más de lo que parece: el estado inicial de esta animación es
      // `opacity: 0`, y el navegador no da cuadros a una pestaña en segundo
      // plano — arrancarla ahí dejaría la pantalla en blanco hasta que
      // alguien vuelva a la pestaña.
      if (prefiereMenosMovimiento() || document.visibilityState !== 'visible') return;

      const tarjetas = (Array.from(host.children) as HTMLElement[])
        .flatMap((hijo) =>
          hijo.classList.contains('kpis') ? (Array.from(hijo.children) as HTMLElement[]) : [hijo],
        )
        // Fuera lo que no se ve (la cabecera en el celular) y el héroe.
        .filter((el) => el.getClientRects().length > 0 && !el.matches('.hero--pantalla'))
        .map((el) => ({ el, caja: el.getBoundingClientRect() }))
        .sort((a, b) => a.caja.top - b.caja.top || a.caja.left - b.caja.left)
        .map(({ el }) => el);
      if (tarjetas.length === 0) return;

      animate(
        tarjetas,
        { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0)'] },
        {
          duration: 0.4,
          // Mismo `ease-out` que los tokens de CSS: arranca rápido y frena.
          ease: [0.16, 1, 0.3, 1],
          delay: stagger(this.desfase()),
        },
      );
    });
  }
}
