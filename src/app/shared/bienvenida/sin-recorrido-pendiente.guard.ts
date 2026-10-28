import { Injector, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { type Observable, filter, map, of, switchMap, take, timeout } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { BienvenidaService } from './bienvenida.service';

/**
 * Sin ninguna cuenta creada y sin haber saltado el recorrido, se va a la
 * bienvenida, entre a la sección que entre (la misma condición que apaga
 * Movimientos y Pagos fijos, ver `BienvenidaService.faltaCuenta`): sin
 * cuenta la app no sirve todavía, aunque haya algún pago fijo o crédito.
 * Se decide antes de dibujar la pantalla, con los datos ya cargados, así
 * no se alcanza a ver un esqueleto o un estado vacío que enseguida
 * desaparece.
 *
 * Al recargar, el router navega antes de que Firebase lea la sesión: por
 * eso primero espera a que se sepa si hay sesión. Sin sesión deja pasar
 * (se muestra el login, que decide al entrar: ver `App`).
 *
 * Si los datos no llegan en 8 s (sin conexión y sin caché), deja pasar: el
 * `Shell` redirige igual en cuanto lleguen.
 */
export const sinRecorridoPendiente: CanActivateFn = () => {
  const auth = inject(AuthService);
  const injector = inject(Injector);
  return toObservable(auth.cargando).pipe(
    filter((cargando) => !cargando),
    take(1),
    switchMap(() => (auth.autenticado() ? destinoDeLaSesion(injector) : of(true))),
  );
};

/**
 * `true` si puede seguir a donde iba, o la bienvenida si le toca. Lo usa
 * también `App` al entrar desde el login. `BienvenidaService` se pide
 * recién acá, con sesión: sus listas leen `usuarios/{uid}`.
 */
export function destinoDeLaSesion(injector: Injector): Observable<true | UrlTree> {
  const auth = injector.get(AuthService);
  const router = injector.get(Router);
  if (auth.anonimo()) return of(router.parseUrl('/bienvenida'));
  const bienvenida = injector.get(BienvenidaService);
  return toObservable(bienvenida.listo, { injector }).pipe(
    filter(Boolean),
    take(1),
    map(() => (bienvenida.faltaCuenta() ? router.parseUrl('/bienvenida') : true)),
    timeout({ first: 8000, with: () => of(true as const) }),
  );
}
