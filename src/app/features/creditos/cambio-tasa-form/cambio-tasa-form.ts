import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CREDITOS_API } from '../../../core/api/creditos/creditos-api';
import { fechaIsoDesdeLocal } from '../../../core/domain';
import type { CreditoBanco } from '../../../core/models';
import { guardarConFeedback } from '../../../shared/guardado/guardado.util';
import { HojaCabecera } from '../../../shared/hoja-cabecera/hoja-cabecera';

export interface CambioTasaFormData {
  credito: CreditoBanco;
}

/**
 * Registrar un cambio de tasa E.A. de un crédito con banco de tasa
 * variable: se abre desde "Cambiar tasa" en la tab Créditos. La tasa se
 * pide en porcentaje (ej. 21,5) y se guarda como fracción, igual que
 * `credito.tasaEa`.
 */
@Component({
  selector: 'app-cambio-tasa-form',
  imports: [HojaCabecera, ReactiveFormsModule, MatIconModule, MatButtonModule],
  templateUrl: './cambio-tasa-form.html',
  styleUrl: './cambio-tasa-form.scss',
})
export class CambioTasaForm {
  private readonly fb = inject(FormBuilder);
  private readonly creditosApi = inject(CREDITOS_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<CambioTasaForm>);
  private readonly datos = inject<CambioTasaFormData>(MAT_DIALOG_DATA);

  protected readonly credito = this.datos.credito;
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    fechaDesde: this.fb.nonNullable.control(fechaIsoDesdeLocal(new Date()), Validators.required),
    tasaEaPorcentaje: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
  });

  protected cerrar(): void {
    this.dialogRef.close();
  }

  protected guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando()) return;

    const v = this.form.getRawValue();
    const guardar$ = this.creditosApi.registrarCambioTasa({
      creditoId: this.credito.id,
      fechaDesde: v.fechaDesde,
      tasaEa: v.tasaEaPorcentaje! / 100,
    });

    guardarConFeedback(this.snackBar, this.guardando, guardar$, 'Tasa actualizada', () =>
      this.dialogRef.close(true),
    );
  }
}
