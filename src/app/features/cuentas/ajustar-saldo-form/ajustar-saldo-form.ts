import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { startWith } from 'rxjs';

import { MOVIMIENTOS_API } from '../../../core/api/movimientos/movimientos-api';
import { saldoCuenta } from '../../../core/domain';
import type { Cuenta, Movimiento } from '../../../core/models';
import { campoInvalido } from '../../../shared/forms/campo.util';
import { guardarConFeedback } from '../../../shared/guardado/guardado.util';
import { GuardandoOverlay } from '../../../shared/guardando-overlay/guardando-overlay';
import { MonedaCopPipe } from '../../../shared/pipes/moneda-cop.pipe';
import type { AjustarSaldoFormData } from './ajustar-saldo-form-data';

/**
 * Ajusta el saldo de una pieza (saldo libre o un bolsillo puntual): se
 * ingresa el saldo real y se registra un movimiento de ajuste por la
 * diferencia (notas funcionales, "Acciones sobre una cuenta"). El saldo
 * nunca se edita a mano: siempre queda el movimiento en el historial.
 */
@Component({
  selector: 'app-ajustar-saldo-form',
  imports: [ReactiveFormsModule, MatIconModule, MatButtonModule, MonedaCopPipe, GuardandoOverlay],
  templateUrl: './ajustar-saldo-form.html',
  styleUrl: './ajustar-saldo-form.scss',
})
export class AjustarSaldoForm {
  private readonly fb = inject(FormBuilder);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<AjustarSaldoForm>);
  private readonly datos = inject<AjustarSaldoFormData>(MAT_DIALOG_DATA);

  protected readonly piezas: Cuenta[] = [this.datos.cuentaRaiz, ...this.datos.bolsillos];
  protected readonly guardando = signal(false);

  private readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });

  protected readonly form = this.fb.nonNullable.group({
    piezaId: this.fb.nonNullable.control(this.datos.cuentaRaiz.id, Validators.required),
    saldoReal: this.fb.control<number | null>(null, Validators.required),
  });

  private readonly piezaId = toSignal(
    this.form.controls.piezaId.valueChanges.pipe(startWith(this.form.controls.piezaId.value)),
    { initialValue: this.datos.cuentaRaiz.id },
  );

  protected readonly pieza = computed(
    () => this.piezas.find((p) => p.id === this.piezaId()) ?? this.datos.cuentaRaiz,
  );
  protected readonly saldoActual = computed(() => saldoCuenta(this.pieza(), this.movimientos()));

  protected readonly invalido = campoInvalido;

  protected etiquetaPieza(pieza: Cuenta): string {
    return pieza.id === this.datos.cuentaRaiz.id ? 'Saldo libre' : `Bolsillo · ${pieza.nombre}`;
  }

  protected cerrar(): void {
    this.dialogRef.close();
  }

  protected guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando()) return;

    const { saldoReal } = this.form.getRawValue();
    const diferencia = saldoReal! - this.saldoActual();
    if (diferencia === 0) {
      this.snackBar.open('El saldo ya coincide, no se registró ningún ajuste', undefined, {
        duration: 3000,
      });
      this.dialogRef.close();
      return;
    }

    const pieza = this.pieza();
    const guardar$ = this.movimientosApi.crear({
      fecha: this.fechaHoyIso(),
      tipo: 'AJUSTE',
      monto: Math.abs(diferencia),
      descripcion: `Ajuste de saldo · ${this.etiquetaPieza(pieza)}`,
      cuentaOrigenId: diferencia < 0 ? pieza.id : undefined,
      cuentaDestinoId: diferencia > 0 ? pieza.id : undefined,
    });

    guardarConFeedback(this.snackBar, this.guardando, guardar$, 'Saldo ajustado', () =>
      this.dialogRef.close(true),
    );
  }

  private fechaHoyIso(): string {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  }
}
