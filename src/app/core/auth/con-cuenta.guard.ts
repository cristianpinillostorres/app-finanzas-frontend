import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Quien entró con "Regístrate" (sesión anónima) todavía no tiene cuenta:
 * se queda en la bienvenida hasta elegir con qué entrar al final de los
 * pasos. Sin esto podía saltar a General y usar la app con datos que se
 * pierden al cerrar el navegador.
 *
 * Espera a que Supabase lea la sesión: al recargar, el router navega
 * antes, y `anonimo()` todavía no dice la verdad.
 */
export const conCuenta: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return toObservable(auth.cargando).pipe(
    filter((cargando) => !cargando),
    take(1),
    map(() => (auth.anonimo() ? router.parseUrl('/bienvenida') : true)),
  );
};
