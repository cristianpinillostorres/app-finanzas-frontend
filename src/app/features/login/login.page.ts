import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme.service';
import { TransicionLogin } from '../../shared/bienvenida/transicion-login';

/**
 * Única pantalla accesible sin sesión — no es una ruta (`app.routes.ts` no
 * la tiene): `App` decide entre esta y `Shell` según `AuthService.autenticado()`
 * (ver `app.ts`). Entra con correo o Google; "Regístrate" abre la
 * bienvenida sin cuenta y al final de los pasos la persona elige con cuál
 * de los dos crearla (ver `AuthService.registrarse`).
 */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, MatIconModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  /** Llega desde la bienvenida ("¿Ya tienes cuenta? Entra"): la puerta se cierra. */
  protected readonly desdeBienvenida = inject(TransicionLogin).consumirVuelta();

  constructor() {
    inject(ThemeService).soloClaro();
    // El panel propio ya cubre el del puente (`data-puente`, ver index.html).
    setTimeout(() => document.documentElement.removeAttribute('data-puente'), 800);
  }

  /**
   * Recorre la bienvenida sin cuenta todavía (sesión anónima); al final de
   * los pasos elige si entrar con correo o con Google.
   */
  protected registrarse(): void {
    void this.auth.registrarse();
  }

  textoCompleto = 'Saber cuánto te queda libre \nnunca fue tan fácil.  ';
  textoAnimado = signal('');

  ngOnInit() {
    this.escribirTexto();
  }

  /** Si se muestra el formulario de correo y contraseña. */
  protected readonly conCorreo = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    password: this.fb.nonNullable.control('', Validators.required),
  });

  /**
   * Mensajes por campo, solo después de intentar entrar (o de salir del
   * campo): antes, "Entrar" con todo vacío no decía nada. Se recalculan
   * con cada cambio del formulario.
   */
  private readonly cambios = toSignal(this.form.events, { initialValue: null });
  protected readonly errorCorreo = computed(() => {
    this.cambios();
    const control = this.form.controls.email;
    if (!control.touched || control.valid) return null;
    return control.hasError('required') ? 'Escribe tu correo.' : 'Ese correo no es válido.';
  });
  protected readonly errorClave = computed(() => {
    this.cambios();
    const control = this.form.controls.password;
    return control.touched && control.invalid ? 'Escribe tu contraseña.' : null;
  });

  protected entrar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.auth.iniciandoSesion()) return;

    const { email, password } = this.form.getRawValue();
    this.auth.iniciarSesion(email, password);
  }

  escribirTexto() {
    let i = 0;
    const intervalo = setInterval(() => {
      if (i < this.textoCompleto.length) {
        // 2. Actualizas el valor del signal en cada paso
        this.textoAnimado.update((textoActual) => textoActual + this.textoCompleto.charAt(i));
        i++;
      } else {
        clearInterval(intervalo);
      }
    }, 120);
  }
}
