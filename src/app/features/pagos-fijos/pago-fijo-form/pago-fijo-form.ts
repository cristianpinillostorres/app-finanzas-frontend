import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { startWith } from 'rxjs';

import { CATEGORIAS_API, categoriasParaElegir } from '../../../core/api/categorias/categorias-api';
import { CUENTAS_API } from '../../../core/api/cuentas/cuentas-api';
import { PAGOS_FIJOS_API } from '../../../core/api/pagos-fijos/pagos-fijos-api';
import { opcionesCuentasYBolsillos } from '../../../core/domain';
import type { Categoria, Cuenta, FrecuenciaPagoFijo } from '../../../core/models';
import { guardarConFeedback } from '../../../shared/guardado/guardado.util';
import type { PagoFijoFormData } from './pago-fijo-form-data';

interface OpcionFrecuencia {
  valor: FrecuenciaPagoFijo;
  etiqueta: string;
}

interface OpcionMes {
  valor: number;
  etiqueta: string;
}

/**
 * Crear o editar un pago fijo propio (arriendo, servicios,
 * suscripciones...). Editar se abre desde el detalle de la fila en Pagos
 * fijos: sin eso, un monto mal escrito descuadraba "Te queda libre" todos
 * los meses sin forma de corregirlo desde la app.
 */
@Component({
  selector: 'app-pago-fijo-form',
  imports: [ReactiveFormsModule, MatIconModule, MatButtonModule],
  templateUrl: './pago-fijo-form.html',
  styleUrl: './pago-fijo-form.scss',
})
export class PagoFijoForm {
  private readonly fb = inject(FormBuilder);
  private readonly pagosFijosApi = inject(PAGOS_FIJOS_API);
  private readonly cuentasApi = inject(CUENTAS_API);
  private readonly categoriasApi = inject(CATEGORIAS_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<PagoFijoForm>);
  private readonly pagoFijoEditando = inject<PagoFijoFormData | null>(MAT_DIALOG_DATA, {
    optional: true,
  })?.pagoFijo;

  protected readonly editando = this.pagoFijoEditando !== undefined;

  protected readonly guardando = signal(false);

  protected readonly frecuencias: OpcionFrecuencia[] = [
    { valor: 'MENSUAL', etiqueta: 'Mensual' },
    { valor: 'BIMESTRAL', etiqueta: 'Bimestral' },
    { valor: 'ANUAL', etiqueta: 'Anual' },
  ];

  protected readonly meses: OpcionMes[] = Array.from({ length: 12 }, (_, i) => {
    const nombre = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(2024, i, 1));
    return { valor: i + 1, etiqueta: nombre.charAt(0).toUpperCase() + nombre.slice(1) };
  });

  private readonly cuentas = toSignal(this.cuentasApi.listar(), { initialValue: [] as Cuenta[] });
  private readonly categorias = toSignal(this.categoriasApi.listar(), {
    initialValue: [] as Categoria[],
  });
  protected readonly opcionesCuentas = computed(() => opcionesCuentasYBolsillos(this.cuentas()));
  protected readonly categoriasGasto = computed(() =>
    categoriasParaElegir(this.categorias(), 'GASTO', this.valorFormulario().categoriaId),
  );

  protected readonly form = this.fb.nonNullable.group({
    nombre: this.fb.nonNullable.control('', Validators.required),
    categoriaId: this.fb.control<string | null>(null, Validators.required),
    diaLimite: this.fb.nonNullable.control(15, [
      Validators.required,
      Validators.min(1),
      Validators.max(31),
    ]),
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    esVariable: this.fb.nonNullable.control(false),
    frecuencia: this.fb.nonNullable.control<FrecuenciaPagoFijo>('MENSUAL', Validators.required),
    mesInicio: this.fb.nonNullable.control(1),
    cuentaDefaultId: this.fb.control<string | null>(null, Validators.required),
  });

  constructor() {
    const p = this.pagoFijoEditando;
    if (p) {
      this.form.setValue({
        nombre: p.nombre,
        categoriaId: p.categoriaId,
        diaLimite: p.diaLimite,
        monto: p.monto,
        esVariable: p.esVariable,
        frecuencia: p.frecuencia,
        mesInicio: p.mesInicio,
        cuentaDefaultId: p.cuentaDefaultId,
      });
    }
  }

  private readonly valorFormulario = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    {
      initialValue: this.form.getRawValue(),
    },
  );
  protected readonly mostrarMesInicio = computed(
    () => this.valorFormulario().frecuencia !== 'MENSUAL',
  );

  protected cerrar(): void {
    this.dialogRef.close();
  }

  protected guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.guardando()) return;

    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre.trim(),
      categoriaId: v.categoriaId!,
      diaLimite: v.diaLimite,
      monto: v.monto!,
      esVariable: v.esVariable,
      frecuencia: v.frecuencia,
      mesInicio: v.frecuencia === 'MENSUAL' ? 1 : Number(v.mesInicio),
      cuentaDefaultId: v.cuentaDefaultId!,
    };
    const guardar$ = this.pagoFijoEditando
      ? this.pagosFijosApi.actualizar(this.pagoFijoEditando.id, datos)
      : this.pagosFijosApi.crear({ ...datos, activo: true });
    const mensaje = this.pagoFijoEditando ? 'Cambios guardados' : 'Pago fijo creado';

    guardarConFeedback(this.snackBar, this.guardando, guardar$, mensaje, () =>
      this.dialogRef.close(true),
    );
  }
}
