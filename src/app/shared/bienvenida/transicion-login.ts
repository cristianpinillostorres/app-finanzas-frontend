import { Injectable, signal } from '@angular/core';

/**
 * Si la sesión acaba de empezar desde el login (no restaurada al recargar):
 * la bienvenida usa esto para animar el paso desde el panel del login
 * (ver `bienvenida.page.scss`, "abre-puerta"). Se consume una sola vez.
 */
@Injectable({ providedIn: 'root' })
export class TransicionLogin {
  private desdeLogin = false;

  /**
   * Saliendo de la sesión hacia el login: `cerrarSesion` deja ver el login
   * un instante antes de recargar, y esa vista se gastaba la marca de
   * vuelta. Mientras esto está prendido `App` no pinta nada.
   */
  readonly saliendo = signal(false);

  marcar(): void {
    this.desdeLogin = true;
  }

  consumir(): boolean {
    const valor = this.desdeLogin;
    this.desdeLogin = false;
    return valor;
  }

  /**
   * El camino de vuelta: "¿Ya tienes cuenta? Entra" cierra la sesión
   * anónima y recarga la página, así que la marca va en `sessionStorage`
   * (en memoria se perdía) y el login anima la puerta al cerrarse.
   */
  marcarVuelta(): void {
    try {
      sessionStorage.setItem(CLAVE_VUELTA, '1');
    } catch {
      // Sin storage: el login aparece sin transición, nada más.
    }
  }

  consumirVuelta(): boolean {
    try {
      const valor = sessionStorage.getItem(CLAVE_VUELTA) === '1';
      sessionStorage.removeItem(CLAVE_VUELTA);
      return valor;
    } catch {
      return false;
    }
  }
}

const CLAVE_VUELTA = 'finanzas.vuelta-login';
