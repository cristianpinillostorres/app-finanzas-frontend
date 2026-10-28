import { Injectable } from '@angular/core';

/**
 * Si la sesión acaba de empezar desde el login (no restaurada al recargar):
 * la bienvenida usa esto para animar el paso desde el panel del login
 * (ver `bienvenida.page.scss`, "abre-puerta"). Se consume una sola vez.
 */
@Injectable({ providedIn: 'root' })
export class TransicionLogin {
  private desdeLogin = false;

  marcar(): void {
    this.desdeLogin = true;
  }

  consumir(): boolean {
    const valor = this.desdeLogin;
    this.desdeLogin = false;
    return valor;
  }
}
