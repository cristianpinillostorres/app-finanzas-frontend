import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Breakpoint único de la app: por debajo de 768px se considera móvil. */
export const BREAKPOINT_MOVIL = '(max-width: 767.98px)';

/** Expone si la pantalla está en el rango móvil como signal, para el layout responsive. */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly esMovil = toSignal(
    this.breakpointObserver.observe(BREAKPOINT_MOVIL).pipe(map((resultado) => resultado.matches)),
    { initialValue: this.breakpointObserver.isMatched(BREAKPOINT_MOVIL) },
  );
}
