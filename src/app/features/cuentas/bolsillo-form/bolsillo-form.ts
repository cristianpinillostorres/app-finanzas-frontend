import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { startWith } from 'rxjs';

import { CUENTAS_API } from '../../../core/api/cuentas/cuentas-api';
import { MOVIMIENTOS_API } from '../../../core/api/movimientos/movimientos-api';
import { saldoCuenta } from '../../../core/domain';
import type { Movimiento } from '../../../core/models';
import { campoInvalido } from '../../../shared/forms/campo.util';
import { formatearCop } from '../../../shared/format/moneda';
import { mostrarErrorGuardado } from '../../../shared/guardado/guardado.util';
import { GuardandoOverlay } from '../../../shared/guardando-overlay/guardando-overlay';
import { MonedaCopPipe } from '../../../shared/pipes/moneda-cop.pipe';
import type { BolsilloFormData } from './bolsillo-form-data';
import { HojaCabecera } from '../../../shared/hoja-cabecera/hoja-cabecera';

/**
 * Crea un bolsillo dentro de una cuenta. El monto inicial (si hay) sale del
 * saldo libre de la cuenta madre: el bolsillo se crea en $0 y luego se
 * registra un movimiento interno madre → bolsillo, para que el total de la
 * cuenta no cambie (regla de las notas funcionales) y quede en el
 * historial, igual que cualquier otro movimiento entre piezas.
 */
@Component({
  selector: 'app-bolsillo-form',
  imports: [HojaCabecera, ReactiveFormsModule, MatIconModule, MatButtonModule, MonedaCopPipe, GuardandoOverlay],
  templateUrl: './bolsillo-form.html',
  styleUrl: './bolsillo-form.scss',
})
export class BolsilloForm {
  private readonly fb = inject(FormBuilder);
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly movimientosApi = inject(MOVIMIENTOS_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<BolsilloForm>);
  private readonly datos = inject<BolsilloFormData>(MAT_DIALOG_DATA);

  protected readonly cuentaPadre = this.datos.cuentaPadre;
  protected readonly guardando = signal(false);

  private readonly movimientos = toSignal(this.movimientosApi.listar(), {
    initialValue: [] as Movimiento[],
  });
  protected readonly saldoLibre = computed(() => saldoCuenta(this.cuentaPadre, this.movimientos()));

  protected readonly form = this.fb.nonNullable.group({
    nombre: this.fb.nonNullable.control('', Validators.required),
    montoInicial: this.fb.control<number | null>(null),
    reservado: this.fb.nonNullable.control(false),
  });

  private readonly montoInicial = toSignal(
    this.form.controls.montoInicial.valueChanges.pipe(
      startWith(this.form.controls.montoInicial.value),
    ),
    { initialValue: null as number | null },
  );

  protected readonly invalido = campoInvalido;

  protected readonly errorSaldoInsuficiente = computed(() => {
    const monto = this.montoInicial();
    if (!monto) return null;
    return monto > this.saldoLibre()
      ? `${this.cuentaPadre.nombre} no tiene ${formatearCop(monto)} disponibles en saldo libre.`
      : null;
  });

  protected cerrar(): void {
    this.dialogRef.close();
  }

  protected guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.errorSaldoInsuficiente() || this.guardando()) return;

    const valores = this.form.getRawValue();
    this.guardando.set(true);

    this.cuentasApi
      .crearBolsillo({
        nombre: valores.nombre,
        cuentaPadreId: this.cuentaPadre.id,
        color: this.cuentaPadre.color,
        saldoInicial: 0,
        reservado: valores.reservado,
      })
      .subscribe({
        next: (bolsillo) => {
          if (valores.montoInicial && valores.montoInicial > 0) {
            this.movimientosApi
              .crear({
                fecha: this.fechaHoyIso(),
                tipo: 'INTERNO',
                monto: valores.montoInicial,
                descripcion: `Apertura de bolsillo · ${bolsillo.nombre}`,
                cuentaOrigenId: this.cuentaPadre.id,
                cuentaDestinoId: bolsillo.id,
              })
              .subscribe({ next: () => this.finalizar(), error: (error) => this.fallo(error) });
          } else {
            this.finalizar();
          }
        },
        error: (error) => this.fallo(error),
      });
  }

  private finalizar(): void {
    this.guardando.set(false);
    this.snackBar.open('Bolsillo creado', undefined, { duration: 3000 });
    this.dialogRef.close(true);
  }

  private fallo(error: unknown): void {
    this.guardando.set(false);
    mostrarErrorGuardado(this.snackBar, error);
  }

  private fechaHoyIso(): string {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  }
}
