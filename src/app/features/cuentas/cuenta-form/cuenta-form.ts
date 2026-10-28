import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { startWith } from 'rxjs';

import { CUENTAS_API } from '../../../core/api/cuentas/cuentas-api';
import type { TipoCuenta } from '../../../core/models';
import { campoInvalido } from '../../../shared/forms/campo.util';
import { guardarConFeedback } from '../../../shared/guardado/guardado.util';
import { GuardandoOverlay } from '../../../shared/guardando-overlay/guardando-overlay';
import type { CuentaFormData } from './cuenta-form-data';
import { Selector } from '../../../shared/forms/selector';
import { HojaCabecera } from '../../../shared/hoja-cabecera/hoja-cabecera';

interface OpcionTipo {
  valor: TipoCuenta;
  etiqueta: string;
}

/**
 * Crear o editar una cuenta raíz. El saldo inicial solo se pide al crear:
 * "el total de la cuenta nunca se edita a mano" (notas funcionales), así
 * que en modo edición se corrige desde "Ajustar saldo", no aquí.
 */
@Component({
  selector: 'app-cuenta-form',
  imports: [
    HojaCabecera,
    Selector,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    GuardandoOverlay,
  ],
  templateUrl: './cuenta-form.html',
  styleUrl: './cuenta-form.scss',
})
export class CuentaForm {
  private readonly fb = inject(FormBuilder);
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<CuentaForm>);
  private readonly datos = inject<CuentaFormData>(MAT_DIALOG_DATA);

  protected readonly tipos: OpcionTipo[] = [
    { valor: 'BANCO', etiqueta: 'Banco' },
    { valor: 'BILLETERA', etiqueta: 'Billetera digital' },
    { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
    { valor: 'OTRO', etiqueta: 'Otro' },
  ];

  private readonly cuentaEditando = this.datos.cuenta;
  protected readonly modoEdicion = this.cuentaEditando !== undefined;
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    tipo: this.fb.nonNullable.control<TipoCuenta>(
      this.cuentaEditando?.tipo ?? 'BANCO',
      Validators.required,
    ),
    nombre: this.fb.nonNullable.control(this.cuentaEditando?.nombre ?? '', Validators.required),
    entidad: this.fb.nonNullable.control(this.cuentaEditando?.entidad ?? ''),
    ultimos4: this.fb.nonNullable.control(this.cuentaEditando?.ultimos4 ?? ''),
    color: this.fb.nonNullable.control(this.cuentaEditando?.color ?? '#2E7D32'),
    saldoInicial: this.fb.nonNullable.control(
      this.cuentaEditando?.saldoInicial ?? 0,
      Validators.required,
    ),
    sumaEnDisponible: this.fb.nonNullable.control(this.cuentaEditando?.sumaEnDisponible ?? true),
  });

  protected readonly invalido = campoInvalido;

  private readonly tipoSeleccionado = toSignal(
    this.form.controls.tipo.valueChanges.pipe(startWith(this.form.controls.tipo.value)),
    { initialValue: this.form.controls.tipo.value },
  );
  /** Entidad/últimos 4 dígitos no aplican a efectivo: no hay banco ni número de cuenta que anotar. */
  protected readonly pideEntidad = computed(() => this.tipoSeleccionado() !== 'EFECTIVO');

  constructor() {
    // Al pasar a efectivo, limpia lo que se haya escrito antes en entidad/
    // últimos 4 — si no, quedaría guardado en silencio aunque el campo ya
    // no se vea.
    effect(() => {
      if (this.tipoSeleccionado() === 'EFECTIVO') {
        this.form.controls.entidad.setValue('', { emitEvent: false });
        this.form.controls.ultimos4.setValue('', { emitEvent: false });
      }
    });
  }

  protected cerrar(): void {
    this.dialogRef.close();
  }

  protected guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando()) return;

    const valores = this.form.getRawValue();

    const guardar$ = this.cuentaEditando
      ? this.cuentasApi.actualizar(this.cuentaEditando.id, {
          tipo: valores.tipo,
          nombre: valores.nombre,
          entidad: valores.entidad || undefined,
          ultimos4: valores.ultimos4 || undefined,
          color: valores.color,
          sumaEnDisponible: valores.sumaEnDisponible,
        })
      : this.cuentasApi.crear({
          tipo: valores.tipo,
          nombre: valores.nombre,
          entidad: valores.entidad || undefined,
          ultimos4: valores.ultimos4 || undefined,
          color: valores.color,
          saldoInicial: valores.saldoInicial,
          sumaEnDisponible: valores.sumaEnDisponible,
        });

    guardarConFeedback(
      this.snackBar,
      this.guardando,
      guardar$,
      this.modoEdicion ? 'Cuenta actualizada' : 'Cuenta creada',
      () => this.dialogRef.close(true),
    );
  }
}
