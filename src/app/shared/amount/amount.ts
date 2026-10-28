import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { animate } from 'motion';

import { MontosVisibilityService } from '../../core/montos-visibility.service';
import { prefiereMenosMovimiento } from '../motion/preferencias-movimiento';
import { formatearCop } from '../format/moneda';

/**
 * Envuelve un monto para que respete el botón global de "ocultar montos"
 * (barra superior/móvil). El tamaño y el color (`t-kpi`, `mon-out`,
 * `.kv b`...) se aplican desde afuera con clases.
 *
 * Con `animar`, el monto cuenta desde cero la primera vez que llega un
 * valor. Se usa solo en los números que lideran una pantalla (el héroe y
 * las stat-cards): en una lista de veinte filas, veinte contadores a la vez
 * son ruido, no jerarquía.
 */
@Component({
  selector: 'app-amount',
  standalone: true,
  templateUrl: './amount.html',
  styleUrl: './amount.scss',
})
export class Amount {
  valor = input.required<number | null | undefined>();
  /** Cuenta desde cero al aparecer. Solo para montos protagonistas. */
  animar = input(false);
  /**
   * Mientras la pantalla espera sus datos (ver `primeraCarga`): un bloque
   * del tamaño del monto en vez de un "$0" que parece real.
   */
  cargando = input(false);

  private readonly montosVisibility = inject(MontosVisibilityService);
  protected readonly oculto = this.montosVisibility.oculto;

  /** Lo que se pinta: igual a `valor()` salvo mientras corre el conteo. */
  protected readonly valorVisible = signal<number | null | undefined>(undefined);

  /**
   * El monto partido en signo, símbolo y cifra, para que el "$" se pueda
   * componer aparte: en las cifras grandes va más chico y alzado (ver
   * `.amount__moneda` en `_componentes.scss`). En el resto se ve igual que
   * el texto corrido "$1.250.000". `null` sin valor que mostrar.
   */
  protected readonly partes = computed(() => {
    const texto = formatearCop(this.valorVisible());
    const simbolo = texto.indexOf('$');
    if (simbolo === -1) return null;
    return { signo: texto.slice(0, simbolo), cifra: texto.slice(simbolo + 1) };
  });

  /** El conteo es un efecto de llegada: se hace una vez, no en cada cambio. */
  private yaConto = false;

  constructor() {
    effect(() => {
      const destino = this.valor();

      if (!this.debeContar(destino)) {
        this.valorVisible.set(destino);
        return;
      }

      this.yaConto = true;
      this.valorVisible.set(0);

      let huboFrames = false;
      animate(0, destino, {
        // Más largo que las transiciones de interfaz (150-250ms) a
        // propósito: a 250ms el conteo es un parpadeo y no se alcanza a
        // leer, que es justo lo que se quería mostrar.
        duration: 0.55,
        // Mismo `ease-out` que los tokens de CSS.
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (valor) => {
          huboFrames = true;
          this.valorVisible.set(Math.round(valor));
        },
        // El último cuadro puede quedar a unos pesos del destino por el
        // redondeo; se fija el valor exacto al terminar.
        onComplete: () => this.valorVisible.set(destino),
      });

      // Red de seguridad: si el conteo no llegó a correr ni un cuadro, se
      // muestra el valor real. `motion` avanza con `requestAnimationFrame`,
      // que el navegador no ejecuta en una pestaña en segundo plano; sin
      // esto, abrir la app en una pestaña de fondo dejaba el monto en "$0"
      // de forma permanente, porque el conteo ya se había dado por hecho.
      setTimeout(() => {
        if (!huboFrames) this.valorVisible.set(destino);
      }, 400);
    });
  }

  /**
   * Si corresponde contar en vez de mostrar el valor de una.
   *
   * Se descarta el conteo cuando no aporta (montos ocultos, valor nulo o
   * cero) y cuando no puede verse: con `prefers-reduced-motion`, o con la
   * pestaña en segundo plano, donde no hay cuadros que animar.
   */
  private debeContar(destino: number | null | undefined): destino is number {
    return (
      this.animar() &&
      !this.yaConto &&
      !this.oculto() &&
      !prefiereMenosMovimiento() &&
      typeof destino === 'number' &&
      Number.isFinite(destino) &&
      destino !== 0 &&
      (typeof document === 'undefined' || document.visibilityState === 'visible')
    );
  }
}
