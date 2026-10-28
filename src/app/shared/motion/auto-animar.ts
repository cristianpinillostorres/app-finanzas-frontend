import { Directive, ElementRef, inject, input } from '@angular/core';
import autoAnimate, { type AutoAnimateOptions } from '@formkit/auto-animate';

/**
 * Anima altas, bajas y cambios de posición de los hijos del elemento.
 *
 * Es una directiva propia y no `AutoAnimateDirective` de
 * `@formkit/auto-animate/angular`: ese paquete publica la clase con los
 * decoradores de TypeScript sin compilar (usa `__decorate`), así que no
 * trae la definición de directiva que necesita el compilador AOT de Angular
 * y el build falla con NG2012. La API vanilla (`autoAnimate(elemento)`) sí
 * es utilizable directamente, y de paso permite fijar los parámetros.
 *
 * Se mantiene el mismo selector `[auto-animate]` que usa la librería, para
 * que las plantillas se lean igual que en su documentación.
 *
 * `autoAnimate` consulta `prefers-reduced-motion` por su cuenta y se
 * desactiva solo, así que no hace falta comprobarlo acá.
 */
@Directive({
  selector: '[auto-animate]',
  standalone: true,
})
export class AutoAnimar {
  opciones = input<Partial<AutoAnimateOptions>>({});

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    autoAnimate(host, {
      // 250ms, el techo del rango del sistema de diseño.
      duration: 250,
      // Misma curva de desaceleración que `--ease-out`.
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      ...this.opciones(),
    });
  }
}
