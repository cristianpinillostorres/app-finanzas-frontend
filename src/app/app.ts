import { Component, Injector, effect, inject, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { filter, firstValueFrom } from 'rxjs';

import { AuthService } from './core/auth/auth.service';
import { LoginPage } from './features/login/login.page';
import { Shell } from './layout/shell/shell';
import { TransicionLogin } from './shared/bienvenida/transicion-login';
import { destinoDeLaSesion } from './shared/bienvenida/sin-recorrido-pendiente.guard';

/**
 * Sin `/login` como ruta ni guard: toda la app está detrás de sesión, así
 * que la raíz decide entre `Shell` (con las 5 pantallas) y
 * `LoginPage` según `AuthService.autenticado()`. Mientras Supabase Auth
 * resuelve la sesión persistida (`cargando()`), no se muestra ninguna de
 * las dos, para no parpadear al login si en realidad sí hay sesión.
 */
@Component({
  selector: 'app-root',
  imports: [Shell, LoginPage],
  template: `
    @if (!auth.cargando() && !transicion.saliendo()) {
      @if (auth.autenticado() && !decidiendo()) {
        <app-shell />
      } @else {
        <app-login-page />
      }
    }
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly transicion = inject(TransicionLogin);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  /**
   * Recién confirmada la sesión desde el login: el login sigue en pantalla
   * hasta saber a dónde va (la bienvenida si la cuenta está vacía, o la
   * sección donde estaba). Sin esto se veía la app un momento y después
   * saltaba a la bienvenida: el router ya había resuelto la URL sin sesión
   * y no vuelve a correr sus guards solo porque cambió la sesión.
   *
   * Sale de la sesión misma (`linkedSignal`), no de un `effect`: el effect
   * corría después de que la plantilla ya había dibujado el `Shell` con la
   * sesión nueva, y General alcanzaba a verse un instante. Así, en el mismo
   * momento en que hay sesión, ya se sabe que hay que esperar.
   *
   * Solo al pasar de "sin sesión" a "con sesión" (se entró desde el login);
   * al recargar con la sesión guardada lo deciden los guards de las rutas.
   */
  protected readonly decidiendo = linkedSignal<boolean | undefined, boolean>({
    source: () => (this.auth.cargando() ? undefined : this.auth.autenticado()),
    computation: (autenticado, anterior) => anterior?.source === false && autenticado === true,
  });

  private enCurso = false;
  private readonly alEntrar = effect(() => {
    if (!this.decidiendo() || this.enCurso) return;
    // La bienvenida anima la salida del login (ver `TransicionLogin`).
    this.transicion.marcar();
    void this.decidirDestino();
  });

  private async decidirDestino(): Promise<void> {
    this.enCurso = true;
    try {
      const destino = await firstValueFrom(destinoDeLaSesion(this.injector));
      if (destino !== true) await this.router.navigateByUrl(destino);
    } finally {
      this.enCurso = false;
      this.decidiendo.set(false);
      this.auth.terminarEntrada();
    }
  }

  constructor() {
    // Sin esto, el service worker (PWA) descarga cada deploy nuevo en
    // segundo plano pero lo deja "listo" sin aplicarlo — quien ya tenía la
    // app abierta sigue viendo la versión vieja hasta cerrar y reabrir. Con
    // un solo usuario (esta app), forzar el recargo apenas hay una versión
    // lista es más simple y confiable que un aviso "hay una versión nueva,
    // ¿recargar?".
    // Opcional: las pruebas arman su propio `TestBed` sin
    // `provideServiceWorker` (ver `app.spec.ts`), donde `SwUpdate` no
    // tiene provider — no hace falta agregarlo ahí solo para esto.
    const swUpdate = inject(SwUpdate, { optional: true });
    if (swUpdate?.isEnabled) {
      swUpdate.versionUpdates
        .pipe(filter((evento): evento is VersionReadyEvent => evento.type === 'VERSION_READY'))
        .subscribe(() => document.location.reload());
    }
  }
}
