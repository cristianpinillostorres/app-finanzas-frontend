import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/**
 * Destino del enlace del correo de "Olvidé mi contraseña": Supabase ya abrió
 * una sesión de la persona (`PASSWORD_RECOVERY`, ver `AuthService`) y solo
 * falta que escriba la clave nueva.
 */
@Component({
  selector: 'app-nueva-clave-page',
  imports: [ReactiveFormsModule],
  template: `
    <main class="nueva-clave">
      <h1>Crea tu nueva contraseña</h1>
      <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <div class="ios-grupo">
          <div class="ios-fila">
            <label class="ios-fila__rotulo" for="nc-clave">Contraseña</label>
            <input
              class="input"
              id="nc-clave"
              type="password"
              autocomplete="new-password"
              placeholder="Mínimo 8 caracteres"
              formControlName="password"
            />
          </div>
          <div class="ios-fila">
            <label class="ios-fila__rotulo" for="nc-repetir">Repítela</label>
            <input
              class="input"
              id="nc-repetir"
              type="password"
              autocomplete="new-password"
              formControlName="repetir"
            />
          </div>
        </div>
        @if (error(); as mensaje) {
          <p class="ios-nota err" role="alert">{{ mensaje }}</p>
        }
        <button class="btn btn-primary btn-block" type="submit" [disabled]="guardando()">
          {{ guardando() ? 'Guardando…' : 'Guardar contraseña' }}
        </button>
      </form>
    </main>
  `,
  styles: `
    .nueva-clave {
      max-width: 24rem;
      margin: 0 auto;
      padding: 3rem 1rem;
      display: grid;
      gap: 1rem;
    }
    form {
      display: grid;
      gap: 1rem;
    }
  `,
})
export class NuevaClavePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    repetir: ['', Validators.required],
  });
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async guardar(): Promise<void> {
    const { password, repetir } = this.form.getRawValue();
    if (password.length < 8) {
      this.error.set('Usa al menos 8 caracteres.');
      return;
    }
    if (password !== repetir) {
      this.error.set('Las dos contraseñas no son iguales.');
      return;
    }
    this.error.set(null);
    this.guardando.set(true);
    const ok = await this.auth.cambiarClave(password);
    this.guardando.set(false);
    if (ok) void this.router.navigateByUrl('/general');
    else this.error.set('No se pudo guardar. Pide un enlace nuevo e intenta de nuevo.');
  }
}
