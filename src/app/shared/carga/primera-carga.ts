import type { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type Observable, catchError, combineLatest, map, of } from 'rxjs';

/**
 * `true` en cuanto todas las fuentes respondieron por primera vez.
 *
 * `toSignal(..., { initialValue: [] })` no distingue "todavía no llegó" de
 * "llegó vacío": sin esta señal, cada pantalla pintaba montos en $0 y
 * estados vacíos ("Todavía no tienes cuentas") durante el primer segundo
 * de carga, que se leían como datos reales. Con ella, mientras
 * tanto van esqueletos con la forma de lo que viene.
 *
 * Si una fuente falla, se da por cargada: un esqueleto eterno esconde el
 * problema, y la pantalla ya sabe mostrar lo que sí llegó.
 *
 * Como `toSignal`, se llama en contexto de inyección (un campo de la clase).
 */
export function primeraCarga(...fuentes: Observable<unknown>[]): Signal<boolean> {
  return toSignal(
    combineLatest(fuentes).pipe(
      map(() => true),
      catchError(() => of(true)),
    ),
    { initialValue: false },
  );
}
